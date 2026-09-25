import crypto from 'crypto';
import { Prisma, type SocialActionLog } from '@prisma/client';
import type { SocialSafetyDecision, SocialSimulationStep } from '@ai-companion/types';
import { characterSocialActionProposalSchema, type CharacterSocialActionProposalInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { AIEconomicsService } from '../../analytics/services/AIEconomicsService.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { SocialNotificationService } from '../notifications/SocialNotificationService.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { generatePublicId } from '../shared/ids.js';
import { CharacterSocialActionValidator, type ValidationContext } from './CharacterSocialActionValidator.js';

export const SOCIAL_ACTION_TOOL_VERSION = 'social-actions@1.0.0';

export interface SocialActionResult {
  actionLogId: string;
  status: 'EXECUTED' | 'PENDING_APPROVAL' | 'DENIED' | 'PENDING_MODERATION';
  decision: SocialSafetyDecision;
  steps: SocialSimulationStep[];
  /** Public id of created content, or comment id. */
  resultRef: string | null;
  replayed: boolean;
}

export interface SocialActionActor {
  actorType: 'AI_CHARACTER' | 'SCHEDULER';
  requestId?: string | null;
}

/**
 * The ONLY path by which a character can cause a social side effect.
 *
 * A model can propose an action (via the Action Gateway tool `social.propose_action` or the
 * scheduler). This gateway validates it, routes it to creator approval / moderation, executes it,
 * and writes a complete audit record. Nothing in model output is ever executed implicitly.
 */
export class CharacterSocialActionGateway {
  public static async propose(rawProposal: unknown, actor: SocialActionActor): Promise<SocialActionResult> {
    const proposal = characterSocialActionProposalSchema.parse(rawProposal);

    // Exactly-once: a retried proposal returns the original outcome.
    const prior = await prisma.socialActionLog.findUnique({ where: { idempotencyKey: proposal.idempotencyKey } });
    if (prior) return this.replay(prior);

    const outcome = await CharacterSocialActionValidator.validate(proposal);
    const ctx = outcome.ctx;

    if (outcome.decision.action === 'BLOCK' || !ctx) {
      const log = await this.log({ proposal, actor, ctx, decision: outcome.decision, steps: outcome.steps, status: 'DENIED', costCents: 0 });
      return { actionLogId: log.id, status: 'DENIED', decision: outcome.decision, steps: outcome.steps, resultRef: null, replayed: false };
    }

    if (outcome.decision.action === 'REQUIRE_CONFIRMATION') {
      const log = await this.log({
        proposal,
        actor,
        ctx,
        decision: outcome.decision,
        steps: outcome.steps,
        status: 'PENDING_APPROVAL',
        payload: { ...proposal, text: outcome.sanitizedText ?? proposal.text },
        costCents: outcome.estimatedCostCents,
      });
      await this.recordUsage(proposal, ctx);
      return { actionLogId: log.id, status: 'PENDING_APPROVAL', decision: outcome.decision, steps: outcome.steps, resultRef: null, replayed: false };
    }

    return this.executeAndLog(proposal, actor, ctx, outcome.decision, outcome.steps, outcome.sanitizedText, outcome.estimatedCostCents, null);
  }

  /** Creator approves a pending action. Everything is re-validated at approval time (never trust stale checks). */
  public static async approve(creatorUserId: string, actionLogId: string): Promise<SocialActionResult> {
    const log = await prisma.socialActionLog.findUnique({ where: { id: actionLogId } });
    if (!log || log.onBehalfOfUserId !== creatorUserId || log.status !== 'PENDING_APPROVAL' || !log.payload) throw new NotFoundError('Pending action not found');
    const proposal = characterSocialActionProposalSchema.parse(log.payload);

    const outcome = await CharacterSocialActionValidator.validate(proposal, { excludeLogId: log.id, creatorApproved: true });
    if (outcome.decision.action === 'BLOCK' || !outcome.ctx) {
      await prisma.socialActionLog.update({ where: { id: log.id }, data: { status: 'DENIED', reasons: outcome.decision.reasons } });
      return { actionLogId: log.id, status: 'DENIED', decision: outcome.decision, steps: outcome.steps, resultRef: null, replayed: false };
    }
    // Guard against double approval (two clicks / two devices).
    const claimed = await prisma.socialActionLog.updateMany({ where: { id: log.id, status: 'PENDING_APPROVAL' }, data: { status: 'EXECUTING' } });
    if (claimed.count === 0) throw new ConflictError('This action was already handled.');
    await AuditService.log({ actorType: 'USER', actorId: creatorUserId, action: 'CHARACTER_SOCIAL_ACTION_APPROVED', resourceType: 'social_action_log', resourceId: log.id });
    return this.executeAndLog(proposal, { actorType: log.actorType as SocialActionActor['actorType'], requestId: log.requestId }, outcome.ctx, outcome.decision, outcome.steps, outcome.sanitizedText, 0, log);
  }

  public static async reject(creatorUserId: string, actionLogId: string): Promise<{ status: 'REJECTED' }> {
    const res = await prisma.socialActionLog.updateMany({ where: { id: actionLogId, onBehalfOfUserId: creatorUserId, status: 'PENDING_APPROVAL' }, data: { status: 'REJECTED' } });
    if (res.count === 0) throw new NotFoundError('Pending action not found');
    await AuditService.log({ actorType: 'USER', actorId: creatorUserId, action: 'CHARACTER_SOCIAL_ACTION_REJECTED', resourceType: 'social_action_log', resourceId: actionLogId });
    return { status: 'REJECTED' };
  }

  public static async listPending(creatorUserId: string) {
    const rows = await prisma.socialActionLog.findMany({
      where: { onBehalfOfUserId: creatorUserId, status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      characterId: r.characterId,
      text: (r.payload as { text?: string } | null)?.text ?? null,
      reasons: r.reasons,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Revocation hook: pending actions are cancelled when consent/capability/standing is withdrawn. */
  public static async cancelPendingFor(filter: { creatorUserId?: string; characterId?: string }, reason: string): Promise<number> {
    const res = await prisma.socialActionLog.updateMany({
      where: { status: 'PENDING_APPROVAL', ...(filter.creatorUserId ? { onBehalfOfUserId: filter.creatorUserId } : {}), ...(filter.characterId ? { characterId: filter.characterId } : {}) },
      data: { status: 'CANCELLED', reasons: [reason] },
    });
    return res.count;
  }

  // ---------------------------------------------------------------------------

  private static async executeAndLog(
    proposal: CharacterSocialActionProposalInput,
    actor: SocialActionActor,
    ctx: ValidationContext,
    decision: SocialSafetyDecision,
    steps: SocialSimulationStep[],
    text: string | null,
    costCents: number,
    existingLog: SocialActionLog | null,
  ): Promise<SocialActionResult> {
    const needsModeration = decision.reasons.includes('MODERATION_REQUIRED') || decision.action === 'REQUIRE_MODERATION';
    let resultRef: string | null = null;
    let status: SocialActionResult['status'] = needsModeration ? 'PENDING_MODERATION' : 'EXECUTED';
    const provenance = proposal.generation
      ? {
          generationId: proposal.generation.generationId,
          model: proposal.generation.model,
          characterVersionId: proposal.generation.characterVersionId ?? null,
          promptVersion: proposal.generation.promptVersion ?? null,
          safetyVersion: proposal.generation.safetyVersion ?? null,
          generatedAt: new Date().toISOString(),
        }
      : null;

    try {
      if (proposal.actionType === 'PUBLISH_POST') {
        const content = await prisma.socialContent.create({
          data: {
            publicId: generatePublicId(),
            kind: 'CHARACTER_POST',
            authorType: 'AI_CHARACTER',
            // The accountable human creator; attribution to the AI is explicit via isAiGenerated/authorType.
            authorUserId: ctx.creatorUserId,
            characterId: ctx.characterId,
            body: text,
            snapshot: {},
            visibility: 'PUBLIC',
            status: needsModeration ? 'PENDING_MODERATION' : 'PUBLISHED',
            moderationStatus: needsModeration ? 'FLAGGED' : 'APPROVED',
            isAiGenerated: true,
            aiProvenance: (provenance ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            publishedAt: needsModeration ? null : new Date(),
          },
        });
        resultRef = content.publicId;
        if (needsModeration) {
          await SocialModerationService.openAutomatedCase({ targetType: 'CONTENT', targetId: content.id, subjectUserId: ctx.creatorUserId, queue: 'AI_SOCIAL_CONTENT', severity: 'MEDIUM', signals: { source: 'ai_generation' }, reasons: decision.reasons });
        } else {
          SocialEvents.emit('ContentPublished', { actorUserId: ctx.creatorUserId, contentId: content.publicId, contentType: 'CHARACTER_POST', characterId: ctx.characterId, visibility: 'PUBLIC' });
        }
      } else if (proposal.actionType === 'REPLY_COMMENT') {
        const comment = await prisma.$transaction(async (tx) => {
          const row = await tx.socialComment.create({
            data: {
              contentId: ctx.targetContentId!,
              authorType: 'AI_CHARACTER',
              authorUserId: null,
              characterId: ctx.characterId,
              parentId: ctx.targetCommentId,
              body: text ?? '',
              status: needsModeration ? 'PENDING_MODERATION' : 'PUBLISHED',
            },
          });
          if (!needsModeration) {
            await tx.socialContent.update({ where: { id: ctx.targetContentId! }, data: { commentCount: { increment: 1 } } });
            await tx.socialComment.update({ where: { id: ctx.targetCommentId! }, data: { replyCount: { increment: 1 } } });
          }
          return row;
        });
        resultRef = comment.id;
        if (needsModeration) {
          await SocialModerationService.openAutomatedCase({ targetType: 'COMMENT', targetId: comment.id, subjectUserId: ctx.creatorUserId, queue: 'AI_SOCIAL_CONTENT', severity: 'MEDIUM', signals: { source: 'ai_generation' }, reasons: decision.reasons });
        }
      } else if (proposal.actionType === 'SEND_NOTIFICATION' && ctx.targetUserId) {
        const character = await prisma.character.findUniqueOrThrow({ where: { id: ctx.characterId }, select: { name: true, slug: true } });
        const delivered = await SocialNotificationService.notify({
          recipientId: ctx.targetUserId,
          actorId: null,
          type: 'character_update',
          aggregateKey: `character_update:${ctx.characterId}:${new Date().toISOString().slice(0, 10)}`,
          deepLink: `/c/${character.slug}`,
          params: { character: `${character.name} (AI character)` },
        });
        status = delivered ? 'EXECUTED' : 'DENIED';
      }
    } catch (err) {
      logger.error('[CharacterSocialActionGateway] execution failed', { error: err instanceof Error ? err.message : err, action: proposal.actionType });
      if (existingLog) await prisma.socialActionLog.update({ where: { id: existingLog.id }, data: { status: 'PENDING_APPROVAL' } });
      throw err;
    }

    const finalStatus = status === 'PENDING_MODERATION' ? 'EXECUTED' : status;
    let logId: string;
    if (existingLog) {
      await prisma.socialActionLog.update({ where: { id: existingLog.id }, data: { status: finalStatus, targetId: resultRef ?? existingLog.targetId, decision: decision.action } });
      logId = existingLog.id;
    } else {
      const log = await this.log({ proposal, actor, ctx, decision, steps, status: finalStatus, costCents, resultRef });
      logId = log.id;
      await this.recordUsage(proposal, ctx);
    }
    SocialEvents.emit('CharacterSocialActionExecuted', { actorUserId: ctx.creatorUserId, characterId: ctx.characterId, contentType: proposal.actionType, internal: { logId } });
    return { actionLogId: logId, status, decision, steps, resultRef, replayed: false };
  }

  private static async log(p: {
    proposal: CharacterSocialActionProposalInput;
    actor: SocialActionActor;
    ctx: ValidationContext | null;
    decision: SocialSafetyDecision;
    steps: SocialSimulationStep[];
    status: string;
    costCents: number;
    payload?: unknown;
    resultRef?: string | null;
  }): Promise<SocialActionLog> {
    try {
      return await prisma.socialActionLog.create({
        data: {
          actorType: p.actor.actorType,
          actorId: p.ctx?.characterId ?? p.proposal.characterSlug,
          onBehalfOfUserId: p.ctx?.creatorUserId ?? null,
          characterId: p.ctx?.characterId ?? null,
          characterVersionId: p.proposal.generation?.characterVersionId ?? null,
          action: p.proposal.actionType,
          targetType: p.ctx?.targetUserId ? 'USER' : p.resultRef ? 'CONTENT' : null,
          targetId: p.ctx?.targetUserId ?? p.resultRef ?? null,
          decision: p.decision.action,
          status: p.status,
          payload: (p.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          reasons: p.decision.reasons,
          authorization: { steps: p.steps } as unknown as Prisma.InputJsonValue,
          consentRef: 'AI_GENERATED_PUBLIC_CONTENT',
          generationId: p.proposal.generation?.generationId ?? null,
          toolVersion: SOCIAL_ACTION_TOOL_VERSION,
          moderationResult: { decision: p.decision.action, reasons: p.decision.reasons } as Prisma.InputJsonValue,
          costCents: p.costCents,
          requestId: p.actor.requestId ?? null,
          idempotencyKey: p.proposal.idempotencyKey,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Concurrent retry won the race.
        return prisma.socialActionLog.findUniqueOrThrow({ where: { idempotencyKey: p.proposal.idempotencyKey } });
      }
      throw err;
    }
  }

  /** Metered through the existing AI usage ledger — no separate hidden billing. */
  private static async recordUsage(proposal: CharacterSocialActionProposalInput, ctx: ValidationContext): Promise<void> {
    if (!proposal.generation) return;
    await AIEconomicsService.recordUsage({
      requestId: proposal.generation.generationId || crypto.randomUUID(),
      provider: proposal.generation.model.split('/')[0] ?? 'unknown',
      model: proposal.generation.model,
      task: 'SOCIAL_GENERATION',
      userId: ctx.creatorUserId,
      characterId: ctx.characterId,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });
  }

  private static replay(log: SocialActionLog): SocialActionResult {
    const steps = ((log.authorization as { steps?: SocialSimulationStep[] } | null)?.steps ?? []) as SocialSimulationStep[];
    return {
      actionLogId: log.id,
      status: log.status === 'EXECUTED' ? 'EXECUTED' : log.status === 'PENDING_APPROVAL' || log.status === 'EXECUTING' ? 'PENDING_APPROVAL' : 'DENIED',
      decision: { action: log.decision as SocialSafetyDecision['action'], reasons: (log.reasons as string[]) ?? [] },
      steps,
      resultRef: log.targetType === 'CONTENT' ? log.targetId : null,
      replayed: true,
    };
  }
}
