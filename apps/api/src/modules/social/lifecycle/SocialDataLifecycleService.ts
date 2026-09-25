import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { UsernameService } from '../identity/UsernameService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialGraphService } from '../graph/SocialGraphService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { CharacterSocialActionGateway } from '../ai/CharacterSocialActionGateway.js';
import { ScheduledSocialActionService } from '../ai/ScheduledSocialActionService.js';

/**
 * Social data lineage endpoints for the existing privacy pipeline:
 *   export — the user's own social data; other people appear only as public cards.
 *   purge  — account deletion; keeps referential integrity and preserves records under open safety cases.
 */
export class SocialDataLifecycleService {
  public static async exportUser(userId: string): Promise<Record<string, unknown>> {
    const [profile, privacy, consents, following, followers, blocks, mutes, contents, comments, reactions, memberships, charFollows, sentMessages, threads] = await Promise.all([
      prisma.socialProfile.findUnique({ where: { userId }, select: { publicId: true, username: true, displayName: true, bio: true, pronouns: true, createdAt: true } }),
      prisma.socialPrivacySettings.findUnique({ where: { userId } }),
      SocialConsentService.list(userId),
      prisma.userFollow.findMany({ where: { followerUserId: userId }, select: { followedUserId: true, status: true, createdAt: true } }),
      prisma.userFollow.findMany({ where: { followedUserId: userId, status: 'ACTIVE' }, select: { followerUserId: true, createdAt: true } }),
      prisma.userBlock.findMany({ where: { userId, blockedUserId: { not: null } }, select: { blockedUserId: true, createdAt: true } }),
      prisma.userMute.findMany({ where: { userId }, select: { targetType: true, targetId: true, scope: true, createdAt: true } }),
      prisma.socialContent.findMany({ where: { authorUserId: userId }, select: { publicId: true, kind: true, title: true, body: true, snapshot: true, visibility: true, status: true, isAiGenerated: true, createdAt: true, revokedAt: true, deletedAt: true } }),
      prisma.socialComment.findMany({ where: { authorUserId: userId }, select: { id: true, body: true, status: true, createdAt: true, content: { select: { publicId: true } } } }),
      prisma.socialReaction.findMany({ where: { userId }, select: { reactionType: true, createdAt: true, content: { select: { publicId: true } } } }),
      prisma.communityMember.findMany({ where: { userId }, select: { role: true, status: true, joinedAt: true, community: { select: { slug: true, name: true } } } }),
      prisma.characterFollow.findMany({ where: { userId }, select: { createdAt: true, character: { select: { slug: true, name: true } } } }),
      prisma.socialDirectMessage.findMany({ where: { senderUserId: userId }, select: { threadId: true, body: true, status: true, createdAt: true, deletedAt: true } }),
      prisma.socialDirectParticipant.findMany({ where: { userId }, select: { threadId: true, joinedAt: true, thread: { select: { status: true, _count: { select: { messages: true } } } } } }),
    ]);
    const cards = await SocialProfileService.cards([
      ...following.map((f) => f.followedUserId),
      ...followers.map((f) => f.followerUserId),
      ...blocks.map((b) => b.blockedUserId!),
    ]);
    const card = (id: string | null) => (id ? cards.get(id) ?? { publicId: null, username: '[unavailable]' } : null);

    return {
      profile,
      privacy,
      consents,
      following: following.map((f) => ({ user: card(f.followedUserId), status: f.status, since: f.createdAt })),
      followers: followers.map((f) => ({ user: card(f.followerUserId), since: f.createdAt })),
      blocked: blocks.map((b) => ({ user: card(b.blockedUserId), since: b.createdAt })),
      mutes,
      content: contents,
      comments: comments.map((c) => ({ ...c, content: c.content.publicId })),
      reactions: reactions.map((r) => ({ type: r.reactionType, content: r.content.publicId, at: r.createdAt })),
      communities: memberships.map((m) => ({ community: m.community.slug, name: m.community.name, role: m.role, status: m.status, joinedAt: m.joinedAt })),
      followedCharacters: charFollows.map((c) => ({ character: c.character.slug, name: c.character.name, since: c.createdAt })),
      // Your own messages in full; other participants' messages as metadata only (their content is their data).
      messagesSent: sentMessages.filter((m) => !m.deletedAt),
      conversations: threads.map((t) => ({ threadId: t.threadId, status: t.thread.status, totalMessages: t.thread._count.messages, joinedAt: t.joinedAt })),
    };
  }

