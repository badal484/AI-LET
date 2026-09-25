import type { SocialFollowStatus, SocialMuteScope } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';

export interface PairRelationship {
  isSelf: boolean;
  /** viewer → target */
  viewerFollows: SocialFollowStatus | null;
  /** target → viewer */
  targetFollows: SocialFollowStatus | null;
  viewerBlockedTarget: boolean;
  targetBlockedViewer: boolean;
  /** Mute scopes the viewer applied to the target. */
  viewerMutedScopes: SocialMuteScope[];
}

export const EMPTY_RELATIONSHIP: PairRelationship = {
  isSelf: false,
  viewerFollows: null,
  targetFollows: null,
  viewerBlockedTarget: false,
  targetBlockedViewer: false,
  viewerMutedScopes: [],
};

export function isBlockedEitherWay(r: PairRelationship): boolean {
  return r.viewerBlockedTarget || r.targetBlockedViewer;
}

/**
 * Single source for relationship reads. Blocks are ALWAYS read from PostgreSQL — never from a cache —
 * so a stale cache can never let a blocked user through.
 */
export class RelationshipReader {
  public static async between(viewerId: string, targetId: string): Promise<PairRelationship> {
    if (viewerId === targetId) return { ...EMPTY_RELATIONSHIP, isSelf: true };
    const [follows, blocks, mutes] = await Promise.all([
      prisma.userFollow.findMany({
        where: {
          OR: [
            { followerUserId: viewerId, followedUserId: targetId },
            { followerUserId: targetId, followedUserId: viewerId },
          ],
        },
        select: { followerUserId: true, status: true },
      }),
      prisma.userBlock.findMany({
        where: {
          OR: [
            { userId: viewerId, blockedUserId: targetId },
            { userId: targetId, blockedUserId: viewerId },
          ],
        },
        select: { userId: true },
      }),
      prisma.userMute.findMany({
        where: {
          userId: viewerId,
          targetType: { in: ['USER', 'CREATOR'] },
          targetId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { scope: true },
      }),
    ]);
    return {
      isSelf: false,
      viewerFollows: follows.find((f) => f.followerUserId === viewerId)?.status ?? null,
      targetFollows: follows.find((f) => f.followerUserId === targetId)?.status ?? null,
      viewerBlockedTarget: blocks.some((b) => b.userId === viewerId),
      targetBlockedViewer: blocks.some((b) => b.userId === targetId),
      viewerMutedScopes: mutes.map((m) => m.scope),
    };
  }

  public static async hasBlockEitherWay(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const n = await prisma.userBlock.count({
      where: { OR: [{ userId: a, blockedUserId: b }, { userId: b, blockedUserId: a }] },
    });
    return n > 0;
  }

  /** All user ids with a block in either direction with `userId` (for filtering lists/feeds/search). */
  public static async blockedEitherWaySet(userId: string): Promise<Set<string>> {
    const rows = await prisma.userBlock.findMany({
      where: { OR: [{ userId, blockedUserId: { not: null } }, { blockedUserId: userId }] },
      select: { userId: true, blockedUserId: true },
    });
    const out = new Set<string>();
    for (const r of rows) {
      if (r.userId === userId && r.blockedUserId) out.add(r.blockedUserId);
      else out.add(r.userId);
    }
    return out;
  }

  /** Batch: relationships between one viewer and many targets. */
  public static async many(viewerId: string, targetIds: string[]): Promise<Map<string, PairRelationship>> {
    const ids = [...new Set(targetIds)].filter((id) => id !== viewerId);
    const result = new Map<string, PairRelationship>();
    if (targetIds.includes(viewerId)) result.set(viewerId, { ...EMPTY_RELATIONSHIP, isSelf: true });
    if (ids.length === 0) return result;

    const [follows, blocks, mutes] = await Promise.all([
      prisma.userFollow.findMany({
        where: {
          OR: [
            { followerUserId: viewerId, followedUserId: { in: ids } },
            { followedUserId: viewerId, followerUserId: { in: ids } },
          ],
        },
        select: { followerUserId: true, followedUserId: true, status: true },
      }),
      prisma.userBlock.findMany({
        where: {
          OR: [
            { userId: viewerId, blockedUserId: { in: ids } },
            { blockedUserId: viewerId, userId: { in: ids } },
          ],
        },
        select: { userId: true, blockedUserId: true },
      }),
      prisma.userMute.findMany({
        where: { userId: viewerId, targetType: { in: ['USER', 'CREATOR'] }, targetId: { in: ids }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { targetId: true, scope: true },
      }),
    ]);

    for (const id of ids) {
      result.set(id, {
        isSelf: false,
        viewerFollows: follows.find((f) => f.followerUserId === viewerId && f.followedUserId === id)?.status ?? null,
        targetFollows: follows.find((f) => f.followerUserId === id && f.followedUserId === viewerId)?.status ?? null,
        viewerBlockedTarget: blocks.some((b) => b.userId === viewerId && b.blockedUserId === id),
        targetBlockedViewer: blocks.some((b) => b.userId === id && b.blockedUserId === viewerId),
        viewerMutedScopes: mutes.filter((m) => m.targetId === id).map((m) => m.scope),
      });
    }
    return result;
  }

  /** Muted target ids by type for a viewer (users, characters, communities, topics), honoring scope. */
  public static async mutedTargets(viewerId: string, scope: 'POSTS' | 'COMMENTS' | 'NOTIFICATIONS') {
    const rows = await prisma.userMute.findMany({
      where: { userId: viewerId, scope: { in: ['ALL', scope] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { targetType: true, targetId: true },
    });
    const out = { users: new Set<string>(), characters: new Set<string>(), communities: new Set<string>(), topics: new Set<string>(), categories: new Set<string>() };
    for (const r of rows) {
      if (r.targetType === 'USER' || r.targetType === 'CREATOR') out.users.add(r.targetId);
      else if (r.targetType === 'CHARACTER') out.characters.add(r.targetId);
      else if (r.targetType === 'COMMUNITY') out.communities.add(r.targetId);
      else if (r.targetType === 'TOPIC') out.topics.add(r.targetId);
      else if (r.targetType === 'NOTIFICATION_CATEGORY') out.categories.add(r.targetId);
    }
    return out;
  }
}
