import { Prisma, type SocialMuteScope, type SocialMuteTargetType } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { CharacterFollowState, SocialCursorPage, SocialFollowStatus, SocialMuteItem, SocialUserCard } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, keysetAfter, toPage } from '../shared/ids.js';
import { RelationshipReader } from './RelationshipReader.js';

type Tx = Prisma.TransactionClient;

const NOTIFICATION_CATEGORIES = ['new_follower', 'follow_request', 'reaction', 'comment', 'mention', 'community', 'message_request', 'creator_update', 'character_update'];

export class SocialGraphService {
  // ---------------------------------------------------------------------------
  // Follow
  // ---------------------------------------------------------------------------

  /** Idempotent. Returns the resulting status (ACTIVE or PENDING request). */
  public static async follow(followerId: string, targetHandle: string): Promise<{ status: SocialFollowStatus }> {
    await SocialPolicyService.assertFeature('user_following', { userId: followerId });
    await SocialProfileService.requireOwnProfile(followerId);
    await SocialAbuseService.assertCapability(followerId, 'ANY');
    const target = await SocialProfileService.resolveOrThrow(targetHandle);

    const decision = await SocialAccessService.canFollow(followerId, target.userId);
    if (!decision.allowed) {
      if (decision.reason === 'BLOCKED' || decision.reason === 'NO_PROFILE') throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
      throw new ForbiddenError(decision.userMessage ?? 'Unable to follow', ErrorCode.SOCIAL_PRIVACY_RESTRICTED);
    }
    const desired: SocialFollowStatus = decision.requiresApproval ? 'PENDING' : 'ACTIVE';

    let created = false;
    let eventId: string | null = null;
    try {
      created = await prisma.$transaction(async (tx) => {
        await this.lockPair(tx, followerId, target.userId);
        // Re-check under the pair lock: a concurrent block must win over a concurrent follow.
        const blocked = await tx.userBlock.count({
          where: { OR: [{ userId: followerId, blockedUserId: target.userId }, { userId: target.userId, blockedUserId: followerId }] },
        });
        if (blocked > 0) throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
        const existing = await tx.userFollow.findUnique({
          where: { followerUserId_followedUserId: { followerUserId: followerId, followedUserId: target.userId } },
          select: { status: true },
        });
        if (existing) return false;
        await tx.userFollow.create({
          data: { followerUserId: followerId, followedUserId: target.userId, status: desired, acceptedAt: desired === 'ACTIVE' ? new Date() : null },
        });
        if (desired === 'ACTIVE') await this.applyFollowCounters(tx, followerId, target.userId, +1);
        eventId = await SocialEvents.record(tx, desired === 'ACTIVE' ? 'UserFollowed' : 'FollowRequested', { actorUserId: followerId, recipientUserId: target.userId, surface: 'profile' });
        return true;
      });
    } catch (err) {
      // Concurrent duplicate follow lost the unique race: the other request already created it.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }

    const current = await prisma.userFollow.findUniqueOrThrow({
      where: { followerUserId_followedUserId: { followerUserId: followerId, followedUserId: target.userId } },
      select: { status: true },
    });

    if (created) {
      if (current.status === 'ACTIVE') await this.syncCreatorFollow(followerId, target.userId, true);
      if (await SocialAbuseService.recordFollowToggle(followerId, target.userId)) await SocialAbuseService.escalateIfNeeded(followerId, 'FOLLOW_CYCLING');
      SocialEvents.kickAfterCommit([eventId]);
    }
    return { status: current.status };
  }

  /** Idempotent. Removes an active follow or withdraws a pending request. */
  public static async unfollow(followerId: string, targetHandle: string): Promise<{ removed: boolean }> {
    const target = await SocialProfileService.resolve(targetHandle);
    if (!target) return { removed: false };
    const removed = await prisma.$transaction(async (tx) => {
      const r = await this.removeFollowInTx(tx, followerId, target.userId);
      const eventId = r.wasActive ? await SocialEvents.record(tx, 'UserUnfollowed', { actorUserId: followerId, recipientUserId: target.userId }) : null;
      return { ...r, eventId };
    });
    if (removed.wasActive) {
      await this.syncCreatorFollow(followerId, target.userId, false);
      await SocialAbuseService.recordFollowToggle(followerId, target.userId);
      SocialEvents.kickAfterCommit([removed.eventId]);
    }
    return { removed: removed.removed };
  }

  /** Owner removes someone from their followers (soft-block alternative). */
  public static async removeFollower(ownerId: string, followerHandle: string): Promise<{ removed: boolean }> {
    const follower = await SocialProfileService.resolve(followerHandle);
    if (!follower) return { removed: false };
    const removed = await prisma.$transaction(async (tx) => this.removeFollowInTx(tx, follower.userId, ownerId));
    if (removed.wasActive) await this.syncCreatorFollow(follower.userId, ownerId, false);
    return { removed: removed.removed };
  }

  public static async respondToFollowRequest(ownerId: string, requesterHandle: string, action: 'ACCEPT' | 'DECLINE'): Promise<{ status: SocialFollowStatus | null }> {
    const requester = await SocialProfileService.resolveOrThrow(requesterHandle);
    if (action === 'DECLINE') {
      await prisma.userFollow.deleteMany({ where: { followerUserId: requester.userId, followedUserId: ownerId, status: 'PENDING' } });
      return { status: null };
    }
    // Re-check blocks at acceptance time (a block may have happened after the request).
    if (await RelationshipReader.hasBlockEitherWay(ownerId, requester.userId)) {
      await prisma.userFollow.deleteMany({ where: { followerUserId: requester.userId, followedUserId: ownerId } });
      return { status: null };
    }
    const accepted = await prisma.$transaction(async (tx) => {
      await this.lockPair(tx, ownerId, requester.userId);
      const blocked = await tx.userBlock.count({
        where: { OR: [{ userId: ownerId, blockedUserId: requester.userId }, { userId: requester.userId, blockedUserId: ownerId }] },
      });
      if (blocked > 0) return false;
      const res = await tx.userFollow.updateMany({
        where: { followerUserId: requester.userId, followedUserId: ownerId, status: 'PENDING' },
        data: { status: 'ACTIVE', acceptedAt: new Date() },
      });
      if (res.count === 1) await this.applyFollowCounters(tx, requester.userId, ownerId, +1);
      return res.count === 1;
    });
    if (accepted) {
      await this.syncCreatorFollow(requester.userId, ownerId, true);
      SocialEvents.emit('FollowAccepted', { actorUserId: ownerId, recipientUserId: requester.userId });
    }
    const row = await prisma.userFollow.findUnique({
      where: { followerUserId_followedUserId: { followerUserId: requester.userId, followedUserId: ownerId } },
      select: { status: true },
    });
    return { status: row?.status ?? null };
  }

  /**
   * Serializes graph writes for a pair of users (follow vs block vs accept) by locking both
   * profile rows in a deterministic order, preventing deadlocks and check-then-act races.
   */
  private static async lockPair(tx: Tx, a: string, b: string): Promise<void> {
    const [first, second] = a < b ? [a, b] : [b, a];
    await tx.$queryRaw`SELECT user_id FROM social_profiles WHERE user_id IN (${first}::uuid, ${second}::uuid) ORDER BY user_id FOR UPDATE`;
  }

  private static async removeFollowInTx(tx: Tx, followerId: string, followedId: string): Promise<{ removed: boolean; wasActive: boolean }> {
    const active = await tx.userFollow.deleteMany({ where: { followerUserId: followerId, followedUserId: followedId, status: 'ACTIVE' } });
    if (active.count === 1) {
      await this.applyFollowCounters(tx, followerId, followedId, -1);
      return { removed: true, wasActive: true };
    }
    const pending = await tx.userFollow.deleteMany({ where: { followerUserId: followerId, followedUserId: followedId, status: 'PENDING' } });
    return { removed: pending.count > 0, wasActive: false };
  }

  /** Counter updates happen only inside the transaction that changed the edge, so concurrency can't double count. */
  private static async applyFollowCounters(tx: Tx, followerId: string, followedId: string, delta: 1 | -1): Promise<void> {
    await tx.socialProfile.updateMany({ where: { userId: followedId }, data: { followersCount: { increment: delta } } });
    await tx.socialProfile.updateMany({ where: { userId: followerId }, data: { followingCount: { increment: delta } } });
  }

  /** Following a creator's person profile also joins their creator audience (existing CreatorFollow). */
  private static async syncCreatorFollow(followerId: string, targetUserId: string, following: boolean): Promise<void> {
    try {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId: targetUserId }, select: { id: true, status: true } });
      if (!creator) return;
      if (following && creator.status === 'ACTIVE') {
        await prisma.creatorFollow.upsert({
          where: { userId_creatorProfileId: { userId: followerId, creatorProfileId: creator.id } },
          create: { userId: followerId, creatorProfileId: creator.id },
          update: {},
        });
      } else if (!following) {
        await prisma.creatorFollow.deleteMany({ where: { userId: followerId, creatorProfileId: creator.id } });
      }
      const count = await prisma.creatorFollow.count({ where: { creatorProfileId: creator.id } });
      await prisma.creatorProfile.update({ where: { id: creator.id }, data: { totalFollowersCount: count } });
    } catch (err) {
      logger.warn('[SocialGraph] creator follow sync failed (will reconcile)', { error: err });
    }
  }

  /** Periodic reconciliation: recompute denormalized counters from the source-of-truth edges. */
  public static async reconcileCounters(userIds?: string[]): Promise<number> {
    const whereUsers = userIds?.length ? Prisma.sql`WHERE sp.user_id = ANY(${userIds}::uuid[])` : Prisma.empty;
    const updated = await prisma.$executeRaw`
      UPDATE social_profiles sp SET
        followers_count = (SELECT COUNT(*) FROM user_follows f WHERE f.followed_user_id = sp.user_id AND f.status = 'ACTIVE'),
        following_count = (SELECT COUNT(*) FROM user_follows f WHERE f.follower_user_id = sp.user_id AND f.status = 'ACTIVE')
      ${whereUsers}`;
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Lists (cursor paginated, privacy + block filtered)
  // ---------------------------------------------------------------------------

  public static async listFollows(
    viewerId: string | null,
    ownerHandle: string,
    direction: 'followers' | 'following',
    cursor: string | undefined,
    limit: number,
  ): Promise<SocialCursorPage<SocialUserCard>> {
    const owner = await SocialProfileService.resolveOrThrow(ownerHandle);
    const access = await SocialAccessService.canViewFollowList(viewerId, owner.userId);
    if (!access.allowed) {
      if (access.reason === 'PROFILE_NOT_VISIBLE') throw new NotFoundError('Profile not found', ErrorCode.SOCIAL_USER_NOT_FOUND);
      throw new ForbiddenError(access.userMessage ?? 'This list is private.', ErrorCode.SOCIAL_PRIVACY_RESTRICTED);
    }
    const c = decodeCursor(cursor);
    const rows = await prisma.userFollow.findMany({
      where: {
        status: 'ACTIVE',
        ...(direction === 'followers' ? { followedUserId: owner.userId } : { followerUserId: owner.userId }),
        ...keysetAfter(c),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, createdAt: true, followerUserId: true, followedUserId: true },
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    const ids = page.items.map((r) => (direction === 'followers' ? r.followerUserId : r.followedUserId));
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const cards = await SocialProfileService.cards(ids);
    return {
      items: ids.filter((id) => !hidden.has(id)).map((id) => cards.get(id)).filter((x): x is SocialUserCard => !!x),
      nextCursor: page.nextCursor,
    };
  }

  public static async listIncomingRequests(ownerId: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialUserCard>> {
    const rows = await prisma.userFollow.findMany({
      where: { followedUserId: ownerId, status: 'PENDING', ...keysetAfter(decodeCursor(cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, createdAt: true, followerUserId: true },
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    const cards = await SocialProfileService.cards(page.items.map((r) => r.followerUserId));
    return { items: page.items.map((r) => cards.get(r.followerUserId)).filter((x): x is SocialUserCard => !!x), nextCursor: page.nextCursor };
  }

  // ---------------------------------------------------------------------------
  // Block (strong, bidirectional in effect, transactional)
  // ---------------------------------------------------------------------------

  public static async block(blockerId: string, targetHandle: string, reason?: string): Promise<{ blocked: true }> {
    const target = await SocialProfileService.resolveOrThrow(targetHandle);
    if (target.userId === blockerId) throw new BadRequestError("You can't block yourself.");

    const severed = await prisma.$transaction(async (tx) => {
      await this.lockPair(tx, blockerId, target.userId);
      await tx.userBlock.upsert({
        where: { userId_blockedUserId: { userId: blockerId, blockedUserId: target.userId } },
        create: { userId: blockerId, blockedUserId: target.userId, reason: reason ?? null },
        update: {},
      });
      const a = await this.removeFollowInTx(tx, blockerId, target.userId);
      const b = await this.removeFollowInTx(tx, target.userId, blockerId);
      // Pending message requests in either direction are closed; the thread becomes unusable.
      await tx.socialMessageRequest.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { senderUserId: blockerId, recipientUserId: target.userId },
            { senderUserId: target.userId, recipientUserId: blockerId },
          ],
        },
        data: { status: 'BLOCKED', pendingKey: null, respondedAt: new Date() },
      });
      // Outstanding community invitations between the two are withdrawn.
      await tx.communityMember.deleteMany({
        where: { status: 'INVITED', OR: [{ userId: target.userId, invitedByUserId: blockerId }, { userId: blockerId, invitedByUserId: target.userId }] },
      });
      const eventId = await SocialEvents.record(tx, 'UserBlocked', { actorUserId: blockerId, recipientUserId: target.userId });
      return { a: a.wasActive, b: b.wasActive, eventId };
    });

    if (severed.a) await this.syncCreatorFollow(blockerId, target.userId, false);
    if (severed.b) await this.syncCreatorFollow(target.userId, blockerId, false);

    await AuditService.log({ actorType: 'USER', actorId: blockerId, action: 'SOCIAL_USER_BLOCKED', resourceType: 'user_block', resourceId: target.userId });
    SocialEvents.kickAfterCommit([severed.eventId]);
    return { blocked: true };
  }

  /** Blocks are removed by the blocker only; previous follows are NOT restored. */
  public static async unblock(blockerId: string, targetHandle: string): Promise<{ unblocked: boolean }> {
    const target = await SocialProfileService.resolve(targetHandle);
    if (!target) return { unblocked: false };
    const { count, eventId } = await prisma.$transaction(async (tx) => {
      const res = await tx.userBlock.deleteMany({ where: { userId: blockerId, blockedUserId: target.userId } });
      return { count: res.count, eventId: res.count > 0 ? await SocialEvents.record(tx, 'UserUnblocked', { actorUserId: blockerId, recipientUserId: target.userId }) : null };
    });
    if (count > 0) {
      await AuditService.log({ actorType: 'USER', actorId: blockerId, action: 'SOCIAL_USER_UNBLOCKED', resourceType: 'user_block', resourceId: target.userId });
      SocialEvents.kickAfterCommit([eventId]);
    }
    const res = { count };
    return { unblocked: res.count > 0 };
  }

  public static async listBlocked(blockerId: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialUserCard>> {
    const rows = await prisma.userBlock.findMany({
      where: { userId: blockerId, blockedUserId: { not: null }, ...keysetAfter(decodeCursor(cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, createdAt: true, blockedUserId: true },
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    const cards = await SocialProfileService.cards(page.items.map((r) => r.blockedUserId));
    return { items: page.items.map((r) => cards.get(r.blockedUserId!)).filter((x): x is SocialUserCard => !!x), nextCursor: page.nextCursor };
  }

  // ---------------------------------------------------------------------------
  // Mute (softer than block: hides content/notifications for the muter only)
  // ---------------------------------------------------------------------------

  private static async resolveMuteTarget(targetType: SocialMuteTargetType, target: string): Promise<{ id: string; display: string }> {
    switch (targetType) {
      case 'USER':
      case 'CREATOR': {
        const u = await SocialProfileService.resolveOrThrow(target);
        return { id: u.userId, display: u.publicId };
      }
      case 'CHARACTER': {
        const c = await prisma.character.findFirst({ where: { slug: target, deletedAt: null }, select: { id: true, slug: true } });
        if (!c) throw new NotFoundError('Character not found');
        return { id: c.id, display: c.slug };
      }
      case 'COMMUNITY': {
        const c = await prisma.community.findFirst({ where: { slug: target, deletedAt: null }, select: { id: true, slug: true } });
        if (!c) throw new NotFoundError('Community not found');
        return { id: c.id, display: c.slug };
      }
      case 'TOPIC': {
        const topic = target.trim().toLowerCase().replace(/^#/, '');
        if (!/^[\p{L}\p{N}_-]{2,40}$/u.test(topic)) throw new BadRequestError('Invalid topic');
        return { id: topic, display: topic };
      }
      case 'NOTIFICATION_CATEGORY':
        if (!NOTIFICATION_CATEGORIES.includes(target)) throw new BadRequestError('Unknown notification category');
        return { id: target, display: target };
      default:
        throw new BadRequestError('Unsupported mute target');
    }
  }

  public static async mute(userId: string, input: { targetType: SocialMuteTargetType; target: string; scope: SocialMuteScope; durationHours?: number }): Promise<SocialMuteItem> {
    const t = await this.resolveMuteTarget(input.targetType, input.target);
    if ((input.targetType === 'USER' || input.targetType === 'CREATOR') && t.id === userId) throw new BadRequestError("You can't mute yourself.");
    const expiresAt = input.durationHours ? new Date(Date.now() + input.durationHours * 3_600_000) : null;
    const row = await prisma.userMute.upsert({
      where: { userId_targetType_targetId_scope: { userId, targetType: input.targetType, targetId: t.id, scope: input.scope } },
      create: { userId, targetType: input.targetType, targetId: t.id, scope: input.scope, expiresAt },
      update: { expiresAt },
    });
    SocialEvents.emit('UserMuted', { actorUserId: userId, surface: input.targetType.toLowerCase() });
    return { targetType: row.targetType, target: t.display, scope: row.scope, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() };
  }

  public static async unmute(userId: string, input: { targetType: SocialMuteTargetType; target: string; scope?: SocialMuteScope }): Promise<{ removed: number }> {
    const t = await this.resolveMuteTarget(input.targetType, input.target);
    const res = await prisma.userMute.deleteMany({ where: { userId, targetType: input.targetType, targetId: t.id, ...(input.scope ? { scope: input.scope } : {}) } });
    return { removed: res.count };
  }

  public static async listMutes(userId: string): Promise<SocialMuteItem[]> {
    const rows = await prisma.userMute.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const userIds = rows.filter((r) => r.targetType === 'USER' || r.targetType === 'CREATOR').map((r) => r.targetId);
    const charIds = rows.filter((r) => r.targetType === 'CHARACTER').map((r) => r.targetId);
    const commIds = rows.filter((r) => r.targetType === 'COMMUNITY').map((r) => r.targetId);
    const [cards, chars, comms] = await Promise.all([
      SocialProfileService.cards(userIds),
      prisma.character.findMany({ where: { id: { in: charIds } }, select: { id: true, slug: true } }),
      prisma.community.findMany({ where: { id: { in: commIds } }, select: { id: true, slug: true } }),
    ]);
    const display = (r: (typeof rows)[number]): string | null => {
      if (r.targetType === 'USER' || r.targetType === 'CREATOR') return cards.get(r.targetId)?.publicId ?? null;
      if (r.targetType === 'CHARACTER') return chars.find((c) => c.id === r.targetId)?.slug ?? null;
      if (r.targetType === 'COMMUNITY') return comms.find((c) => c.id === r.targetId)?.slug ?? null;
      return r.targetId;
    };
    return rows
      .map((r) => ({ r, d: display(r) }))
      .filter((x): x is { r: (typeof rows)[number]; d: string } => !!x.d)
      .map(({ r, d }) => ({ targetType: r.targetType, target: d, scope: r.scope, expiresAt: r.expiresAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
  }

  // ---------------------------------------------------------------------------
  // Character follow (distinct from favorite and from chatting)
  // ---------------------------------------------------------------------------

  private static async followableCharacter(userId: string, slug: string) {
    const character = await prisma.character.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'UNLISTED'] } },
      select: { id: true, slug: true },
    });
    if (!character) throw new NotFoundError('Character not found');
    const blocked = await prisma.userBlock.count({ where: { userId, blockedCharacterId: character.id } });
    if (blocked > 0) throw new NotFoundError('Character not found');
    return character;
  }

  public static async followCharacter(userId: string, slug: string, notificationsEnabled: boolean): Promise<CharacterFollowState> {
    await SocialPolicyService.assertFeature('character_following', { userId });
    await SocialAbuseService.assertCapability(userId, 'ANY');
    const character = await this.followableCharacter(userId, slug);
    const existing = await prisma.characterFollow.findUnique({ where: { userId_characterId: { userId, characterId: character.id } }, select: { id: true } });
    await prisma.characterFollow.upsert({
      where: { userId_characterId: { userId, characterId: character.id } },
      create: { userId, characterId: character.id, notificationsEnabled },
      update: { notificationsEnabled },
    });
    if (!existing) SocialEvents.emit('CharacterFollowed', { actorUserId: userId, characterId: character.id, surface: 'character_page' });
    return this.characterFollowState(userId, slug);
  }

  public static async unfollowCharacter(userId: string, slug: string): Promise<CharacterFollowState> {
    const character = await prisma.character.findFirst({ where: { slug }, select: { id: true } });
    if (character) await prisma.characterFollow.deleteMany({ where: { userId, characterId: character.id } });
    return this.characterFollowState(userId, slug);
  }

  public static async characterFollowState(userId: string | null, slug: string): Promise<CharacterFollowState> {
    const character = await prisma.character.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!character) throw new NotFoundError('Character not found');
    const [row, followerCount] = await Promise.all([
      userId ? prisma.characterFollow.findUnique({ where: { userId_characterId: { userId, characterId: character.id } } }) : null,
      prisma.characterFollow.count({ where: { characterId: character.id } }),
    ]);
    return { characterSlug: slug, following: !!row, notificationsEnabled: row?.notificationsEnabled ?? false, followerCount };
  }

  public static async listFollowedCharacters(userId: string, cursor: string | undefined, limit: number) {
    const rows = await prisma.characterFollow.findMany({
      where: { userId, character: { deletedAt: null }, ...keysetAfter(decodeCursor(cursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, createdAt: true, notificationsEnabled: true, character: { select: { slug: true, name: true, avatarUrl: true } } },
    });
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));
    return {
      items: page.items.map((r) => ({ slug: r.character.slug, name: r.character.name, avatarUrl: r.character.avatarUrl, isAi: true as const, notificationsEnabled: r.notificationsEnabled })),
      nextCursor: page.nextCursor,
    };
  }

  /** Guard helper for other services. */
  public static async assertNotBlocked(a: string, b: string): Promise<void> {
    if (await RelationshipReader.hasBlockEitherWay(a, b)) throw new AppError("This isn't available.", 404, ErrorCode.SOCIAL_BLOCKED_ACTION);
  }
}
