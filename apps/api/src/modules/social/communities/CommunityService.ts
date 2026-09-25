import { Prisma, type Community, type CommunityMember } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { CommunityMemberView, CommunityView, SocialContentView, SocialCursorPage } from '@ai-companion/types';
import type { CommunityModerationInput, CreateCommunityInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { UsernameService } from '../identity/UsernameService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { SocialContentService } from '../content/SocialContentService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, keysetAfter, toPage } from '../shared/ids.js';

const NOT_FOUND = () => new NotFoundError('Community not found', ErrorCode.SOCIAL_COMMUNITY_NOT_FOUND);
type Tx = Prisma.TransactionClient;

export class CommunityService {
  // ---------------------------------------------------------------------------
  // Creation (permissioned)
  // ---------------------------------------------------------------------------

  public static async assertCanCreate(userId: string, characterLinked: boolean): Promise<void> {
    await SocialPolicyService.assertFeature('communities', { userId, cohorts: await SocialPolicyService.resolveCohorts(userId) });
    if (characterLinked) await SocialPolicyService.assertFeature('creator_communities', { userId, cohorts: await SocialPolicyService.resolveCohorts(userId) });
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'CREATE_COMMUNITY');
    const config = await SocialPolicyService.getConfig();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true, emailVerifiedAt: true } });
    const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
    if (ageDays < config.communities.minAccountAgeDays || !user.emailVerifiedAt) {
      throw new AppError('Your account is not yet eligible to create communities.', 403, ErrorCode.SOCIAL_NOT_ELIGIBLE);
    }
    if (config.communities.requireVerifiedCreator) {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId }, select: { status: true, verificationStatus: true } });
      if (!creator || creator.status !== 'ACTIVE' || creator.verificationStatus === 'UNVERIFIED') {
        throw new AppError('Community creation is currently limited to verified creators.', 403, ErrorCode.SOCIAL_NOT_ELIGIBLE);
      }
    }
    const owned = await prisma.community.count({ where: { ownerUserId: userId, deletedAt: null } });
    if (owned >= config.communities.maxOwnedCommunities) {
      throw new AppError(`You can own at most ${config.communities.maxOwnedCommunities} communities.`, 403, ErrorCode.SOCIAL_NOT_ELIGIBLE);
    }
  }

  public static async create(userId: string, input: CreateCommunityInput): Promise<CommunityView> {
    await this.assertCanCreate(userId, !!input.characterSlug);
    await SocialRateLimiter.enforce('community_create', userId);

    const slugCheck = UsernameService.validate(input.slug.replace(/-/g, '_'));
    if (!slugCheck.ok && slugCheck.reason !== 'INVALID') throw new BadRequestError('That community address is not allowed.');

    for (const [field, text] of [['name', input.name], ['description', input.description], ...input.rules.map((r) => ['rules', r] as const)] as const) {
      const e = SocialContentSafetyService.evaluateText(text, { surface: 'COMMUNITY', maxLinks: 1 });
      if (e.decision.action !== 'ALLOW' && e.decision.action !== 'ALLOW_WITH_LIMITS') throw new BadRequestError(`Please revise the community ${field}.`);
    }

    let characterId: string | null = null;
    if (input.characterSlug) {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId }, select: { id: true } });
      const ch = await prisma.character.findFirst({ where: { slug: input.characterSlug, creatorProfileId: creator?.id ?? '__none__', deletedAt: null }, select: { id: true } });
      if (!ch) throw new NotFoundError('Character not found');
      characterId = ch.id;
    }

    try {
      const community = await prisma.community.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          rules: input.rules,
          privacy: input.privacy,
          ownerUserId: userId,
          characterId,
          memberCount: 1,
          members: { create: { userId, role: 'OWNER', status: 'ACTIVE', rulesAcceptedAt: new Date() } },
        },
      });
      await AuditService.log({ actorType: 'USER', actorId: userId, action: 'COMMUNITY_CREATED', resourceType: 'community', resourceId: community.id, metadata: { slug: community.slug, privacy: community.privacy } });
      SocialEvents.emit('CommunityCreated', { actorUserId: userId, communityId: community.id });
      return this.toView(community, await this.membership(community.id, userId), true);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('That community address is taken.');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  private static async membership(communityId: string, userId: string | null): Promise<CommunityMember | null> {
    if (!userId) return null;
    return prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
  }

  /** Invite-only communities are invisible to non-members (indistinguishable from "does not exist"). */
  private static async loadVisible(viewerId: string | null, slug: string): Promise<{ community: Community; member: CommunityMember | null }> {
    const community = await prisma.community.findFirst({ where: { slug, deletedAt: null } });
    if (!community || community.status === 'SUSPENDED') throw NOT_FOUND();
    const member = await this.membership(community.id, viewerId);
    if (community.privacy === 'INVITE_ONLY' && (!member || !['ACTIVE', 'MUTED', 'INVITED'].includes(member.status))) throw NOT_FOUND();
    return { community, member };
  }

  public static async get(viewerId: string | null, slug: string): Promise<CommunityView> {
    const { community, member } = await this.loadVisible(viewerId, slug);
    const canView = (await SocialAccessService.canViewCommunityContent(viewerId, community.id)).allowed;
    return this.toView(community, member, canView);
  }

  public static async discover(viewerId: string | null, params: { q?: string; cursor?: string; limit: number }): Promise<SocialCursorPage<CommunityView>> {
    await SocialPolicyService.assertFeature('communities', { userId: viewerId });
    const mutedCommunities = viewerId ? (await RelationshipReader.mutedTargets(viewerId, 'POSTS')).communities : new Set<string>();
    const rows = await prisma.community.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        privacy: { in: ['PUBLIC', 'DISCOVERABLE_PRIVATE'] },
        ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
        ...(mutedCommunities.size ? { NOT: { id: { in: [...mutedCommunities] } } } : {}),
        ...keysetAfter(decodeCursor(params.cursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
    });
    const page = toPage(rows, params.limit, (r) => ({ at: r.createdAt, id: r.id }));
    const memberships = viewerId ? await prisma.communityMember.findMany({ where: { userId: viewerId, communityId: { in: page.items.map((c) => c.id) } } }) : [];
    return {
      items: page.items.map((c) => {
        const m = memberships.find((x) => x.communityId === c.id) ?? null;
        return this.toView(c, m, c.privacy === 'PUBLIC' || (!!m && ['ACTIVE', 'MUTED'].includes(m.status)));
      }),
      nextCursor: page.nextCursor,
    };
  }

  public static async listPosts(viewerId: string | null, slug: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialContentView>> {
    const { community } = await this.loadVisible(viewerId, slug);
    const access = await SocialAccessService.canViewCommunityContent(viewerId, community.id);
    if (!access.allowed) throw new ForbiddenError(access.userMessage ?? 'Join to see posts.', ErrorCode.SOCIAL_COMMUNITY_PRIVATE);
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const rows = await prisma.socialContent.findMany({
      where: {
        communityId: community.id,
        status: 'PUBLISHED',
        deletedAt: null,
        ...(hidden.size ? { NOT: { authorUserId: { in: [...hidden] } } } : {}),
        ...keysetAfter(decodeCursor(cursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    return { items: await SocialContentService.toViews(page.items, viewerId), nextCursor: page.nextCursor };
  }

  public static async listMembers(viewerId: string | null, slug: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<CommunityMemberView>> {
    const { community, member } = await this.loadVisible(viewerId, slug);
    const isMember = !!member && ['ACTIVE', 'MUTED'].includes(member.status);
    // Member lists of non-public communities are never exposed to non-members.
    if (community.privacy !== 'PUBLIC' && !isMember) throw new ForbiddenError('Only members can see who is in this community.', ErrorCode.SOCIAL_COMMUNITY_PRIVATE);
    const rows = await prisma.communityMember.findMany({
      where: { communityId: community.id, status: { in: ['ACTIVE', 'MUTED'] }, ...keysetAfter(decodeCursor(cursor), 'joinedAt') },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => ({ at: r.joinedAt, id: r.id }));
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const cards = await SocialProfileService.cards(page.items.map((m) => m.userId));
    return {
      items: page.items
        .filter((m) => !hidden.has(m.userId) && cards.get(m.userId))
        .map((m) => ({ user: cards.get(m.userId)!, role: m.role, status: m.status, joinedAt: m.joinedAt.toISOString() })),
      nextCursor: page.nextCursor,
    };
  }

  // ---------------------------------------------------------------------------
  // Membership
  // ---------------------------------------------------------------------------

  private static async activate(tx: Tx, communityId: string, userId: string, data: Partial<CommunityMember>): Promise<void> {
    await tx.communityMember.upsert({
      where: { communityId_userId: { communityId, userId } },
      create: { communityId, userId, role: 'MEMBER', status: 'ACTIVE', rulesAcceptedAt: new Date(), ...data },
      update: { status: 'ACTIVE', rulesAcceptedAt: new Date(), ...data },
    });
    await tx.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
  }

  /** Rules must be accepted before joining (enforced by the request schema and recorded here). */
  public static async join(userId: string, slug: string): Promise<CommunityView> {
    await SocialPolicyService.assertFeature('communities', { userId });
    await SocialProfileService.requireOwnProfile(userId);
    await SocialAbuseService.assertCapability(userId, 'ANY');
    await SocialRateLimiter.enforce('community_join', userId);
    const community = await prisma.community.findFirst({ where: { slug, deletedAt: null, status: 'ACTIVE' } });
    if (!community) throw NOT_FOUND();
    const member = await this.membership(community.id, userId);
    if (member?.status === 'BANNED') throw new ForbiddenError("You can't join this community.", ErrorCode.SOCIAL_COMMUNITY_BANNED);
    if (member && ['ACTIVE', 'MUTED'].includes(member.status)) return this.get(userId, slug);
    if (community.privacy === 'INVITE_ONLY' && member?.status !== 'INVITED') throw NOT_FOUND();

    if (community.privacy === 'DISCOVERABLE_PRIVATE' && member?.status !== 'INVITED') {
      await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId } },
        create: { communityId: community.id, userId, status: 'PENDING', rulesAcceptedAt: new Date() },
        update: { status: 'PENDING', rulesAcceptedAt: new Date() },
      });
      return this.get(userId, slug);
    }

    const eventId = await prisma.$transaction(async (tx) => {
      // Re-read under the transaction so concurrent joins can't double count or double-announce.
      const current = await tx.communityMember.findUnique({ where: { communityId_userId: { communityId: community.id, userId } } });
      if (current && ['ACTIVE', 'MUTED'].includes(current.status)) return null;
      await this.activate(tx, community.id, userId, {});
      return SocialEvents.record(tx, 'CommunityJoined', { actorUserId: userId, communityId: community.id, source: community.privacy });
    });
    SocialEvents.kickAfterCommit([eventId]);
    return this.get(userId, slug);
  }

  public static async leave(userId: string, slug: string): Promise<{ left: boolean }> {
    const community = await prisma.community.findFirst({ where: { slug, deletedAt: null } });
    if (!community) throw NOT_FOUND();
    const member = await this.membership(community.id, userId);
    if (!member || !['ACTIVE', 'MUTED', 'PENDING', 'INVITED'].includes(member.status)) return { left: false };
    if (member.role === 'OWNER') throw new BadRequestError('Transfer ownership before leaving your community.');
    await prisma.$transaction(async (tx) => {
      const res = await tx.communityMember.updateMany({ where: { id: member.id, status: { in: ['ACTIVE', 'MUTED'] } }, data: { status: 'LEFT', role: 'MEMBER' } });
      if (res.count === 1) await tx.community.update({ where: { id: community.id }, data: { memberCount: { decrement: 1 } } });
      else await tx.communityMember.update({ where: { id: member.id }, data: { status: 'LEFT' } });
    });
    return { left: true };
  }

  public static async invite(inviterId: string, slug: string, targetHandle: string): Promise<{ invited: boolean }> {
    const { community, member } = await this.loadVisible(inviterId, slug);
    if (!member || member.status !== 'ACTIVE') throw new ForbiddenError('Only members can invite people.');
    if (community.privacy === 'INVITE_ONLY' && member.role === 'MEMBER') throw new ForbiddenError('Only moderators can invite people to this community.');
    const target = await SocialProfileService.resolveOrThrow(targetHandle);
    const access = await SocialAccessService.canInviteToCommunity(inviterId, target.userId);
    if (!access.allowed) {
      if (access.reason === 'BLOCKED') throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
      throw new ForbiddenError(access.userMessage ?? "This person isn't accepting invitations.");
    }
    const existing = await this.membership(community.id, target.userId);
    if (existing && ['ACTIVE', 'MUTED', 'BANNED', 'INVITED'].includes(existing.status)) return { invited: existing.status === 'INVITED' };
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: target.userId } },
      create: { communityId: community.id, userId: target.userId, status: 'INVITED', invitedByUserId: inviterId },
      update: { status: 'INVITED', invitedByUserId: inviterId },
    });
    SocialEvents.emit('CommunityInvited', { actorUserId: inviterId, recipientUserId: target.userId, communityId: community.id, internal: { slug: community.slug, name: community.name } });
    return { invited: true };
  }

  public static async listJoinRequests(actorId: string, slug: string): Promise<CommunityMemberView[]> {
    const { community } = await this.loadVisible(actorId, slug);
    await this.requireRole(community.id, actorId, ['OWNER', 'MODERATOR']);
    const rows = await prisma.communityMember.findMany({ where: { communityId: community.id, status: 'PENDING' }, orderBy: { joinedAt: 'asc' }, take: 100 });
    const cards = await SocialProfileService.cards(rows.map((r) => r.userId));
    return rows.filter((r) => cards.get(r.userId)).map((r) => ({ user: cards.get(r.userId)!, role: r.role, status: r.status, joinedAt: r.joinedAt.toISOString() }));
  }

  public static async respondToJoinRequest(actorId: string, slug: string, targetHandle: string, approve: boolean): Promise<{ status: string }> {
    const { community } = await this.loadVisible(actorId, slug);
    await this.requireRole(community.id, actorId, ['OWNER', 'MODERATOR']);
    const target = await SocialProfileService.resolveOrThrow(targetHandle);
    const pending = await this.membership(community.id, target.userId);
    if (!pending || pending.status !== 'PENDING') throw new NotFoundError('Request not found');
    if (!approve) {
      await prisma.communityMember.update({ where: { id: pending.id }, data: { status: 'LEFT' } });
      return { status: 'DECLINED' };
    }
    await prisma.$transaction(async (tx) => this.activate(tx, community.id, target.userId, {}));
    SocialEvents.emit('CommunityJoined', { actorUserId: target.userId, communityId: community.id, source: 'approved' });
    return { status: 'ACTIVE' };
  }

  // ---------------------------------------------------------------------------
  // Community moderation (role-checked, always audited)
  // ---------------------------------------------------------------------------

  private static async requireRole(communityId: string, userId: string, roles: Array<CommunityMember['role']>): Promise<CommunityMember> {
    const m = await this.membership(communityId, userId);
    if (!m || m.status !== 'ACTIVE' || !roles.includes(m.role)) throw new ForbiddenError('You need moderator permissions for this.');
    return m;
  }

  public static async moderate(actorId: string, slug: string, input: CommunityModerationInput): Promise<{ ok: true }> {
    await SocialAbuseService.assertCapability(actorId, 'ANY');
    const { community } = await this.loadVisible(actorId, slug);
    const actor = await this.requireRole(community.id, actorId, ['OWNER', 'MODERATOR']);
    const until = input.durationHours ? new Date(Date.now() + input.durationHours * 3_600_000) : null;

    if (input.action === 'REMOVE_POST') {
      const res = await prisma.socialContent.updateMany({ where: { publicId: input.target, communityId: community.id, deletedAt: null }, data: { status: 'HIDDEN' } });
      if (res.count === 0) throw new NotFoundError('Post not found');
      SocialEvents.emit('ContentRemoved', { contentId: input.target, communityId: community.id, source: 'community_moderation' });
    } else if (input.action === 'REMOVE_COMMENT') {
      const cm = await prisma.socialComment.findUnique({ where: { id: input.target }, include: { content: { select: { communityId: true, id: true } } } });
      if (!cm || cm.content.communityId !== community.id) throw new NotFoundError('Comment not found');
      await prisma.$transaction(async (tx) => {
        const res = await tx.socialComment.updateMany({ where: { id: cm.id, status: 'PUBLISHED' }, data: { status: 'REMOVED' } });
        if (res.count === 1) {
          await tx.socialContent.update({ where: { id: cm.content.id }, data: { commentCount: { decrement: 1 } } });
          if (cm.parentId) await tx.socialComment.update({ where: { id: cm.parentId }, data: { replyCount: { decrement: 1 } } });
        }
      });
    } else {
      const target = await SocialProfileService.resolveOrThrow(input.target);
      const tm = await this.membership(community.id, target.userId);
      if (!tm) throw new NotFoundError('Member not found');
      if (tm.role === 'OWNER') throw new ForbiddenError("The owner can't be moderated.");
      if (tm.role === 'MODERATOR' && actor.role !== 'OWNER') throw new ForbiddenError('Only the owner can act on moderators.');
      if ((input.action === 'PROMOTE_MODERATOR' || input.action === 'DEMOTE_MODERATOR') && actor.role !== 'OWNER') throw new ForbiddenError('Only the owner can change moderators.');

      await prisma.$transaction(async (tx) => {
        switch (input.action) {
          case 'MUTE_MEMBER':
            await tx.communityMember.update({ where: { id: tm.id }, data: { status: 'MUTED', restrictedUntil: until } });
            break;
          case 'RESTRICT_MEMBER':
            await tx.communityMember.update({ where: { id: tm.id }, data: { restrictedUntil: until ?? new Date(Date.now() + 24 * 3_600_000) } });
            break;
          case 'BAN_MEMBER': {
            const wasCounted = ['ACTIVE', 'MUTED'].includes(tm.status);
            await tx.communityMember.update({ where: { id: tm.id }, data: { status: 'BANNED', role: 'MEMBER', restrictedUntil: until } });
            if (wasCounted) await tx.community.update({ where: { id: community.id }, data: { memberCount: { decrement: 1 } } });
            break;
          }
          case 'UNBAN_MEMBER':
            if (tm.status === 'BANNED') await tx.communityMember.update({ where: { id: tm.id }, data: { status: 'LEFT', restrictedUntil: null } });
            break;
          case 'PROMOTE_MODERATOR':
            if (tm.status !== 'ACTIVE') throw new BadRequestError('Only active members can become moderators.');
            await tx.communityMember.update({ where: { id: tm.id }, data: { role: 'MODERATOR' } });
            break;
          case 'DEMOTE_MODERATOR':
            await tx.communityMember.update({ where: { id: tm.id }, data: { role: 'MEMBER' } });
            break;
        }
      });
    }

    await SocialModerationService.recordAction({
      scope: 'COMMUNITY',
      communityId: community.id,
      actorType: 'USER',
      actorId,
      action: input.action,
      targetType: input.action.endsWith('POST') ? 'CONTENT' : input.action.endsWith('COMMENT') ? 'COMMENT' : 'MEMBER',
      targetId: input.target,
      reason: input.reason,
      notes: input.notes ?? null,
      expiresAt: until,
    });
    await AuditService.log({ actorType: 'USER', actorId, action: `COMMUNITY_${input.action}`, resourceType: 'community', resourceId: community.id, metadata: { target: input.target, reason: input.reason } });
    return { ok: true };
  }

  public static async moderationLog(actorId: string, slug: string, limit = 50) {
    const { community } = await this.loadVisible(actorId, slug);
    await this.requireRole(community.id, actorId, ['OWNER', 'MODERATOR']);
    const rows = await prisma.socialModerationAction.findMany({ where: { communityId: community.id }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map((r) => ({ action: r.action, targetType: r.targetType, target: r.targetId, reason: r.reason, notes: r.notes, expiresAt: r.expiresAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
  }

  /** Aggregate analytics for moderators (no individual private data). */
  public static async analytics(actorId: string, slug: string) {
    const { community } = await this.loadVisible(actorId, slug);
    await this.requireRole(community.id, actorId, ['OWNER', 'MODERATOR']);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [members, joins30d, posts30d, comments30d, reports30d, actions30d, banned, activePosters] = await Promise.all([
      prisma.communityMember.count({ where: { communityId: community.id, status: { in: ['ACTIVE', 'MUTED'] } } }),
      prisma.communityMember.count({ where: { communityId: community.id, joinedAt: { gte: since } } }),
      prisma.socialContent.count({ where: { communityId: community.id, createdAt: { gte: since } } }),
      prisma.socialComment.count({ where: { content: { communityId: community.id }, createdAt: { gte: since } } }),
      prisma.socialReport.count({ where: { createdAt: { gte: since }, OR: [{ targetType: 'COMMUNITY', targetId: community.id }] } }),
      prisma.socialModerationAction.count({ where: { communityId: community.id, createdAt: { gte: since } } }),
      prisma.communityMember.count({ where: { communityId: community.id, status: 'BANNED' } }),
      prisma.socialContent.groupBy({ by: ['authorUserId'], where: { communityId: community.id, createdAt: { gte: since } } }),
    ]);
    return { members, activeMembers30d: activePosters.length, joins30d, posts30d, comments30d, reports30d, moderationActions30d: actions30d, bannedMembers: banned };
  }

  public static toView(c: Community, member: CommunityMember | null, canViewContent: boolean): CommunityView {
    return {
      slug: c.slug,
      name: c.name,
      description: c.description,
      rules: (c.rules as string[]) ?? [],
      privacy: c.privacy,
      status: c.status,
      memberCount: c.memberCount,
      character: null,
      viewerMembership: member ? { role: member.role, status: member.status } : null,
      canViewContent,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
