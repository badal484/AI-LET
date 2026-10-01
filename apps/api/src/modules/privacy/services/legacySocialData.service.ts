import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';

/**
 * The social network (profiles, follows, posts, messages, communities) has been removed from the
 * product, but its tables and any data users created before still exist. Data export and account
 * deletion must keep covering that data, so this does both directly on the database.
 */
export class LegacySocialDataService {
  public static async exportUser(userId: string): Promise<Record<string, unknown>> {
    const [profile, privacy, consents, following, followers, blocks, mutes, contents, comments, reactions, memberships, charFollows, sentMessages] = await Promise.all([
      prisma.socialProfile.findUnique({ where: { userId }, select: { publicId: true, username: true, displayName: true, bio: true, pronouns: true, createdAt: true } }),
      prisma.socialPrivacySettings.findUnique({ where: { userId } }),
      prisma.socialConsent.findMany({ where: { userId }, select: { consentType: true, granted: true, policyVersion: true, createdAt: true } }),
      prisma.userFollow.findMany({ where: { followerUserId: userId }, select: { followedUserId: true, status: true, createdAt: true } }),
      prisma.userFollow.findMany({ where: { followedUserId: userId, status: 'ACTIVE' }, select: { followerUserId: true, createdAt: true } }),
      prisma.userBlock.findMany({ where: { userId, blockedUserId: { not: null } }, select: { blockedUserId: true, createdAt: true } }),
      prisma.userMute.findMany({ where: { userId }, select: { targetType: true, targetId: true, scope: true, createdAt: true } }),
      prisma.socialContent.findMany({ where: { authorUserId: userId }, select: { publicId: true, kind: true, title: true, body: true, visibility: true, status: true, createdAt: true, deletedAt: true } }),
      prisma.socialComment.findMany({ where: { authorUserId: userId }, select: { id: true, body: true, status: true, createdAt: true } }),
      prisma.socialReaction.findMany({ where: { userId }, select: { reactionType: true, createdAt: true } }),
      prisma.communityMember.findMany({ where: { userId }, select: { role: true, status: true, joinedAt: true, community: { select: { slug: true, name: true } } } }),
      prisma.characterFollow.findMany({ where: { userId }, select: { createdAt: true, character: { select: { slug: true, name: true } } } }),
      prisma.socialDirectMessage.findMany({ where: { senderUserId: userId, deletedAt: null }, select: { threadId: true, body: true, status: true, createdAt: true } }),
    ]);
    // Other people appear only by their public username (their data is theirs).
    const others = [...following.map((f) => f.followedUserId), ...followers.map((f) => f.followerUserId), ...blocks.map((b) => b.blockedUserId!)];
    const names = new Map(
      (await prisma.socialProfile.findMany({ where: { userId: { in: others } }, select: { userId: true, username: true } })).map((p) => [p.userId, p.username ?? '[unavailable]']),
    );
    const who = (id: string | null) => (id ? names.get(id) ?? '[unavailable]' : null);
    return {
      profile,
      privacy,
      consents,
      following: following.map((f) => ({ user: who(f.followedUserId), status: f.status, since: f.createdAt })),
      followers: followers.map((f) => ({ user: who(f.followerUserId), since: f.createdAt })),
      blocked: blocks.map((b) => ({ user: who(b.blockedUserId), since: b.createdAt })),
      mutes,
      content: contents,
      comments,
      reactions,
      communities: memberships.map((m) => ({ community: m.community.slug, name: m.community.name, role: m.role, status: m.status, joinedAt: m.joinedAt })),
      followedCharacters: charFollows.map((c) => ({ character: c.character.slug, name: c.character.name, since: c.createdAt })),
      messagesSent: sentMessages,
    };
  }