  /**
   * Purges a user's social footprint for account deletion.
   * Content and messages that are subject to an OPEN moderation case are retained (legal/safety hold).
   */
  public static async purgeUser(userId: string, reason = 'ACCOUNT_DELETION'): Promise<Record<string, number>> {
    const openCaseTargets = new Set(
      (await prisma.socialModerationCase.findMany({ where: { openKey: { not: null }, subjectUserId: userId }, select: { targetId: true } })).map((c) => c.targetId),
    );
    const counterparts = new Set<string>();
    (await prisma.userFollow.findMany({ where: { OR: [{ followerUserId: userId }, { followedUserId: userId }] }, select: { followerUserId: true, followedUserId: true } })).forEach((f) => {
      counterparts.add(f.followerUserId);
      counterparts.add(f.followedUserId);
    });
    counterparts.delete(userId);

    const stats: Record<string, number> = {};
    await prisma.$transaction(async (tx) => {
      await UsernameService.releaseInTx(tx, userId);
      await tx.socialProfile.updateMany({ where: { userId }, data: { status: 'HIDDEN', displayName: 'Deleted user', bio: null, avatarUrl: null, pronouns: null } });
      stats['follows'] = (await tx.userFollow.deleteMany({ where: { OR: [{ followerUserId: userId }, { followedUserId: userId }] } })).count;
      stats['characterFollows'] = (await tx.characterFollow.deleteMany({ where: { userId } })).count;
      stats['mutes'] = (await tx.userMute.deleteMany({ where: { userId } })).count;
      stats['feedFeedback'] = (await tx.socialFeedFeedback.deleteMany({ where: { userId } })).count;
      stats['blocksInitiated'] = (await tx.userBlock.deleteMany({ where: { userId, blockedUserId: { not: null } } })).count;

      // Reactions: remove and keep counters consistent.
      const reactions = await tx.socialReaction.findMany({ where: { userId }, select: { contentId: true } });
      for (const r of reactions) await tx.socialContent.update({ where: { id: r.contentId }, data: { reactionCount: { decrement: 1 } } });
      stats['reactions'] = (await tx.socialReaction.deleteMany({ where: { userId } })).count;

      // Authored content: revoked + deleted; snapshot scrubbed unless under an open case.
      const contents = await tx.socialContent.findMany({ where: { authorUserId: userId, deletedAt: null }, select: { id: true } });
      for (const c of contents) {
        await tx.socialContent.update({
          where: { id: c.id },
          data: { status: 'DELETED', deletedAt: new Date(), revokedAt: new Date(), ...(openCaseTargets.has(c.id) ? {} : { body: null, title: null, snapshot: {} }) },
        });
      }
      stats['content'] = contents.length;

      const comments = await tx.socialComment.findMany({ where: { authorUserId: userId, deletedAt: null }, select: { id: true, status: true, contentId: true, parentId: true } });
      for (const c of comments) {
        await tx.socialComment.update({ where: { id: c.id }, data: { status: 'DELETED', deletedAt: new Date(), ...(openCaseTargets.has(c.id) ? {} : { body: '' }) } });
        if (c.status === 'PUBLISHED') {
          await tx.socialContent.update({ where: { id: c.contentId }, data: { commentCount: { decrement: 1 } } });
          if (c.parentId) await tx.socialComment.update({ where: { id: c.parentId }, data: { replyCount: { decrement: 1 } } });
        }
      }
      stats['comments'] = comments.length;

      const messages = await tx.socialDirectMessage.findMany({ where: { senderUserId: userId, deletedAt: null }, select: { id: true } });
      for (const m of messages) {
        await tx.socialDirectMessage.update({ where: { id: m.id }, data: { status: 'DELETED', deletedAt: new Date(), ...(openCaseTargets.has(m.id) ? {} : { body: '' }) } });
      }
      stats['messages'] = messages.length;
      await tx.socialDirectThread.updateMany({ where: { participants: { some: { userId } } }, data: { status: 'CLOSED' } });
      await tx.socialMessageRequest.updateMany({ where: { status: 'PENDING', OR: [{ senderUserId: userId }, { recipientUserId: userId }] }, data: { status: 'EXPIRED', pendingKey: null } });

      // Communities: leave everywhere; owned communities go to the longest-serving moderator or are archived.
      const memberships = await tx.communityMember.findMany({ where: { userId, status: { in: ['ACTIVE', 'MUTED'] } }, select: { id: true, communityId: true } });
      for (const m of memberships) await tx.community.update({ where: { id: m.communityId }, data: { memberCount: { decrement: 1 } } });
      await tx.communityMember.updateMany({ where: { userId }, data: { status: 'LEFT', role: 'MEMBER' } });
      const owned = await tx.community.findMany({ where: { ownerUserId: userId, deletedAt: null }, select: { id: true } });
      for (const c of owned) {
        const successor = await tx.communityMember.findFirst({ where: { communityId: c.id, role: 'MODERATOR', status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' } });
        if (successor) {
          await tx.communityMember.update({ where: { id: successor.id }, data: { role: 'OWNER' } });
          await tx.community.update({ where: { id: c.id }, data: { ownerUserId: successor.userId } });
        } else {
          await tx.community.update({ where: { id: c.id }, data: { status: 'ARCHIVED', ownerUserId: null } });
        }
      }
      stats['communitiesTransferredOrArchived'] = owned.length;
      await tx.socialPrivacySettings.deleteMany({ where: { userId } });
    });

    stats['pendingAiActionsCancelled'] = await CharacterSocialActionGateway.cancelPendingFor({ creatorUserId: userId }, reason);
    stats['schedulesPaused'] = await ScheduledSocialActionService.pauseAll({ ownerUserId: userId }, reason);
    await prisma.scheduledSocialAction.updateMany({ where: { ownerUserId: userId }, data: { status: 'CANCELLED' } });
    if (counterparts.size) await SocialGraphService.reconcileCounters([...counterparts]);

    await AuditService.log({ actorType: 'SYSTEM', action: 'SOCIAL_DATA_PURGED', resourceType: 'user', resourceId: userId, metadata: { reason, stats, retainedUnderOpenCase: openCaseTargets.size } });
    logger.info('[SocialLifecycle] purged social data', { userId, stats });
    return stats;
  }
}
