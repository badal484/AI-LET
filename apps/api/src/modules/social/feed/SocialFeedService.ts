import crypto from 'crypto';
import type { Prisma, SocialContent } from '@prisma/client';
import type { SocialFeedPage, SocialFeedTab } from '@ai-companion/types';
import type { SocialFeedFeedbackInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialContentService } from '../content/SocialContentService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { type SocialDomainEvent, SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, encodeCursor } from '../shared/ids.js';
import { SocialFeedRankingService, type FeedCandidate } from './SocialFeedRankingService.js';

interface ViewerGraph {
  followedUsers: Set<string>;
  followedCreators: Set<string>;
  followedCharacters: Set<string>;
  communities: Set<string>;
  excludedAuthors: Set<string>;
  mutedCharacters: Set<string>;
  mutedCommunities: Set<string>;
  mutedTopics: Set<string>;
  hiddenContent: Set<string>;
  notInterested: Set<string>;
  showLess: Set<string>;
}

const CANDIDATE_WINDOW = 300;
const RANKED_TTL_SECONDS = 15 * 60;

/**
 * Read-time candidate retrieval + ranking with Redis caching of the ranked id list.
 * (Fan-out-on-write is intentionally NOT used until scale requires it — see SOCIAL_ARCHITECTURE.md.)
 *
 * Every page is re-hydrated from PostgreSQL and re-filtered for blocks, mutes, moderation status,
 * revocation and expiry, so a cached ranking can never serve forbidden content.
 */
export class SocialFeedService {
  private static async viewerGraph(userId: string): Promise<ViewerGraph> {
    const [follows, creatorFollows, charFollows, memberships, blocked, mutedPosts, feedback] = await Promise.all([
      prisma.userFollow.findMany({ where: { followerUserId: userId, status: 'ACTIVE' }, select: { followedUserId: true }, take: 5000 }),
      prisma.creatorFollow.findMany({ where: { userId }, select: { creatorProfile: { select: { userId: true } } }, take: 5000 }),
      prisma.characterFollow.findMany({ where: { userId }, select: { characterId: true }, take: 5000 }),
      prisma.communityMember.findMany({ where: { userId, status: { in: ['ACTIVE', 'MUTED'] } }, select: { communityId: true } }),
      RelationshipReader.blockedEitherWaySet(userId),
      RelationshipReader.mutedTargets(userId, 'POSTS'),
      prisma.socialFeedFeedback.findMany({ where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, take: 2000 }),
    ]);
    const g: ViewerGraph = {
      followedUsers: new Set(follows.map((f) => f.followedUserId)),
      followedCreators: new Set(creatorFollows.map((f) => f.creatorProfile.userId)),
      followedCharacters: new Set(charFollows.map((f) => f.characterId)),
      communities: new Set(memberships.map((m) => m.communityId)),
      excludedAuthors: new Set([...blocked, ...mutedPosts.users]),
      mutedCharacters: mutedPosts.characters,
      mutedCommunities: mutedPosts.communities,
      mutedTopics: mutedPosts.topics,
      hiddenContent: new Set(),
      notInterested: new Set(),
      showLess: new Set(),
    };
    for (const f of feedback) {
      const key = `${f.targetType === 'AUTHOR' ? 'author' : f.targetType.toLowerCase()}:${f.targetId}`;
      if (f.targetType === 'CONTENT' && (f.signal === 'HIDE' || f.signal === 'NOT_INTERESTED')) g.hiddenContent.add(f.targetId);
      else if (f.signal === 'NOT_INTERESTED' || f.signal === 'HIDE') g.notInterested.add(key);
      else g.showLess.add(key);
    }
    return g;
  }

  /** Final per-item gate used for BOTH fresh and cached rankings. */
  private static passes(c: SocialContent, g: ViewerGraph, viewerId: string): boolean {
    if (c.status !== 'PUBLISHED' || c.deletedAt || c.revokedAt) return false;
    if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return false;
    if (c.authorUserId && c.authorUserId !== viewerId && g.excludedAuthors.has(c.authorUserId)) return false;
    if (c.characterId && g.mutedCharacters.has(c.characterId)) return false;
    if (c.communityId && (g.mutedCommunities.has(c.communityId) || !g.communities.has(c.communityId))) return false;
    if (c.topics.some((t) => g.mutedTopics.has(t) || g.notInterested.has(`topic:${t}`))) return false;
    if (g.hiddenContent.has(c.publicId)) return false;
    if (c.authorUserId && g.notInterested.has(`author:${c.authorUserId}`)) return false;
    if (c.characterId && g.notInterested.has(`character:${c.characterId}`)) return false;
    if (c.visibility === 'UNLISTED') return false;
    if (c.visibility === 'FOLLOWERS' && c.authorUserId !== viewerId && !(c.authorUserId && g.followedUsers.has(c.authorUserId))) return false;
    return true;
  }