  /**
   * Account deletion: removes or scrubs the user's social data. Anything under an OPEN moderation case
   * keeps its text (legal/safety hold) but is still marked deleted.
   */
  public static async purgeUser(userId: string, reason = 'ACCOUNT_DELETION'): Promise<Record<string, number>> {
    const held = new Set(
      (await prisma.socialModerationCase.findMany({ where: { openKey: { not: null }, subjectUserId: userId }, select: { targetId: true } })).map((c) => c.targetId),
    );
    const now = new Date();
    const stats: Record<string, number> = {};
    await prisma.$transaction(async (tx) => {
      await tx.socialProfile.updateMany({
        where: { userId },
        data: { status: 'HIDDEN', displayName: 'Deleted user', bio: null, avatarUrl: null, pronouns: null, username: null, usernameCanonical: null },
      });
      stats['follows'] = (await tx.userFollow.deleteMany({ where: { OR: [{ followerUserId: userId }, { followedUserId: userId }] } })).count;
      stats['characterFollows'] = (await tx.characterFollow.deleteMany({ where: { userId } })).count;
      stats['mutes'] = (await tx.userMute.deleteMany({ where: { userId } })).count;
      stats['feedFeedback'] = (await tx.socialFeedFeedback.deleteMany({ where: { userId } })).count;
      stats['blocks'] = (await tx.userBlock.deleteMany({ where: { userId, blockedUserId: { not: null } } })).count;
      stats['reactions'] = (await tx.socialReaction.deleteMany({ where: { userId } })).count;

      const contents = await tx.socialContent.findMany({ where: { authorUserId: userId, deletedAt: null }, select: { id: true } });
      for (const c of contents)
        await tx.socialContent.update({ where: { id: c.id }, data: { status: 'DELETED', deletedAt: now, revokedAt: now, ...(held.has(c.id) ? {} : { body: null, title: null, snapshot: {} }) } });
      stats['content'] = contents.length;

      const comments = await tx.socialComment.findMany({ where: { authorUserId: userId, deletedAt: null }, select: { id: true } });
      for (const c of comments) await tx.socialComment.update({ where: { id: c.id }, data: { status: 'DELETED', deletedAt: now, ...(held.has(c.id) ? {} : { body: '' }) } });
      stats['comments'] = comments.length;

      const messages = await tx.socialDirectMessage.findMany({ where: { senderUserId: userId, deletedAt: null }, select: { id: true } });
      for (const m of messages) await tx.socialDirectMessage.update({ where: { id: m.id }, data: { status: 'DELETED', deletedAt: now, ...(held.has(m.id) ? {} : { body: '' }) } });
      stats['messages'] = messages.length;
      await tx.socialDirectThread.updateMany({ where: { participants: { some: { userId } } }, data: { status: 'CLOSED' } });
      await tx.socialMessageRequest.updateMany({ where: { status: 'PENDING', OR: [{ senderUserId: userId }, { recipientUserId: userId }] }, data: { status: 'EXPIRED', pendingKey: null } });

      await tx.communityMember.updateMany({ where: { userId }, data: { status: 'LEFT', role: 'MEMBER' } });
      stats['communitiesArchived'] = (await tx.community.updateMany({ where: { ownerUserId: userId, deletedAt: null }, data: { status: 'ARCHIVED', ownerUserId: null } })).count;
      await tx.socialPrivacySettings.deleteMany({ where: { userId } });
      await tx.socialActionLog.updateMany({ where: { status: 'PENDING_APPROVAL', onBehalfOfUserId: userId }, data: { status: 'CANCELLED', reasons: [reason] } });
      await tx.scheduledSocialAction.updateMany({ where: { ownerUserId: userId }, data: { status: 'CANCELLED' } });
    });
    await AuditService.log({ actorType: 'SYSTEM', action: 'SOCIAL_DATA_PURGED', resourceType: 'user', resourceId: userId, metadata: { reason, stats, retainedUnderOpenCase: held.size } });
    logger.info('[LegacySocialData] purged social data', { userId, stats });
    return stats;
  }
}
