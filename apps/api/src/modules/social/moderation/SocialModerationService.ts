import { Prisma, type ReportReasonCode, type SocialModerationQueue, type SocialReportTargetType } from '@prisma/client';
import { ErrorCode, SOCIAL_CONSTANTS } from '@ai-companion/config';
import type { SocialCursorPage, SocialEnforcementNotice, SocialModerationCaseItem, SocialReportReceipt } from '@ai-companion/types';
import type { AdminSocialCaseDecisionInput, SocialReportInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { CharacterModerationService } from '../../moderation/services/CharacterModerationService.js';
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialAccessService } from '../access/SocialAccessService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { decodeCursor, keysetAfter, toPage } from '../shared/ids.js';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
const SEVERITY_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const REASON_SEVERITY: Record<string, Severity> = {
  MINOR_SAFETY: 'CRITICAL',
  SELF_HARM: 'HIGH',
  VIOLENCE: 'HIGH',
  HATE: 'HIGH',
  HARASSMENT: 'MEDIUM',
  SEXUAL_CONTENT: 'MEDIUM',
  SCAM: 'MEDIUM',
  PRIVACY_VIOLATION: 'HIGH',
  IMPERSONATION: 'MEDIUM',
  MISLEADING_AI_CONTENT: 'MEDIUM',
  INTELLECTUAL_PROPERTY: 'LOW',
  SPAM: 'LOW',
  OTHER: 'LOW',
};

/** Social reasons → existing character report taxonomy (reused, not duplicated). */
const CHARACTER_REASON_MAP: Record<string, ReportReasonCode> = {
  HARASSMENT: 'HARASSMENT',
  HATE: 'UNSAFE',
  SEXUAL_CONTENT: 'SEXUAL_CONTENT',
  MINOR_SAFETY: 'UNSAFE',
  VIOLENCE: 'UNSAFE',
  SELF_HARM: 'UNSAFE',
  IMPERSONATION: 'IMPERSONATION',
  SCAM: 'MISLEADING',
  PRIVACY_VIOLATION: 'UNSAFE',
  INTELLECTUAL_PROPERTY: 'COPYRIGHT',
  MISLEADING_AI_CONTENT: 'MISLEADING',
  SPAM: 'SPAM',
  OTHER: 'OTHER',
};

interface ResolvedTarget {
  targetType: SocialReportTargetType;
  targetId: string;
  subjectUserId: string | null;
  queue: SocialModerationQueue;
  reach: number;
  automatedFlagged: boolean;
}

/** Transparent, user-facing copy for decisions (never reveals anti-abuse internals). */
const DECISION_COPY: Record<string, string> = {
  RESTRICT_CONTENT: 'Your content has limited visibility after a review.',
  HIDE_CONTENT: 'Your content was hidden because it goes against our community guidelines.',
  REMOVE_CONTENT: 'Your content was removed because it goes against our community guidelines.',
  RESTRICT_USER_SOCIAL: 'Some social features are temporarily restricted on your account.',
  SUSPEND_USER: 'Your account has been suspended.',
};

export class SocialModerationService {
  // ---------------------------------------------------------------------------
  // Priority
  // ---------------------------------------------------------------------------

  /** Severity dominates; then user-safety risk, confidence (automated signal), reach/virality, and report volume. */
  public static priority(p: { severity: Severity; uniqueReporters: number; reach: number; automatedFlagged: boolean; ageHours: number }): number {
    const severity = SEVERITY_RANK[p.severity] * 25;
    const volume = Math.min(20, Math.log2(1 + p.uniqueReporters) * 6);
    const reach = Math.min(20, Math.log10(1 + p.reach) * 8);
    const confidence = p.automatedFlagged ? 10 : 0;
    const staleness = Math.min(10, p.ageHours / 6);
    return Number((severity + volume + reach + confidence + staleness).toFixed(2));
  }

  // ---------------------------------------------------------------------------
  // Automated cases (content flagged before publication)
  // ---------------------------------------------------------------------------