  private static sourceOf(c: SocialContent, g: ViewerGraph): FeedCandidate['source'] {
    if (c.communityId && g.communities.has(c.communityId)) return 'COMMUNITY';
    if (c.authorUserId && g.followedUsers.has(c.authorUserId)) return 'FOLLOWED_USER';
    if (c.authorUserId && g.followedCreators.has(c.authorUserId)) return 'FOLLOWED_CREATOR';
    if (c.characterId && g.followedCharacters.has(c.characterId)) return 'FOLLOWED_CHARACTER';
    return 'PUBLIC_DISCOVERY';
  }

  private static reasonOf(source: FeedCandidate['source']): string {
    return {
      FOLLOWED_USER: 'FOLLOWED_PERSON',
      FOLLOWED_CREATOR: 'FOLLOWED_CREATOR',
      FOLLOWED_CHARACTER: 'FOLLOWED_CHARACTER',
      COMMUNITY: 'COMMUNITY',
      PUBLIC_DISCOVERY: 'SUGGESTED',
    }[source];
  }

  private static sourceFilter(g: ViewerGraph, tab: SocialFeedTab): Prisma.SocialContentWhereInput[] {
    const authors = [...new Set([...g.followedUsers, ...g.followedCreators])];
    const or: Prisma.SocialContentWhereInput[] = [];
    if (authors.length) or.push({ authorUserId: { in: authors }, communityId: null, visibility: { in: ['PUBLIC', 'FOLLOWERS'] } });
    if (g.followedCharacters.size) or.push({ characterId: { in: [...g.followedCharacters] }, kind: { in: ['CREATOR_POST', 'CHARACTER_POST'] }, visibility: 'PUBLIC' });
    if (g.communities.size) or.push({ communityId: { in: [...g.communities] } });
    if (tab === 'FOR_YOU') or.push({ visibility: 'PUBLIC', communityId: null, kind: { in: ['CREATOR_POST', 'CHARACTER_POST', 'CHARACTER_SHARE'] } });
    return or;
  }

  private static async baseWhere(): Promise<Prisma.SocialContentWhereInput> {
    const config = await SocialPolicyService.getConfig();
    return { status: 'PUBLISHED', deletedAt: null, revokedAt: null, publishedAt: { gte: new Date(Date.now() - config.feed.maxRecencyDays * 86_400_000) } };
  }

  private static async candidates(g: ViewerGraph, tab: SocialFeedTab): Promise<SocialContent[]> {
    const or = this.sourceFilter(g, tab);
    if (or.length === 0) return [];
    return prisma.socialContent.findMany({
      where: { AND: [await this.baseWhere(), { OR: or }] },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: CANDIDATE_WINDOW,
    });
  }

  private static async exposures(userId: string): Promise<Map<string, number>> {
    try {
      const raw = await redis.hgetall(`social:feed:exposure:${userId}`);
      return new Map(Object.entries(raw).map(([k, v]) => [k, parseInt(v, 10) || 0]));
    } catch {
      return new Map();
    }
  }

