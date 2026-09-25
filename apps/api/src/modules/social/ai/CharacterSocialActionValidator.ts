import type { SocialSafetyDecision, SocialSimulationStep } from '@ai-companion/types';
import type { CharacterSocialActionProposalInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { SafetyClassifiers } from '../../safety/services/SafetyClassifiers.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { PrivacyPolicyService } from '../identity/PrivacyPolicyService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialContentSafetyService } from '../safety/SocialContentSafetyService.js';
import { CharacterSocialCapabilityService } from './CharacterSocialCapabilityService.js';

/** Actions a model may never cause, no matter the configuration (no hidden social side effects). */
const HARD_DENIED = new Set(['SEND_DIRECT_MESSAGE', 'FOLLOW_USER', 'JOIN_COMMUNITY', 'MENTION_USER']);
/** Implemented executors. Anything else is denied rather than approximated. */
const SUPPORTED = new Set(['PUBLISH_POST', 'REPLY_COMMENT', 'SEND_NOTIFICATION']);

const CLAIMS_HUMAN = /\b(i\s*(am|'m)\s+(a\s+)?(real\s+)?(human|person|not\s+an?\s+ai|not\s+a\s+bot))\b|\bi\s+am\s+not\s+(an?\s+)?(ai|bot|chatbot)\b/i;
const ISOLATION_OR_PRESSURE = /\b(only i understand you|don'?t talk to (anyone|others)|you don'?t need (anyone|them)|invite (\d+ )?friends|recruit|share this with everyone or|buy (credits|premium) (now|to keep)|i('ll| will) leave you|i won'?t talk to you)\b/i;

export interface ValidationContext {
  characterId: string;
  characterSlug: string;
  creatorUserId: string;
  targetUserId: string | null;
  targetContentId: string | null;
  targetCommentId: string | null;
}

export interface ValidationOutcome {
  decision: SocialSafetyDecision;
  steps: SocialSimulationStep[];
  ctx: ValidationContext | null;
  sanitizedText: string | null;
  estimatedCostCents: number;
}

function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Runs every check, in order, before a character may perform ANY social action:
 *  1 character version · 2 capability · 3 creator permission · 4 recipient permission · 5 block state
 *  6 moderation · 7 rate limit · 8 budget · 9 platform policy · 10 action risk.
 * Results are explainable step-by-step (the admin simulator renders them).
 */
export class CharacterSocialActionValidator {
  /**
   * @param opts.excludeLogId  the pending approval being executed (must not count against its own limits)
   * @param opts.creatorApproved  the accountable creator has explicitly approved this exact proposal
   */
  public static async validate(p: CharacterSocialActionProposalInput, opts: { excludeLogId?: string; creatorApproved?: boolean } = {}): Promise<ValidationOutcome> {
    const steps: SocialSimulationStep[] = [];
    const cost = p.generation?.estimatedCostCents ?? 0;
    const fail = (check: string, detail: string, reason: string, ctx: ValidationContext | null = null): ValidationOutcome => {
      steps.push({ check, passed: false, detail });
      return { decision: { action: 'BLOCK', reasons: [reason], userMessage: detail }, steps, ctx, sanitizedText: null, estimatedCostCents: cost };
    };
    const pass = (check: string, detail: string) => steps.push({ check, passed: true, detail });

    if (HARD_DENIED.has(p.actionType)) {
      return fail('platform_policy', `Characters can never perform ${p.actionType} on their own.`, `HARD_DENIED_${p.actionType}`);
    }
    if (!SUPPORTED.has(p.actionType)) return fail('platform_policy', `${p.actionType} is not supported for characters.`, 'UNSUPPORTED_ACTION');

    // 1. Character + version
    const character = await prisma.character.findFirst({
      where: { slug: p.characterSlug, deletedAt: null },
      select: { id: true, slug: true, status: true, currentPublishedVersionId: true, creatorProfile: { select: { userId: true, status: true } } },
    });
    if (!character || character.status !== 'PUBLISHED') return fail('character_version', 'Character is not published.', 'CHARACTER_NOT_PUBLISHED');
    if (p.generation?.characterVersionId && p.generation.characterVersionId !== character.currentPublishedVersionId) {
      return fail('character_version', 'Generated with a character version that is not the current published version.', 'STALE_CHARACTER_VERSION');
    }
    if (!character.creatorProfile) return fail('character_version', 'Character has no accountable creator.', 'NO_CREATOR');
    pass('character_version', `Published version ${character.currentPublishedVersionId ?? 'n/a'}`);

    const ctx: ValidationContext = {
      characterId: character.id,
      characterSlug: character.slug,
      creatorUserId: character.creatorProfile.userId,
      targetUserId: null,
      targetContentId: null,
      targetCommentId: null,
    };

    // 2. Capability (creator-configured AND platform-approved)
    const cap = await CharacterSocialCapabilityService.effective(character.id, character.slug);
    const capFlag = { PUBLISH_POST: cap.canPublish, REPLY_COMMENT: cap.canReply, SEND_NOTIFICATION: cap.canSendNotifications }[p.actionType as 'PUBLISH_POST'];
    if (!capFlag) return fail('capability', `Capability for ${p.actionType} is not enabled by the creator.`, 'CAPABILITY_DISABLED', ctx);
    if (!cap.platformApproved) return fail('capability', 'Social capabilities are awaiting platform approval.', 'NOT_PLATFORM_APPROVED', ctx);
    pass('capability', `v${cap.version}, platform approved`);

    // 3. Creator permission
    if (character.creatorProfile.status !== 'ACTIVE') return fail('creator_permission', 'Creator account is not active.', 'CREATOR_INACTIVE', ctx);
    if (!(await SocialConsentService.isGranted(ctx.creatorUserId, 'AI_GENERATED_PUBLIC_CONTENT'))) {
      return fail('creator_permission', 'Creator has not consented to AI-generated public content.', 'CREATOR_CONSENT_MISSING', ctx);
    }
    const restricted = await prisma.userRestriction.count({
      where: { userId: ctx.creatorUserId, isActive: true, restrictionType: { in: ['SOCIAL_RESTRICTED', 'CANNOT_PUBLISH', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_RESTRICTED'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (restricted > 0) return fail('creator_permission', 'Creator is under an active restriction.', 'CREATOR_RESTRICTED', ctx);
    pass('creator_permission', 'Creator active and consented');

    // 4 + 5. Recipient permission & block state (only for actions that touch a person)
    if (p.actionType === 'REPLY_COMMENT') {
      if (!p.targetCommentId) return fail('recipient_permission', 'A reply must target a comment.', 'MISSING_TARGET', ctx);
      const comment = await prisma.socialComment.findUnique({ where: { id: p.targetCommentId }, include: { content: { select: { id: true, characterId: true, status: true } } } });
      // Only a response to a user's own interaction on this character's content is allowed.
      if (!comment || comment.status !== 'PUBLISHED' || comment.content.characterId !== character.id || comment.content.status !== 'PUBLISHED' || comment.authorType !== 'USER') {
        return fail('recipient_permission', 'Characters may only reply to user comments on their own content.', 'REPLY_TARGET_INVALID', ctx);
      }
      ctx.targetCommentId = comment.id;
      ctx.targetContentId = comment.content.id;
      ctx.targetUserId = comment.authorUserId;
    } else if (p.actionType === 'SEND_NOTIFICATION') {
      if (!p.targetUser) return fail('recipient_permission', 'A notification needs a recipient.', 'MISSING_TARGET', ctx);
      const target = await SocialProfileService.resolve(p.targetUser);
      if (!target) return fail('recipient_permission', 'Recipient not found.', 'RECIPIENT_NOT_FOUND', ctx);
      ctx.targetUserId = target.userId;
      // Explicit subscription: the user follows this character with notifications on.
      const follow = await prisma.characterFollow.findUnique({ where: { userId_characterId: { userId: target.userId, characterId: character.id } } });
      if (!follow?.notificationsEnabled) return fail('recipient_permission', 'Recipient has not subscribed to this character.', 'NOT_SUBSCRIBED', ctx);
      if (!(await SocialConsentService.isGranted(target.userId, 'CHARACTER_PROACTIVE_SOCIAL'))) {
        return fail('recipient_permission', 'Recipient has not consented to character social contact.', 'RECIPIENT_CONSENT_MISSING', ctx);
      }
    }
    if (ctx.targetUserId) {
      const settings = await PrivacyPolicyService.get(ctx.targetUserId);
      if (!settings.characterSocialInteractions && p.actionType !== 'REPLY_COMMENT') {
        return fail('recipient_permission', 'Recipient disabled character social interactions.', 'RECIPIENT_OPTED_OUT', ctx);
      }
      pass('recipient_permission', 'Recipient permits this interaction');

      const blocks = await prisma.userBlock.count({
        where: { userId: ctx.targetUserId, OR: [{ blockedCharacterId: character.id }, { blockedUserId: ctx.creatorUserId }, { blockedCreator: { userId: ctx.creatorUserId } }] },
      });
      const mutes = await prisma.userMute.count({ where: { userId: ctx.targetUserId, targetType: 'CHARACTER', targetId: character.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (blocks > 0) return fail('block_state', 'Recipient blocked this character or its creator.', 'BLOCKED', ctx);
      if (mutes > 0 && p.actionType === 'SEND_NOTIFICATION') return fail('block_state', 'Recipient muted this character.', 'MUTED', ctx);
      pass('block_state', 'No block or mute');
    } else {
      pass('recipient_permission', 'No individual recipient');
      pass('block_state', 'No individual recipient');
    }

    // 6. Moderation of the generated text (AI output is untrusted until validated)
    let sanitizedText: string | null = null;
    let moderationNeeded = false;
    if (p.actionType !== 'SEND_NOTIFICATION' || p.text) {
      if (!p.text) return fail('moderation', 'No content to validate.', 'EMPTY_CONTENT', ctx);
      if (CLAIMS_HUMAN.test(p.text)) return fail('moderation', 'Characters must not claim to be human.', 'CLAIMS_HUMAN', ctx);
      if (ISOLATION_OR_PRESSURE.test(p.text) || SafetyClassifiers.classifyProactiveManipulation(p.text).flagged) {
        return fail('moderation', 'Manipulative, isolating or pressuring language is not allowed.', 'MANIPULATION', ctx);
      }
      const evaluation = SocialContentSafetyService.evaluateText(p.text, { surface: 'AI_GENERATED', maxLinks: 0 });
      if (evaluation.decision.action === 'BLOCK') return fail('moderation', evaluation.decision.userMessage ?? 'Blocked by safety policy.', evaluation.decision.reasons[0] ?? 'SAFETY_BLOCK', ctx);
      // Characters must never reveal private user information in public.
      if (evaluation.piiFindings.length > 0) return fail('moderation', 'Generated content contains personal information.', 'PII_IN_AI_OUTPUT', ctx);
      moderationNeeded = evaluation.decision.action === 'REQUIRE_MODERATION';
      sanitizedText = evaluation.sanitizedText;
    }
    pass('moderation', moderationNeeded ? 'Flagged for human review' : 'Passed automated checks');

    // 7. Rate limits & cooldowns (from persisted executions, not in-memory counters)
    const today = startOfDay();
    const hourAgo = new Date(Date.now() - 3_600_000);
    const executedWhere = {
      characterId: character.id,
      status: { in: ['EXECUTED', 'PENDING_APPROVAL'] },
      ...(opts.excludeLogId ? { id: { not: opts.excludeLogId } } : {}),
    };
    const [postsToday, repliesLastHour, lastAction, perUserToday] = await Promise.all([
      prisma.socialActionLog.count({ where: { ...executedWhere, action: 'PUBLISH_POST', createdAt: { gte: today } } }),
      prisma.socialActionLog.count({ where: { ...executedWhere, action: 'REPLY_COMMENT', createdAt: { gte: hourAgo } } }),
      prisma.socialActionLog.findFirst({ where: { ...executedWhere, action: p.actionType }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      ctx.targetUserId ? prisma.socialActionLog.count({ where: { ...executedWhere, targetType: 'USER', targetId: ctx.targetUserId, createdAt: { gte: today } } }) : Promise.resolve(0),
    ]);
    if (p.actionType === 'PUBLISH_POST' && postsToday >= cap.maxPostsPerDay) return fail('rate_limit', `Daily post limit reached (${cap.maxPostsPerDay}).`, 'POSTS_PER_DAY', ctx);
    if (p.actionType === 'REPLY_COMMENT' && repliesLastHour >= cap.maxRepliesPerHour) return fail('rate_limit', `Hourly reply limit reached (${cap.maxRepliesPerHour}).`, 'REPLIES_PER_HOUR', ctx);
    if (lastAction && Date.now() - lastAction.createdAt.getTime() < cap.cooldownSeconds * 1000) return fail('rate_limit', 'Cooldown between actions has not elapsed.', 'COOLDOWN', ctx);
    if (ctx.targetUserId && perUserToday >= cap.maxInteractionsPerUserPerDay) return fail('rate_limit', 'Per-person interaction limit reached.', 'PER_USER_LIMIT', ctx);
    if (p.actionType === 'SEND_NOTIFICATION' && ctx.targetUserId && perUserToday >= 1) return fail('rate_limit', 'At most one character notification per person per day.', 'NOTIFY_PER_DAY', ctx);
    pass('rate_limit', 'Within limits');

    // 8. Budget (character, creator, global) — exceeding gracefully disables generation
    const config = await SocialPolicyService.getConfig();
    const [charSpend, creatorSpend, globalSpend] = await Promise.all([
      prisma.socialActionLog.aggregate({ where: { characterId: character.id, createdAt: { gte: today }, ...(opts.excludeLogId ? { id: { not: opts.excludeLogId } } : {}) }, _sum: { costCents: true } }),
      prisma.socialActionLog.aggregate({ where: { onBehalfOfUserId: ctx.creatorUserId, createdAt: { gte: today }, ...(opts.excludeLogId ? { id: { not: opts.excludeLogId } } : {}) }, _sum: { costCents: true } }),
      prisma.socialActionLog.aggregate({ where: { actorType: { in: ['AI_CHARACTER', 'SCHEDULER'] }, createdAt: { gte: today }, ...(opts.excludeLogId ? { id: { not: opts.excludeLogId } } : {}) }, _sum: { costCents: true } }),
    ]);
    if ((charSpend._sum.costCents ?? 0) + cost > cap.maxDailyCostCents) return fail('budget', 'Character daily AI budget exhausted.', 'CHARACTER_BUDGET', ctx);
    if ((creatorSpend._sum.costCents ?? 0) + cost > config.aiSocial.perCreatorDailyBudgetCents) return fail('budget', 'Creator daily AI social budget exhausted.', 'CREATOR_BUDGET', ctx);
    if ((globalSpend._sum.costCents ?? 0) + cost > config.aiSocial.globalDailyBudgetCents) return fail('budget', 'Platform AI social budget exhausted.', 'GLOBAL_BUDGET', ctx);
    pass('budget', `${cost}¢ within budgets`);

    // 9. Platform policy (feature flags / kill switches)
    if (!(await SocialPolicyService.isFeatureEnabled('character_social_actions', { userId: ctx.creatorUserId }))) {
      return fail('platform_policy', 'Character social actions are disabled on the platform.', 'FEATURE_DISABLED', ctx);
    }
    if (p.actionType === 'PUBLISH_POST' && !(await SocialPolicyService.isFeatureEnabled('ai_social_posts', { userId: ctx.creatorUserId }))) {
      return fail('platform_policy', 'AI social posts are disabled on the platform.', 'FEATURE_DISABLED', ctx);
    }
    pass('platform_policy', 'Enabled');

    // 10. Action risk → approval / review routing
    const needsApproval = !opts.creatorApproved && cap.requiresCreatorApproval && p.actionType !== 'SEND_NOTIFICATION';
    const notifyNeedsApproval = !opts.creatorApproved && p.actionType === 'SEND_NOTIFICATION';
    pass('action_risk', needsApproval || notifyNeedsApproval ? 'Requires creator approval' : moderationNeeded ? 'Requires moderation' : 'Low risk');

    const decision: SocialSafetyDecision = needsApproval || notifyNeedsApproval
      ? { action: 'REQUIRE_CONFIRMATION', reasons: ['CREATOR_APPROVAL_REQUIRED', ...(moderationNeeded ? ['MODERATION_REQUIRED'] : [])] }
      : moderationNeeded
        ? { action: 'REQUIRE_MODERATION', reasons: ['MODERATION_REQUIRED'] }
        : { action: 'ALLOW', reasons: [] };
    return { decision, steps, ctx, sanitizedText, estimatedCostCents: cost };
  }
}
