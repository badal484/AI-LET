import type { SocialOverviewMetrics, SocialSimulationResult, SocialSimulationStep } from '@ai-companion/types';
import type { AdminSocialSimulationInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService, type AccessDecision } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { PrivacyPolicyService } from '../identity/PrivacyPolicyService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialAbuseService } from '../safety/SocialAbuseService.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { CharacterSocialActionValidator } from '../ai/CharacterSocialActionValidator.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';

const per1k = (num: number, den: number) => (den > 0 ? Number(((num / den) * 1000).toFixed(2)) : 0);

export class SocialAdminService {
  // ---------------------------------------------------------------------------
  // Overview (engagement AND safety guardrails, side by side)
  // ---------------------------------------------------------------------------

  public static async overview(windowDays = 7): Promise<SocialOverviewMetrics> {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const w = { createdAt: { gte: since } };
    const [
      socialProfiles,
      follows,
      characterFollows,
      blocks,
      mutes,
      shares,
      comments,
      reactions,
      messageRequests,
      messagesSent,
      communities,
      reports,
      openCases,
      moderationActions,
      aiAllowed,
      aiDenied,
      contentTotal,
      contentRejected,
      activeActors,
    ] = await Promise.all([
      prisma.socialProfile.count(),
      prisma.userFollow.count({ where: w }),
      prisma.characterFollow.count({ where: w }),
      prisma.userBlock.count({ where: { ...w, blockedUserId: { not: null } } }),
      prisma.userMute.count({ where: w }),
      prisma.socialContent.count({ where: { ...w, kind: { in: ['CHARACTER_SHARE', 'CONVERSATION_EXCERPT', 'MEDIA_SHARE', 'COLLECTION_SHARE'] } } }),
      prisma.socialComment.count({ where: w }),
      prisma.socialReaction.count({ where: w }),
      prisma.socialMessageRequest.count({ where: w }),
      prisma.socialDirectMessage.count({ where: w }),
      prisma.community.count({ where: w }),
      prisma.socialReport.count({ where: w }),
      prisma.socialModerationCase.count({ where: { openKey: { not: null } } }),
      prisma.socialModerationAction.count({ where: w }),
      prisma.socialActionLog.count({ where: { ...w, actorType: { in: ['AI_CHARACTER', 'SCHEDULER'] }, status: 'EXECUTED' } }),
      prisma.socialActionLog.count({ where: { ...w, actorType: { in: ['AI_CHARACTER', 'SCHEDULER'] }, status: 'DENIED' } }),
      prisma.socialContent.count({ where: w }),
      prisma.socialContent.count({ where: { ...w, status: { in: ['REJECTED', 'HIDDEN', 'RESTRICTED'] } } }),
      prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(DISTINCT uid)::bigint AS n FROM (
          SELECT follower_user_id AS uid FROM user_follows WHERE created_at >= ${since}
          UNION SELECT author_user_id FROM social_contents WHERE created_at >= ${since} AND author_user_id IS NOT NULL
          UNION SELECT author_user_id FROM social_comments WHERE created_at >= ${since} AND author_user_id IS NOT NULL
          UNION SELECT user_id FROM social_reactions WHERE created_at >= ${since}
        ) t`,
    ]);
    return {
      windowDays,
      socialProfiles,
      activeSocialUsers: Number(activeActors[0]?.n ?? 0),
      follows,
      characterFollows,
      blocks,
      mutes,
      shares,
      comments,
      reactions,
      messageRequests,
      messagesSent,
      communities,
      reports,
      openCases,
      moderationActions,
      aiSocialActionsAllowed: aiAllowed,
      aiSocialActionsDenied: aiDenied,
      reportRatePer1kContent: per1k(reports, contentTotal + comments),
      blockRatePer1kFollows: per1k(blocks, follows),
      contentRejectionRate: contentTotal > 0 ? Number((contentRejected / contentTotal).toFixed(4)) : 0,
    };
  }

  /** Internal abuse signals (never exposed publicly). */
  public static async graphHealth(): Promise<Record<string, unknown>> {
    const since = new Date(Date.now() - 86_400_000);
    const [followVelocity, reciprocalBursts, newAccountBursts, requestSenders, communityHealth] = await Promise.all([
      prisma.$queryRaw<Array<{ user_id: string; follows: bigint }>>`
        SELECT follower_user_id AS user_id, COUNT(*)::bigint AS follows FROM user_follows
        WHERE created_at >= ${since} GROUP BY follower_user_id HAVING COUNT(*) > 100 ORDER BY follows DESC LIMIT 50`,
      prisma.$queryRaw<Array<{ pairs: bigint }>>`
        SELECT COUNT(*)::bigint AS pairs FROM user_follows a JOIN user_follows b
          ON a.follower_user_id = b.followed_user_id AND a.followed_user_id = b.follower_user_id
        WHERE a.created_at >= ${since} AND a.follower_user_id < a.followed_user_id
          AND ABS(EXTRACT(EPOCH FROM (a.created_at - b.created_at))) < 60`,
      prisma.$queryRaw<Array<{ user_id: string; actions: bigint }>>`
        SELECT u.id AS user_id, COUNT(*)::bigint AS actions FROM users u
        JOIN user_follows f ON f.follower_user_id = u.id
        WHERE u.created_at >= ${since} GROUP BY u.id HAVING COUNT(*) > 30 ORDER BY actions DESC LIMIT 50`,
      prisma.$queryRaw<Array<{ sender: string; sent: bigint; accepted: bigint; blocked: bigint }>>`
        SELECT sender_user_id AS sender, COUNT(*)::bigint AS sent,
          COUNT(*) FILTER (WHERE status = 'ACCEPTED')::bigint AS accepted,
          COUNT(*) FILTER (WHERE status = 'BLOCKED')::bigint AS blocked
        FROM social_message_requests WHERE created_at >= ${new Date(Date.now() - 7 * 86_400_000)}
        GROUP BY sender_user_id HAVING COUNT(*) >= 10 ORDER BY blocked DESC, sent DESC LIMIT 50`,
      prisma.$queryRaw<Array<{ community_id: string; reports: bigint; members: number }>>`
        SELECT c.id AS community_id, COUNT(r.id)::bigint AS reports, c.member_count AS members
        FROM communities c LEFT JOIN social_reports r ON r.target_type = 'COMMUNITY' AND r.target_id = c.id::text
          AND r.created_at >= ${new Date(Date.now() - 7 * 86_400_000)}
        WHERE c.deleted_at IS NULL GROUP BY c.id HAVING COUNT(r.id) > 0 ORDER BY reports DESC LIMIT 50`,
    ]);
    const num = (v: bigint | number) => Number(v);
    return {
      abnormalFollowVelocity: followVelocity.map((r) => ({ userId: r.user_id, follows24h: num(r.follows) })),
      reciprocalFollowFarmingPairs24h: num(reciprocalBursts[0]?.pairs ?? 0),
      newAccountBursts: newAccountBursts.map((r) => ({ userId: r.user_id, follows: num(r.actions) })),
      messageRequestAbuse: requestSenders.map((r) => ({
        userId: r.sender,
        sent7d: num(r.sent),
        acceptanceRate: num(r.sent) ? Number((num(r.accepted) / num(r.sent)).toFixed(3)) : 0,
        blockRate: num(r.sent) ? Number((num(r.blocked) / num(r.sent)).toFixed(3)) : 0,
      })),
      communityHealth: communityHealth.map((r) => ({ communityId: r.community_id, reports7d: num(r.reports), members: r.members })),
    };
  }

  /** Support/moderator view of a user's social standing: metadata only, never private message content. */
  public static async investigateUser(adminId: string, handle: string) {
    const target = await SocialProfileService.resolve(handle);
    const userId = target?.userId ?? (/^[0-9a-f-]{36}$/i.test(handle) ? handle : null);
    if (!userId) throw new NotFoundError('User not found');
    const [profile, privacy, risk, restrictions, cases, recentActions, counts] = await Promise.all([
      prisma.socialProfile.findUnique({ where: { userId } }),
      prisma.socialPrivacySettings.findUnique({ where: { userId } }),
      SocialAbuseService.getRiskProfile(userId),
      prisma.userRestriction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.socialModerationCase.findMany({ where: { subjectUserId: userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.socialActionLog.findMany({ where: { OR: [{ onBehalfOfUserId: userId }, { actorId: userId }] }, orderBy: { createdAt: 'desc' }, take: 20 }),
      Promise.all([
        prisma.socialContent.count({ where: { authorUserId: userId } }),
        prisma.socialComment.count({ where: { authorUserId: userId } }),
        prisma.socialMessageRequest.count({ where: { senderUserId: userId } }),
        prisma.socialDirectParticipant.count({ where: { userId } }),
        prisma.userBlock.count({ where: { blockedUserId: userId } }),
      ]),
    ]);
    await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'SOCIAL_USER_INVESTIGATED', resourceType: 'user', resourceId: userId });
    return {
      userId,
      profile,
      privacy,
      risk,
      restrictions,
      cases,
      recentActions,
      activity: { content: counts[0], comments: counts[1], messageRequestsSent: counts[2], conversations: counts[3], blockedByCount: counts[4] },
    };
  }

  public static async restrictUser(adminId: string, userId: string, input: { type: 'SOCIAL_RESTRICTED' | 'CANNOT_COMMENT' | 'CANNOT_DIRECT_MESSAGE' | 'CANNOT_SHARE_CONTENT' | 'CANNOT_CREATE_COMMUNITIES'; hours?: number; reason: string }) {
    const r = await prisma.userRestriction.create({
      data: { userId, restrictionType: input.type, reason: input.reason, issuedByAdminId: adminId, expiresAt: input.hours ? new Date(Date.now() + input.hours * 3_600_000) : null },
    });
    await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'SOCIAL_RESTRICTION_ISSUED', resourceType: 'user_restriction', resourceId: r.id, metadata: { userId, type: input.type, hours: input.hours } });
    return r;
  }

  public static async listActionLogs(params: { characterId?: string; actorType?: string; limit: number }) {
    return prisma.socialActionLog.findMany({
      where: { ...(params.characterId ? { characterId: params.characterId } : {}), ...(params.actorType ? { actorType: params.actorType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit, 200),
    });
  }

  // ---------------------------------------------------------------------------
  // Simulator: user A → action → user B → policy → expected result (read-only)
  // ---------------------------------------------------------------------------

  public static async simulate(input: AdminSocialSimulationInput): Promise<SocialSimulationResult> {
    const steps: SocialSimulationStep[] = [];
    const record = (check: string, d: AccessDecision | { allowed: boolean; reason: string }) => {
      steps.push({ check, passed: d.allowed, detail: d.reason });
      return d.allowed;
    };
    const resolveUser = async (handle?: string) => {
      if (!handle) throw new BadRequestError('This simulation needs both an actor and a target.');
      const u = await SocialProfileService.resolve(handle);
      if (!u) throw new NotFoundError(`Unknown user ${handle}`);
      return u.userId;
    };

    if (input.action === 'CHARACTER_POST' || input.action === 'CHARACTER_REPLY') {
      if (!input.characterSlug) throw new BadRequestError('characterSlug required');
      const outcome = await CharacterSocialActionValidator.validate({
        characterSlug: input.characterSlug,
        actionType: input.action === 'CHARACTER_POST' ? 'PUBLISH_POST' : 'REPLY_COMMENT',
        targetCommentId: input.action === 'CHARACTER_REPLY' ? input.target : undefined,
        text: input.text ?? 'Simulated character update.',
        idempotencyKey: `simulation-${Date.now()}`,
      });
      return { action: input.action, allowed: outcome.decision.action !== 'BLOCK', decision: outcome.decision, steps: outcome.steps };
    }

    if (input.action === 'COMMENT') {
      const actor = await resolveUser(input.actor);
      const content = await prisma.socialContent.findUnique({ where: { publicId: input.target ?? '' } });
      if (!content) throw new NotFoundError('Unknown content');
      const ok = record('can_comment', await SocialAccessService.canComment(actor, content));
      let decision: SocialSimulationResult['decision'] = { action: ok ? 'ALLOW' : 'BLOCK', reasons: steps.filter((s) => !s.passed).map((s) => s.detail) };
      if (ok && input.text) {
        const e = SocialContentSafetyService.evaluateText(input.text, { surface: 'COMMENT' });
        steps.push({ check: 'content_safety', passed: e.decision.action !== 'BLOCK', detail: `${e.decision.action} ${e.decision.reasons.join(',')}` });
        decision = e.decision;
      }
      return { action: input.action, allowed: decision.action !== 'BLOCK', decision, steps };
    }

    const actor = await resolveUser(input.actor);
    const target = await resolveUser(input.target);
    const rel = await RelationshipReader.between(actor, target);
    steps.push({ check: 'relationship', passed: true, detail: `follows=${rel.viewerFollows ?? 'none'} followedBy=${rel.targetFollows ?? 'none'} blockedByActor=${rel.viewerBlockedTarget} blockedByTarget=${rel.targetBlockedViewer} muted=${rel.viewerMutedScopes.join('|') || 'none'}` });

    let allowed = false;
    switch (input.action) {
      case 'VIEW_PROFILE': {
        const a = await SocialAccessService.profileAccess(actor, target, rel);
        allowed = record('profile_access', { allowed: a.exists, reason: `${a.reason}${a.exists ? (a.full ? ' (full)' : ' (card only)') : ''}` });
        break;
      }
      case 'FOLLOW':
        allowed = record('can_follow', await SocialAccessService.canFollow(actor, target));
        break;
      case 'MESSAGE':
      case 'MESSAGE_REQUEST': {
        const d = await SocialAccessService.canStartConversation(actor, target);
        allowed = record('can_start_conversation', { allowed: d.allowed, reason: `${d.reason}${d.allowed ? (d.direct ? ' (direct)' : ' (via request)') : ''}` });
        break;
      }
      case 'MENTION':
        allowed = record('can_mention', await SocialAccessService.canMention(actor, target));
        break;
      case 'NOTIFY': {
        const feature = await SocialPolicyService.isFeatureEnabled('social_notifications', { userId: target });
        const consent = await SocialConsentService.isGranted(target, 'SOCIAL_NOTIFICATIONS');
        allowed = record('feature', { allowed: feature, reason: feature ? 'social_notifications on' : 'social_notifications off' }) &&
          record('consent', { allowed: consent, reason: consent ? 'granted' : 'not granted' }) &&
          record('recipient_filter', await SocialAccessService.canReceiveNotificationFrom(target, actor));
        break;
      }
      case 'RECOMMEND': {
        const s = await PrivacyPolicyService.get(target);
        allowed = record('not_blocked', { allowed: !rel.viewerBlockedTarget && !rel.targetBlockedViewer, reason: 'block check' }) &&
          record('target_discoverable', { allowed: s.discoverable && s.profileVisibility !== 'PRIVATE', reason: `discoverable=${s.discoverable} visibility=${s.profileVisibility}` });
        break;
      }
      default:
        throw new BadRequestError('Unsupported simulation');
    }
    const failed = steps.filter((st) => !st.passed).map((st) => st.detail);
    return { action: input.action, allowed, decision: { action: allowed ? 'ALLOW' : 'BLOCK', reasons: failed }, steps };
  }
}