  public static async getFeed(userId: string, tab: SocialFeedTab, cursor: string | undefined, limit: number): Promise<SocialFeedPage> {
    await SocialPolicyService.assertFeature('social_feed', { userId });
    const g = await this.viewerGraph(userId);

    // FOLLOWING: chronological keyset pagination straight from the source of truth.
    if (tab === 'FOLLOWING') return this.chronological(userId, g, cursor, limit, false);

    const config = await SocialPolicyService.getConfig();
    try {
      let snapshotId: string;
      let offset = 0;
      let ids: string[] | null = null;
      if (cursor) {
        const [sid, off] = cursor.split('.');
        if (!sid || !off || !/^\d+$/.test(off)) throw new BadRequestError('Invalid pagination cursor');
        snapshotId = sid;
        offset = parseInt(off, 10);
        const cached = await redis.get(`social:feed:ranked:${userId}:${snapshotId}`);
        ids = cached ? (JSON.parse(cached) as string[]) : null;
        if (!ids) return this.chronological(userId, g, undefined, limit, true);
      } else {
        const personalized = await SocialPolicyService.isFeatureEnabled('social_recommendations', { userId });
        const pool = (await this.candidates(g, personalized ? 'FOR_YOU' : 'FOLLOWING')).filter((c) => this.passes(c, g, userId));
        const interests = new Set<string>([...[...g.followedCharacters].map((c) => `character:${c}`)]);
        const ranked = SocialFeedRankingService.rank(
          pool.map((c) => ({
            id: c.id,
            authorId: c.authorUserId,
            characterId: c.characterId,
            communityId: c.communityId,
            topics: c.topics,
            publishedAt: c.publishedAt ?? c.createdAt,
            reactionCount: c.reactionCount,
            commentCount: c.commentCount,
            isAiGenerated: c.isAiGenerated,
            source: this.sourceOf(c, g),
          })),
          {
            now: new Date(),
            exposures: await this.exposures(userId),
            showLess: g.showLess,
            interests,
            freshnessHalfLifeHours: config.feed.fatigueHalfLifeHours,
            maxItemsPerAuthor: config.feed.maxItemsPerAuthorPerPage,
          },
          limit,
        );
        ids = ranked.map((r) => r.candidate.id);
        snapshotId = crypto.randomBytes(8).toString('base64url');
        try {
          await redis
            .multi()
            .set(`social:feed:ranked:${userId}:${snapshotId}`, JSON.stringify(ids), 'EX', RANKED_TTL_SECONDS)
            .lpush(`social:feed:snapshots:${userId}`, snapshotId)
            .ltrim(`social:feed:snapshots:${userId}`, 0, 4)
            .expire(`social:feed:snapshots:${userId}`, RANKED_TTL_SECONDS)
            .exec();
        } catch {
          // Without a cached ranking, later pages fall back to chronological (flagged as degraded).
        }
      }

      const slice = ids.slice(offset, offset + limit);
      const rows = await prisma.socialContent.findMany({ where: { id: { in: slice } } });
      const byId = new Map(rows.map((r) => [r.id, r]));
      // Re-filter at read time: blocks/mutes/moderation after ranking are always honored.
      const fresh = await this.viewerGraph(userId);
      const ordered = slice.map((id) => byId.get(id)).filter((c): c is SocialContent => !!c && this.passes(c, fresh, userId));
      const views = await SocialContentService.toViews(ordered, userId);
      const nextOffset = offset + limit;
      return {
        items: views.map((v, i) => ({ content: v, reason: this.reasonOf(this.sourceOf(ordered[i]!, fresh)), rankPosition: offset + i })),
        nextCursor: nextOffset < ids.length ? `${snapshotId}.${nextOffset}` : null,
        degraded: false,
      };
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      // Graceful degradation: ranking failure never breaks the feed (or the app).
      logger.error('[SocialFeed] ranking failed; serving chronological fallback', { error: err instanceof Error ? err.message : err });
      return this.chronological(userId, g, undefined, limit, true);
    }
  }