  public static async openAutomatedCase(params: {
    targetType: SocialReportTargetType;
    targetId: string;
    subjectUserId: string | null;
    queue: SocialModerationQueue;
    severity: Severity;
    signals: Record<string, unknown>;
    reasons: string[];
  }): Promise<string> {
    const openKey = `${params.targetType}:${params.targetId}`;
    const reasonCounts = Object.fromEntries(params.reasons.map((r) => [`AUTO_${r}`, 1]));
    const policyVersion = (await SocialPolicyService.getActive()).version;
    const targetVersion =
      params.targetType === 'CONTENT'
        ? (await prisma.socialContent.findUnique({ where: { id: params.targetId }, select: { version: true } }))?.version ?? null
        : null;
    const priorityScore = this.priority({ severity: params.severity, uniqueReporters: 0, reach: 0, automatedFlagged: true, ageHours: 0 });
    const row = await prisma.socialModerationCase.upsert({
      where: { openKey },
      create: {
        targetType: params.targetType,
        targetId: params.targetId,
        openKey,
        subjectUserId: params.subjectUserId,
        queue: params.queue,
        severity: params.severity,
        priorityScore,
        reasonCounts,
        automatedSignals: params.signals as Prisma.InputJsonValue,
        targetVersion,
        openedPolicyVersion: policyVersion,
      },
      update: { automatedSignals: params.signals as Prisma.InputJsonValue, severity: params.severity, priorityScore, targetVersion },
    });
    return row.id;
  }

  // ---------------------------------------------------------------------------
  // User reports (deduplicated per reporter, aggregated per target)
  // ---------------------------------------------------------------------------

  private static async resolveTarget(reporterId: string, input: SocialReportInput): Promise<ResolvedTarget | { characterDelegated: true; characterId: string }> {
    switch (input.targetType) {
      case 'PROFILE':
      case 'CREATOR': {
        const u = await SocialProfileService.resolveOrThrow(input.target);
        if (u.userId === reporterId) throw new BadRequestError("You can't report yourself.");
        const p = await prisma.socialProfile.findUnique({ where: { userId: u.userId }, select: { followersCount: true } });
        return { targetType: input.targetType, targetId: u.userId, subjectUserId: u.userId, queue: input.targetType === 'CREATOR' ? 'CREATORS' : 'PROFILES', reach: p?.followersCount ?? 0, automatedFlagged: false };
      }
      case 'CHARACTER': {
        const c = await prisma.character.findFirst({ where: { slug: input.target, deletedAt: null }, select: { id: true } });
        if (!c) throw new NotFoundError('Character not found');
        return { characterDelegated: true, characterId: c.id };
      }
      case 'CONTENT': {
        const c = await prisma.socialContent.findUnique({ where: { publicId: input.target } });
        if (!c) throw new NotFoundError('Content not found', ErrorCode.SOCIAL_CONTENT_NOT_FOUND);
        const access = await SocialAccessService.canViewContent(reporterId, c);
        if (!access.allowed) throw new NotFoundError('Content not found', ErrorCode.SOCIAL_CONTENT_NOT_FOUND);
        const queue: SocialModerationQueue = c.isAiGenerated ? 'AI_SOCIAL_CONTENT' : c.kind === 'MEDIA_SHARE' ? 'MEDIA' : c.communityId ? 'COMMUNITIES' : 'USER_CONTENT';
        const flagged = c.moderationStatus === 'FLAGGED';
        const reach = c.reactionCount + c.commentCount * 2 + (c.visibility === 'PUBLIC' ? 50 : 0);
        return { targetType: 'CONTENT', targetId: c.id, subjectUserId: c.authorUserId, queue, reach, automatedFlagged: flagged };
      }
      case 'COMMENT': {
        const cm = await prisma.socialComment.findUnique({ where: { id: input.target }, include: { content: true } });
        if (!cm || cm.deletedAt) throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);
        const access = await SocialAccessService.canViewContent(reporterId, cm.content);
        if (!access.allowed) throw new NotFoundError('Comment not found', ErrorCode.SOCIAL_COMMENT_NOT_FOUND);
        return { targetType: 'COMMENT', targetId: cm.id, subjectUserId: cm.authorUserId, queue: 'COMMENTS', reach: cm.replyCount, automatedFlagged: cm.moderationReasons !== null };
      }
      case 'DIRECT_MESSAGE': {
        const m = await prisma.socialDirectMessage.findUnique({ where: { id: input.target }, select: { id: true, threadId: true, senderUserId: true } });
        if (!m) throw new NotFoundError('Message not found');
        const participant = await prisma.socialDirectParticipant.findUnique({ where: { threadId_userId: { threadId: m.threadId, userId: reporterId } } });
        // Only a participant can report a message: prevents IDOR probing of message ids.
        if (!participant || m.senderUserId === reporterId) throw new NotFoundError('Message not found');
        return { targetType: 'DIRECT_MESSAGE', targetId: m.id, subjectUserId: m.senderUserId, queue: 'MESSAGES', reach: 1, automatedFlagged: false };
      }
      case 'COMMUNITY': {
        const c = await prisma.community.findFirst({ where: { slug: input.target, deletedAt: null }, select: { id: true, ownerUserId: true, memberCount: true } });
        if (!c) throw new NotFoundError('Community not found', ErrorCode.SOCIAL_COMMUNITY_NOT_FOUND);
        return { targetType: 'COMMUNITY', targetId: c.id, subjectUserId: c.ownerUserId, queue: 'COMMUNITIES', reach: c.memberCount, automatedFlagged: false };
      }
      default:
        throw new BadRequestError('Unsupported report target');
    }
  }

  public static async report(reporterId: string, input: SocialReportInput, requestId?: string): Promise<SocialReportReceipt> {
    if (!(SOCIAL_CONSTANTS.REPORT_REASONS as readonly string[]).includes(input.reasonCode)) throw new BadRequestError('Unknown report reason');
    await SocialRateLimiter.enforce('report', reporterId);

    const target = await this.resolveTarget(reporterId, input);
    if ('characterDelegated' in target) {
      const r = await CharacterModerationService.submitUserReport(reporterId, {
        characterId: target.characterId,
        reasonCode: CHARACTER_REASON_MAP[input.reasonCode] ?? 'OTHER',
        details: input.details && input.details.length >= 10 ? input.details : `Reported via social surface (${input.reasonCode})`,
      });
      SocialEvents.emit('ReportCreated', { actorUserId: reporterId, contentType: 'CHARACTER', characterId: target.characterId, requestId });
      return { reportId: r.reportId, status: 'RECEIVED', duplicate: false };
    }

    const config = await SocialPolicyService.getConfig();
    const existing = await prisma.socialReport.findUnique({
      where: { reporterUserId_targetType_targetId: { reporterUserId: reporterId, targetType: target.targetType, targetId: target.targetId } },
      select: { id: true },
    });
    if (existing) return { reportId: existing.id, status: 'RECEIVED', duplicate: true };

    const severity = REASON_SEVERITY[input.reasonCode] ?? 'LOW';
    const openKey = `${target.targetType}:${target.targetId}`;
    let reportId: string;
    let autoHidden = false;

    try {
      reportId = await prisma.$transaction(async (tx) => {
        const now = new Date();
        let kase = await tx.socialModerationCase.findUnique({ where: { openKey } });
        if (!kase) {
          kase = await tx.socialModerationCase.create({
            data: {
              targetType: target.targetType,
              targetId: target.targetId,
              openKey,
              subjectUserId: target.subjectUserId,
              queue: target.queue,
              severity,
              reach: target.reach,
              firstReportedAt: now,
              openedPolicyVersion: (await SocialPolicyService.getActive()).version,
            },
          });
        }
        const report = await tx.socialReport.create({
          data: { reporterUserId: reporterId, targetType: target.targetType, targetId: target.targetId, reasonCode: input.reasonCode, details: input.details ?? null, caseId: kase.id },
        });

        const reasonCounts = { ...((kase.reasonCounts as Record<string, number>) ?? {}) };
        reasonCounts[input.reasonCode] = (reasonCounts[input.reasonCode] ?? 0) + 1;
        const nextSeverity = SEVERITY_RANK[severity] > SEVERITY_RANK[kase.severity as Severity] ? severity : (kase.severity as Severity);
        const uniqueReporters = kase.uniqueReporterCount + 1;
        await tx.socialModerationCase.update({
          where: { id: kase.id },
          data: {
            reportCount: { increment: 1 },
            uniqueReporterCount: uniqueReporters,
            reasonCounts,
            severity: nextSeverity,
            reach: target.reach,
            lastReportedAt: now,
            firstReportedAt: kase.firstReportedAt ?? now,
            priorityScore: this.priority({
              severity: nextSeverity,
              uniqueReporters,
              reach: target.reach,
              automatedFlagged: target.automatedFlagged,
              ageHours: (now.getTime() - kase.createdAt.getTime()) / 3_600_000,
            }),
          },
        });

        // Report volume alone never determines guilt: temporary hiding pending review additionally
        // requires an independent automated signal (unless policy explicitly disables that guard).
        const signalOk = !config.moderation.autoHideRequiresAutomatedSignal || target.automatedFlagged || nextSeverity === 'CRITICAL';
        if (target.targetType === 'CONTENT' && uniqueReporters >= config.moderation.autoHideReportThreshold && signalOk) {
          const res = await tx.socialContent.updateMany({ where: { id: target.targetId, status: 'PUBLISHED' }, data: { status: 'RESTRICTED' } });
          autoHidden = res.count > 0;
        }
        return report.id;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { reportId: 'duplicate', status: 'RECEIVED', duplicate: true };
      }
      throw err;
    }

    if (autoHidden) {
      await this.recordAction({ scope: 'PLATFORM', actorType: 'SYSTEM', action: 'AUTO_RESTRICT_PENDING_REVIEW', targetType: 'CONTENT', targetId: target.targetId, reason: 'Report threshold + automated signal' });
      SocialEvents.emit('ContentRemoved', { contentId: target.targetId, source: 'auto_restrict' });
    }
    SocialEvents.emit('ReportCreated', { actorUserId: reporterId, contentType: target.targetType, requestId });
    return { reportId, status: 'RECEIVED', duplicate: false };
  }

  // ---------------------------------------------------------------------------
  // Admin queues & decisions
  // ---------------------------------------------------------------------------

  public static async listCases(params: { queue?: SocialModerationQueue; status?: string; cursor?: string; limit: number }): Promise<SocialCursorPage<SocialModerationCaseItem>> {
    const rows = await prisma.socialModerationCase.findMany({
      where: {
        ...(params.queue ? { queue: params.queue } : {}),
        status: params.status ? (params.status as never) : { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] },
        ...keysetAfter(decodeCursor(params.cursor)),
      },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
    });
    const page = toPage(rows, params.limit, (r) => ({ at: r.createdAt, id: r.id }));
    return { items: page.items.map((c) => this.toCaseItem(c)), nextCursor: page.nextCursor };
  }

  public static toCaseItem(c: Prisma.SocialModerationCaseGetPayload<object>): SocialModerationCaseItem {
    return {
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      queue: c.queue,
      status: c.status,
      severity: c.severity,
      priorityScore: c.priorityScore,
      reportCount: c.reportCount,
      uniqueReporterCount: c.uniqueReporterCount,
      reasonCounts: (c.reasonCounts as Record<string, number>) ?? {},
      automatedSignals: (c.automatedSignals as Record<string, unknown>) ?? null,
      reach: c.reach,
      decision: c.decision,
      firstReportedAt: c.firstReportedAt?.toISOString() ?? null,
      lastReportedAt: c.lastReportedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }

  /**
   * Admin inspection of a case. Returns public content & metadata; private DM bodies are NOT included
   * (break-glass access is a separate, permissioned and audited call).
   */
  public static async getCase(caseId: string, adminId: string) {
    const c = await prisma.socialModerationCase.findUnique({ where: { id: caseId }, include: { reports: { orderBy: { createdAt: 'desc' }, take: 50 }, appeals: true } });
    if (!c) throw new NotFoundError('Case not found');
    let target: Record<string, unknown> | null = null;
    if (c.targetType === 'CONTENT') {
      const content = await prisma.socialContent.findUnique({ where: { id: c.targetId }, select: { publicId: true, kind: true, title: true, body: true, snapshot: true, status: true, isAiGenerated: true, aiProvenance: true, moderationReasons: true, version: true, createdAt: true } });
      target = content as Record<string, unknown> | null;
    } else if (c.targetType === 'COMMENT') {
      target = (await prisma.socialComment.findUnique({ where: { id: c.targetId }, select: { body: true, status: true, authorType: true, moderationReasons: true, createdAt: true } })) as Record<string, unknown> | null;
    } else if (c.targetType === 'DIRECT_MESSAGE') {
      target = (await prisma.socialDirectMessage.findUnique({ where: { id: c.targetId }, select: { status: true, createdAt: true, moderationStatus: true } })) as Record<string, unknown> | null;
      if (target) target['body'] = '[private — requires break-glass access]';
    } else if (c.targetType === 'COMMUNITY') {
      target = (await prisma.community.findUnique({ where: { id: c.targetId }, select: { slug: true, name: true, description: true, rules: true, privacy: true, status: true, memberCount: true } })) as Record<string, unknown> | null;
    } else if (c.targetType === 'PROFILE' || c.targetType === 'CREATOR') {
      target = (await prisma.socialProfile.findUnique({ where: { userId: c.targetId }, select: { publicId: true, username: true, displayName: true, bio: true, status: true } })) as Record<string, unknown> | null;
    }
    if (c.status === 'OPEN') await prisma.socialModerationCase.update({ where: { id: c.id }, data: { status: 'IN_REVIEW' } });
    await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'SOCIAL_CASE_VIEWED', resourceType: 'social_moderation_case', resourceId: caseId });
    return {
      case: this.toCaseItem(c),
      target,
      reports: c.reports.map((r) => ({ id: r.id, reasonCode: r.reasonCode, details: r.details, createdAt: r.createdAt.toISOString() })),
      appeals: c.appeals.map((a) => ({ id: a.id, status: a.status, reason: a.reason, createdAt: a.createdAt.toISOString() })),
      moderatorNotes: c.moderatorNotes,
    };
  }

  /** Current lifecycle state of a moderation target (for the audit trail). */
  private static async targetState(tx: Prisma.TransactionClient, targetType: SocialReportTargetType, targetId: string): Promise<{ state: string | null; version: number | null }> {
    switch (targetType) {
      case 'CONTENT': {
        const c = await tx.socialContent.findUnique({ where: { id: targetId }, select: { status: true, version: true } });
        return { state: c?.status ?? null, version: c?.version ?? null };
      }
      case 'COMMENT':
        return { state: (await tx.socialComment.findUnique({ where: { id: targetId }, select: { status: true } }))?.status ?? null, version: null };
      case 'DIRECT_MESSAGE':
        return { state: (await tx.socialDirectMessage.findUnique({ where: { id: targetId }, select: { status: true } }))?.status ?? null, version: null };
      case 'COMMUNITY':
        return { state: (await tx.community.findUnique({ where: { id: targetId }, select: { status: true } }))?.status ?? null, version: null };
      case 'PROFILE':
      case 'CREATOR':
        return { state: (await tx.socialProfile.findUnique({ where: { userId: targetId }, select: { status: true } }))?.status ?? null, version: null };
      default:
        return { state: null, version: null };
    }
  }

  /**
   * Applies a moderator decision atomically:
   *  - the case is claimed inside the transaction (two moderators can't both decide it),
   *  - content decisions are bound to the reviewed version (optimistic concurrency),
   *  - previous/new state, policy version and the moderator are recorded,
   *  - the resulting events are written to the outbox in the same transaction.
   */
  public static async decide(caseId: string, adminId: string, input: AdminSocialCaseDecisionInput): Promise<SocialModerationCaseItem> {
    if (input.decision === 'SUSPEND_USER' && !input.confirm) {
      throw new AppError('Suspending an account requires explicit confirmation.', 400, ErrorCode.SOCIAL_CONFIRMATION_REQUIRED);
    }
    const policyVersion = (await SocialPolicyService.getActive()).version;
    const contentStatus: Record<string, 'RESTRICTED' | 'HIDDEN' | 'DELETED' | 'PUBLISHED' | undefined> = {
      RESTRICT_CONTENT: 'RESTRICTED',
      HIDE_CONTENT: 'HIDDEN',
      REMOVE_CONTENT: 'DELETED',
      RESTORE_CONTENT: 'PUBLISHED',
    };

    const { c, previous, next, eventIds } = await prisma.$transaction(async (tx) => {
      const claimed = await tx.socialModerationCase.updateMany({
        where: { id: caseId, status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] } },
        data: { status: 'IN_REVIEW' },
      });
      if (claimed.count === 0) {
        const exists = await tx.socialModerationCase.count({ where: { id: caseId } });
        if (!exists) throw new NotFoundError('Case not found');
        throw new ConflictError('Case already resolved');
      }
      const c = await tx.socialModerationCase.findUniqueOrThrow({ where: { id: caseId } });
      const previous = await this.targetState(tx, c.targetType, c.targetId);
      if (c.targetType === 'CONTENT' && input.expectedVersion !== undefined && previous.version !== input.expectedVersion) {
        throw new ConflictError('The content changed after you reviewed it. Reload the case and review the current version.');
      }

      const status = contentStatus[input.decision];
      if (status) {
        if (c.targetType === 'CONTENT') {
          const res = await tx.socialContent.updateMany({
            where: { id: c.targetId, ...(previous.version !== null ? { version: previous.version } : {}) },
            data: {
              status,
              moderationStatus: status === 'PUBLISHED' ? 'APPROVED' : 'REJECTED',
              ...(status === 'DELETED' ? { deletedAt: new Date() } : {}),
              ...(status === 'PUBLISHED' ? { publishedAt: new Date(), deletedAt: null } : {}),
            },
          });
          if (res.count === 0) throw new ConflictError('The content changed while this decision was being applied. Review it again.');
        } else if (c.targetType === 'COMMENT') {
          await this.setCommentStatusInTx(tx, c.targetId, status === 'PUBLISHED' ? 'PUBLISHED' : status === 'DELETED' ? 'REMOVED' : 'HIDDEN');
        } else if (c.targetType === 'DIRECT_MESSAGE') {
          await tx.socialDirectMessage.update({ where: { id: c.targetId }, data: status === 'PUBLISHED' ? { status: 'SENT', moderationStatus: 'APPROVED' } : { status: 'MODERATED', moderationStatus: 'REJECTED' } });
        } else if (c.targetType === 'COMMUNITY') {
          await tx.community.update({ where: { id: c.targetId }, data: { status: status === 'PUBLISHED' ? 'ACTIVE' : status === 'RESTRICTED' ? 'RESTRICTED' : 'SUSPENDED' } });
        } else if (c.targetType === 'PROFILE' || c.targetType === 'CREATOR') {
          await tx.socialProfile.update({ where: { userId: c.targetId }, data: { status: status === 'PUBLISHED' ? 'ACTIVE' : status === 'RESTRICTED' ? 'RESTRICTED' : 'HIDDEN' } });
        }
      }

      if ((input.decision === 'RESTRICT_USER_SOCIAL' || input.decision === 'SUSPEND_USER') && c.subjectUserId) {
        await tx.userRestriction.create({
          data: {
            userId: c.subjectUserId,
            restrictionType: input.decision === 'SUSPEND_USER' ? 'ACCOUNT_SUSPENDED' : 'SOCIAL_RESTRICTED',
            reason: input.userFacingReason ?? input.notes,
            issuedByAdminId: adminId,
            expiresAt: input.restrictionHours ? new Date(Date.now() + input.restrictionHours * 3_600_000) : null,
            metadata: { socialCaseId: c.id },
          },
        });
      }

      await tx.socialModerationCase.update({
        where: { id: c.id },
        data: {
          status: input.decision === 'DISMISS' ? 'DISMISSED' : input.decision === 'ESCALATE' ? 'ESCALATED' : 'ACTIONED',
          openKey: input.decision === 'ESCALATE' ? c.openKey : null,
          decision: input.decision,
          decisionNotes: input.userFacingReason ?? null,
          moderatorNotes: input.notes,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          decidedPolicyVersion: policyVersion,
          targetVersion: previous.version ?? c.targetVersion,
        },
      });
      const next = await this.targetState(tx, c.targetType, c.targetId);
      await tx.socialModerationAction.create({
        data: {
          scope: 'PLATFORM',
          caseId: c.id,
          actorType: 'ADMIN',
          actorId: adminId,
          action: input.decision,
          targetType: c.targetType,
          targetId: c.targetId,
          reason: input.userFacingReason ?? null,
          notes: input.notes,
          previousState: previous.state,
          newState: next.state,
          policyVersion,
        },
      });

      const eventIds = [
        await SocialEvents.record(tx, 'ModerationActioned', { recipientUserId: c.subjectUserId, contentId: c.targetId, contentType: c.targetType, internal: { decision: input.decision, caseId: c.id, message: DECISION_COPY[input.decision] ?? null } }),
      ];
      if (['RESTRICT_CONTENT', 'HIDE_CONTENT', 'REMOVE_CONTENT'].includes(input.decision)) {
        eventIds.push(await SocialEvents.record(tx, 'ContentRemoved', { contentId: c.targetId, source: 'moderation' }));
      }
      return { c, previous, next, eventIds };
    });

    await AuditService.log({
      actorType: 'ADMIN',
      actorId: adminId,
      action: `SOCIAL_CASE_${input.decision}`,
      resourceType: 'social_moderation_case',
      resourceId: c.id,
      metadata: { targetType: c.targetType, targetId: c.targetId, previousState: previous.state, newState: next.state, policyVersion },
    });
    SocialEvents.kickAfterCommit(eventIds);
    const updated = await prisma.socialModerationCase.findUniqueOrThrow({ where: { id: c.id } });
    return this.toCaseItem(updated);
  }

  private static async setCommentStatusInTx(tx: Prisma.TransactionClient, commentId: string, status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED'): Promise<void> {
    const cm = await tx.socialComment.findUnique({ where: { id: commentId }, select: { status: true, contentId: true, parentId: true } });
    if (!cm) return;
    const wasVisible = cm.status === 'PUBLISHED';
    const willBeVisible = status === 'PUBLISHED';
    await tx.socialComment.update({ where: { id: commentId }, data: { status } });
    if (wasVisible !== willBeVisible) {
      const delta = willBeVisible ? 1 : -1;
      await tx.socialContent.update({ where: { id: cm.contentId }, data: { commentCount: { increment: delta } } });
      if (cm.parentId) await tx.socialComment.update({ where: { id: cm.parentId }, data: { replyCount: { increment: delta } } });
    }
  }

  public static async recordAction(a: {
    scope: 'PLATFORM' | 'COMMUNITY';
    communityId?: string | null;
    caseId?: string | null;
    actorType: 'ADMIN' | 'SYSTEM' | 'USER';
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string | null;
    notes?: string | null;
    expiresAt?: Date | null;
    previousState?: string | null;
    newState?: string | null;
    policyVersion?: number | null;
  }): Promise<void> {
    try {
      await prisma.socialModerationAction.create({
        data: {
          scope: a.scope,
          communityId: a.communityId ?? null,
          caseId: a.caseId ?? null,
          actorType: a.actorType,
          actorId: a.actorId ?? null,
          action: a.action,
          targetType: a.targetType,
          targetId: a.targetId,
          reason: a.reason ?? null,
          notes: a.notes ?? null,
          expiresAt: a.expiresAt ?? null,
          previousState: a.previousState ?? null,
          newState: a.newState ?? null,
          policyVersion: a.policyVersion ?? (await SocialPolicyService.getActive()).version,
        },
      });
    } catch (err) {
      logger.error('[SocialModeration] failed to record moderation action', { error: err, action: a.action });
    }
  }

  // ---------------------------------------------------------------------------
  // Transparency & appeals
  // ---------------------------------------------------------------------------

  public static async myEnforcements(userId: string): Promise<SocialEnforcementNotice[]> {
    const config = await SocialPolicyService.getConfig();
    const cases = await prisma.socialModerationCase.findMany({
      where: { subjectUserId: userId, status: 'ACTIONED', decision: { notIn: ['DISMISS', 'RESTORE_CONTENT'] } },
      orderBy: { reviewedAt: 'desc' },
      take: 50,
      include: { appeals: { where: { userId }, select: { status: true } } },
    });
    const restrictions = await prisma.userRestriction.findMany({
      where: { userId, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { restrictionType: true, expiresAt: true, metadata: true },
    });
    return cases.map((c) => {
      const r = restrictions.find((x) => (x.metadata as Record<string, unknown> | null)?.['socialCaseId'] === c.id);
      const withinWindow = !!c.reviewedAt && Date.now() - c.reviewedAt.getTime() < config.moderation.appealWindowDays * 86_400_000;
      return {
        caseId: c.id,
        what: c.decisionNotes ?? DECISION_COPY[c.decision ?? ''] ?? 'A moderation action was taken.',
        feature: r ? r.restrictionType : c.targetType,
        until: r?.expiresAt?.toISOString() ?? null,
        canAppeal: withinWindow && c.appeals.length === 0,
        appealStatus: c.appeals[0]?.status ?? null,
      };
    });
  }

  public static async submitAppeal(userId: string, caseId: string, reason: string) {
    const config = await SocialPolicyService.getConfig();
    const c = await prisma.socialModerationCase.findUnique({ where: { id: caseId } });
    // Only the subject of an actioned case may appeal; others get a not-found (no case enumeration).
    if (!c || c.subjectUserId !== userId || c.status !== 'ACTIONED') throw new NotFoundError('Case not found');
    if (!c.reviewedAt || Date.now() - c.reviewedAt.getTime() > config.moderation.appealWindowDays * 86_400_000) {
      throw new ForbiddenError('The appeal window for this decision has closed.');
    }
    try {
      const appeal = await prisma.socialAppeal.create({
        data: { userId, caseId, reason, expiresAt: new Date(Date.now() + 30 * 86_400_000) },
      });
      await AuditService.log({ actorType: 'USER', actorId: userId, action: 'SOCIAL_APPEAL_SUBMITTED', resourceType: 'social_appeal', resourceId: appeal.id, metadata: { caseId } });
      return { id: appeal.id, status: appeal.status };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('You already appealed this decision.');
      throw err;
    }
  }

  public static async listAppeals(status: string | undefined, limit = 50) {
    const rows = await prisma.socialAppeal.findMany({
      where: { status: (status as never) ?? { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { moderationCase: true },
    });
    return rows.map((a) => ({ id: a.id, status: a.status, reason: a.reason, createdAt: a.createdAt.toISOString(), case: this.toCaseItem(a.moderationCase) }));
  }

  public static async decideAppeal(appealId: string, adminId: string, decision: 'UPHOLD' | 'REVERSE', notes: string) {
    const appeal = await prisma.socialAppeal.findUnique({ where: { id: appealId }, include: { moderationCase: true } });
    if (!appeal) throw new NotFoundError('Appeal not found');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(appeal.status)) throw new ConflictError('Appeal already decided');
    const c = appeal.moderationCase;
    const states = await prisma.$transaction(async (tx) => {
      const before = await this.targetState(tx, c.targetType, c.targetId);
      await tx.socialAppeal.update({
        where: { id: appealId },
        data: { status: decision === 'UPHOLD' ? 'UPHELD' : 'REVERSED', decisionNotes: notes, reviewedByAdminId: adminId, reviewedAt: new Date() },
      });
      if (decision === 'REVERSE') {
        if (c.targetType === 'CONTENT') {
          await tx.socialContent.update({ where: { id: c.targetId }, data: { status: 'PUBLISHED', moderationStatus: 'APPROVED', deletedAt: null } });
        } else if (c.targetType === 'COMMENT') {
          await this.setCommentStatusInTx(tx, c.targetId, 'PUBLISHED');
        } else if (c.targetType === 'COMMUNITY') {
          await tx.community.update({ where: { id: c.targetId }, data: { status: 'ACTIVE' } });
        } else if (c.targetType === 'PROFILE' || c.targetType === 'CREATOR') {
          await tx.socialProfile.update({ where: { userId: c.targetId }, data: { status: 'ACTIVE' } });
        }
        await tx.userRestriction.updateMany({
          where: { userId: appeal.userId, isActive: true, metadata: { path: ['socialCaseId'], equals: c.id } },
          data: { isActive: false, revokedAt: new Date() },
        });
      }
      const after = await this.targetState(tx, c.targetType, c.targetId);
      return { before: before.state, after: after.state };
    });

    await this.recordAction({ scope: 'PLATFORM', caseId: c.id, actorType: 'ADMIN', actorId: adminId, action: `APPEAL_${decision}`, targetType: c.targetType, targetId: c.targetId, notes, previousState: states.before, newState: states.after });
    await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: `SOCIAL_APPEAL_${decision}`, resourceType: 'social_appeal', resourceId: appealId });
    SocialEvents.emit('ModerationActioned', {
      recipientUserId: appeal.userId,
      contentType: c.targetType,
      internal: { decision: `APPEAL_${decision}`, caseId: c.id, message: decision === 'REVERSE' ? 'Your appeal was accepted and the decision was reversed.' : 'Your appeal was reviewed and the original decision stands.' },
    });
    return { id: appealId, status: decision === 'UPHOLD' ? 'UPHELD' : 'REVERSED' };
  }
}