  /** Keyset pagination over (publishedAt, id) with the same per-item gate; bounded scan rounds. */
  private static async chronological(userId: string, g: ViewerGraph, cursor: string | undefined, limit: number, degraded: boolean): Promise<SocialFeedPage> {
    const or = this.sourceFilter(g, 'FOLLOWING');
    if (or.length === 0) return { items: [], nextCursor: null, degraded };
    const base = await this.baseWhere();
    let scan = decodeCursor(cursor);
    const picked: SocialContent[] = [];
    let nextCursor: string | null = null;

    for (let round = 0; round < 5 && picked.length < limit; round++) {
      const batchSize = limit * 2;
      const batch = await prisma.socialContent.findMany({
        where: {
          AND: [
            base,
            { OR: or },
            ...(scan ? [{ OR: [{ publishedAt: { lt: new Date(scan.t) } }, { publishedAt: new Date(scan.t), id: { lt: scan.id } }] }] : []),
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: batchSize,
      });
      nextCursor = null;
      for (const c of batch) {
        if (this.passes(c, g, userId)) picked.push(c);
        if (picked.length === limit) {
          // Resume right after the last item actually served.
          nextCursor = encodeCursor(c.publishedAt ?? c.createdAt, c.id);
          break;
        }
      }
      if (picked.length === limit || batch.length < batchSize) break;
      const last = batch[batch.length - 1]!;
      scan = { t: (last.publishedAt ?? last.createdAt).toISOString(), id: last.id };
      nextCursor = encodeCursor(last.publishedAt ?? last.createdAt, last.id);
    }

    const views = await SocialContentService.toViews(picked, userId);
    return {
      items: views.map((v, i) => ({ content: v, reason: this.reasonOf(this.sourceOf(picked[i]!, g)), rankPosition: i })),
      nextCursor,
      degraded,
    };
  }

  // ---------------------------------------------------------------------------
  // Feedback & fatigue
  // ---------------------------------------------------------------------------

  /** "Not interested" / "Show less" / "Hide" — these directly change ranking and filtering. */
  public static async recordFeedback(userId: string, input: SocialFeedFeedbackInput): Promise<{ ok: true }> {
    let targetId = input.target;
    if (input.targetType === 'AUTHOR') targetId = (await SocialProfileService.resolveOrThrow(input.target)).userId;
    else if (input.targetType === 'CHARACTER') {
      const ch = await prisma.character.findFirst({ where: { slug: input.target }, select: { id: true } });
      if (!ch) throw new NotFoundError('Character not found');
      targetId = ch.id;
    } else if (input.targetType === 'COMMUNITY') {
      const cm = await prisma.community.findFirst({ where: { slug: input.target }, select: { id: true } });
      if (!cm) throw new NotFoundError('Community not found');
      targetId = cm.id;
    } else if (input.targetType === 'TOPIC') targetId = input.target.toLowerCase().replace(/^#/, '');

    // Show-less decays (30 days); hide / not-interested persist until undone.
    const expiresAt = input.signal === 'SHOW_LESS' ? new Date(Date.now() + 30 * 86_400_000) : null;
    await prisma.socialFeedFeedback.upsert({
      where: { userId_targetType_targetId_signal: { userId, targetType: input.targetType, targetId, signal: input.signal } },
      create: { userId, targetType: input.targetType, targetId, signal: input.signal, expiresAt },
      update: { expiresAt, createdAt: new Date() },
    });
    await this.invalidate(userId);
    SocialEvents.emit('FeedItemDismissed', { actorUserId: userId, contentType: input.targetType, surface: 'feed', source: input.signal });
    return { ok: true };
  }

  /** Impressions feed fatigue (short-lived, decaying) — never a permanent preference. */
  public static async recordImpressions(userId: string, items: Array<{ contentId: string; position: number }>): Promise<{ recorded: number }> {
    const config = await SocialPolicyService.getConfig();
    const rows = await prisma.socialContent.findMany({ where: { publicId: { in: items.slice(0, 50).map((i) => i.contentId) } }, select: { publicId: true, authorUserId: true, characterId: true, communityId: true, topics: true, kind: true } });
    const key = `social:feed:exposure:${userId}`;
    try {
      const pipeline = redis.pipeline();
      for (const r of rows) {
        if (r.authorUserId) pipeline.hincrby(key, `author:${r.authorUserId}`, 1);
        if (r.characterId) pipeline.hincrby(key, `character:${r.characterId}`, 1);
        if (r.communityId) pipeline.hincrby(key, `community:${r.communityId}`, 1);
        for (const t of r.topics) pipeline.hincrby(key, `topic:${t}`, 1);
      }
      pipeline.expire(key, config.feed.fatigueHalfLifeHours * 3600);
      await pipeline.exec();
    } catch {
      // Fatigue is best-effort.
    }
    for (const it of items.slice(0, 50)) {
      const r = rows.find((x) => x.publicId === it.contentId);
      if (r) SocialEvents.emit('FeedItemImpression', { actorUserId: userId, contentId: r.publicId, contentType: r.kind, position: it.position, surface: 'feed' });
    }
    return { recorded: rows.length };
  }

  /** Drops cached rankings (O(5), no keyspace scans). Correctness never depends on this: pages are re-filtered on read. */
  public static async invalidate(userId: string): Promise<void> {
    try {
      const listKey = `social:feed:snapshots:${userId}`;
      const snapshots = await redis.lrange(listKey, 0, -1);
      const keys = snapshots.map((id) => `social:feed:ranked:${userId}:${id}`);
      await redis.del(listKey, ...keys);
    } catch {
      // Hydration-time filtering still guarantees correctness.
    }
  }

  private static registered = false;

  public static registerHandlers(): void {
    const onEvent = (event: SocialDomainEvent, handler: Parameters<typeof SocialEvents.on>[1]) => SocialEvents.on(event, handler, `feed:${event}`);
    if (this.registered) return;
    this.registered = true;
    onEvent('UserBlocked', async (p) => {
      if (p.actorUserId) await this.invalidate(p.actorUserId);
      if (p.recipientUserId) await this.invalidate(p.recipientUserId);
    });
    onEvent('UserMuted', async (p) => {
      if (p.actorUserId) await this.invalidate(p.actorUserId);
    });
  }
}
