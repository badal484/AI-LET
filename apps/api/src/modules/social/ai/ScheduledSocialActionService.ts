import crypto from 'crypto';
import { Prisma, type ScheduledSocialAction } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import type { CharacterSocialActionProposalInput, ScheduledSocialActionInput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { QueueManager } from '../../../infrastructure/queues/QueueManager.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { SocialContentService } from '../content/SocialContentService.js';
import { CharacterSocialActionGateway } from './CharacterSocialActionGateway.js';
import { CharacterSocialCapabilityService } from './CharacterSocialCapabilityService.js';

/** Pluggable generator so prompt-based schedules go through the AI gateway with a known cost. */
export type ScheduledPostGenerator = (input: { characterId: string; promptTemplate: string }) => Promise<{
  text: string;
  generationId: string;
  model: string;
  characterVersionId: string | null;
  promptVersion: string | null;
  safetyVersion: string | null;
  costCents: number;
}>;

export interface ScheduledSocialActionJob {
  actionId: string;
  /** Run number this job was scheduled for (idempotency: a retried job for an old run is a no-op). */
  run: number;
}

export class ScheduledSocialActionService {
  /** Fails closed until a real generator is wired for the deployment. */
  public static generator: ScheduledPostGenerator = async () => {
    throw new AppError('Scheduled AI generation is not configured for this deployment.', 503, ErrorCode.SOCIAL_AI_ACTION_DISALLOWED);
  };

  public static async create(ownerId: string, input: ScheduledSocialActionInput): Promise<ScheduledSocialAction> {
    const config = await SocialPolicyService.getConfig();
    if (input.intervalHours < config.aiSocial.minScheduleIntervalHours) throw new BadRequestError(`Schedules must be at least ${config.aiSocial.minScheduleIntervalHours}h apart.`);
    if (input.budgetCents > config.aiSocial.perCreatorDailyBudgetCents * 7) throw new BadRequestError('Budget exceeds the allowed maximum.');

    let characterId: string | null = null;
    if (input.actionType === 'CHARACTER_POST') {
      await SocialPolicyService.assertFeature('ai_social_posts', { userId: ownerId });
      if (!input.characterSlug) throw new BadRequestError('characterSlug is required for character posts.');
      characterId = (await CharacterSocialCapabilityService.resolveOwnedCharacter(ownerId, input.characterSlug)).id;
      if (!(await SocialConsentService.isGranted(ownerId, 'AI_GENERATED_PUBLIC_CONTENT'))) {
        throw new ForbiddenError('Enable "AI-generated public content" in your consent settings first.');
      }
    } else {
      const creator = await prisma.creatorProfile.findUnique({ where: { userId: ownerId }, select: { status: true } });
      if (creator?.status !== 'ACTIVE') throw new ForbiddenError('Only active creators can schedule announcements.');
    }
    if (!input.payload.body && !input.payload.promptTemplate) throw new BadRequestError('Provide a body or a prompt template.');
    if (input.actionType === 'CREATOR_ANNOUNCEMENT' && !input.payload.body) throw new BadRequestError('Announcements must be written by the creator (body required).');

    const row = await prisma.scheduledSocialAction.create({
      data: {
        ownerUserId: ownerId,
        characterId,
        actionType: input.actionType,
        payload: input.payload as Prisma.InputJsonValue,
        intervalHours: input.intervalHours,
        nextRunAt: new Date(Date.now() + input.intervalHours * 3_600_000),
        budgetCents: input.budgetCents,
        // Character posts always wait for creator approval; human announcements publish through normal moderation.
        approvalPolicy: input.actionType === 'CHARACTER_POST' ? 'CREATOR_APPROVAL' : 'AUTO_WITH_MODERATION',
      },
    });
    await AuditService.log({ actorType: 'USER', actorId: ownerId, action: 'SCHEDULED_SOCIAL_ACTION_CREATED', resourceType: 'scheduled_social_action', resourceId: row.id, metadata: { actionType: row.actionType, intervalHours: row.intervalHours, budgetCents: row.budgetCents } });
    await this.enqueue(row);
    return row;
  }

  public static async list(ownerId: string) {
    return prisma.scheduledSocialAction.findMany({ where: { ownerUserId: ownerId, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' } });
  }

  public static async setStatus(ownerId: string, id: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'): Promise<ScheduledSocialAction> {
    const row = await prisma.scheduledSocialAction.findFirst({ where: { id, ownerUserId: ownerId } });
    if (!row || row.status === 'CANCELLED') throw new NotFoundError('Schedule not found');
    const updated = await prisma.scheduledSocialAction.update({
      where: { id },
      data: { status, ...(status === 'ACTIVE' ? { nextRunAt: new Date(Date.now() + row.intervalHours * 3_600_000) } : {}) },
    });
    await AuditService.log({ actorType: 'USER', actorId: ownerId, action: `SCHEDULED_SOCIAL_ACTION_${status}`, resourceType: 'scheduled_social_action', resourceId: id });
    if (status === 'ACTIVE') await this.enqueue(updated);
    return updated;
  }

  /** Emergency / revocation: pause every schedule matching the filter (e.g. creator suspended). */
  public static async pauseAll(filter: { ownerUserId?: string; characterId?: string }, reason: string): Promise<number> {
    const res = await prisma.scheduledSocialAction.updateMany({
      where: { status: 'ACTIVE', ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}), ...(filter.characterId ? { characterId: filter.characterId } : {}) },
      data: { status: 'PAUSED', lastError: reason.slice(0, 500) },
    });
    return res.count;
  }

  private static async enqueue(row: ScheduledSocialAction): Promise<void> {
    const delayMs = Math.max(0, row.nextRunAt.getTime() - Date.now());
    const job: ScheduledSocialActionJob = { actionId: row.id, run: row.runCount + 1 };
    await QueueManager.addJob('social-actions', 'scheduled_social_action', job, { delayMs, idempotencyKey: `sched.${row.id}.${job.run}`, priority: 'LOW' }).catch((err) =>
      logger.warn('[ScheduledSocial] enqueue failed; sweeper will pick it up', { error: err }),
    );
  }

  /** Sweeper: re-enqueues due schedules whose jobs were lost (idempotent). */
  public static async enqueueDue(): Promise<number> {
    const due = await prisma.scheduledSocialAction.findMany({ where: { status: 'ACTIVE', nextRunAt: { lte: new Date() } }, take: 200 });
    for (const row of due) await this.enqueue(row);
    return due.length;
  }

  /**
   * Executes one run. NOTHING stored at scheduling time is trusted: status, ownership, creator standing,
   * consent, feature flags, kill switches, budgets and character state are all re-checked now.
   */
  public static async process(job: ScheduledSocialActionJob): Promise<{ outcome: string }> {
    const row = await prisma.scheduledSocialAction.findUnique({ where: { id: job.actionId } });
    if (!row || row.status !== 'ACTIVE') return { outcome: 'SKIPPED_INACTIVE' };
    if (row.runCount + 1 !== job.run) return { outcome: 'SKIPPED_STALE_RUN' };
    if (row.nextRunAt.getTime() > Date.now() + 60_000) return { outcome: 'SKIPPED_NOT_DUE' };

    const owner = await prisma.user.findUnique({ where: { id: row.ownerUserId }, select: { status: true, deletedAt: true } });
    if (!owner || owner.deletedAt || owner.status !== 'ACTIVE') {
      await this.pauseAll({ ownerUserId: row.ownerUserId }, 'Owner account inactive');
      return { outcome: 'PAUSED_OWNER_INACTIVE' };
    }
    const payload = row.payload as { title?: string; body?: string; promptTemplate?: string };
    const advance = async (data: Partial<Prisma.ScheduledSocialActionUpdateInput>) => {
      const updated = await prisma.scheduledSocialAction.update({
        where: { id: row.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date(), nextRunAt: new Date(Date.now() + row.intervalHours * 3_600_000), ...data },
      });
      if (updated.status === 'ACTIVE') await this.enqueue(updated);
    };

    try {
      if (row.actionType === 'CREATOR_ANNOUNCEMENT') {
        // Human-authored: goes through the exact same checks and moderation as a manual post.
        await SocialContentService.createPost(row.ownerUserId, { kind: 'CREATOR_POST', title: payload.title, body: payload.body!, visibility: 'PUBLIC', topics: [] });
        await advance({ lastError: null });
        return { outcome: 'PUBLISHED' };
      }

      // Character post: check platform switches BEFORE spending on generation.
      if (!(await SocialPolicyService.isFeatureEnabled('character_social_actions', { userId: row.ownerUserId })) || !(await SocialPolicyService.isFeatureEnabled('ai_social_posts', { userId: row.ownerUserId }))) {
        await advance({ lastError: 'Disabled by platform policy' });
        return { outcome: 'SKIPPED_POLICY' };
      }
      const character = await prisma.character.findUnique({ where: { id: row.characterId! }, select: { id: true, slug: true, status: true, deletedAt: true } });
      if (!character || character.deletedAt || character.status !== 'PUBLISHED') {
        await this.pauseAll({ characterId: row.characterId! }, 'Character unpublished');
        return { outcome: 'PAUSED_CHARACTER_UNPUBLISHED' };
      }
      if (row.spentCents >= row.budgetCents) {
        await prisma.scheduledSocialAction.update({ where: { id: row.id }, data: { status: 'PAUSED', lastError: 'Budget exhausted' } });
        return { outcome: 'PAUSED_BUDGET' };
      }

      let text = payload.body ?? '';
      let generation: CharacterSocialActionProposalInput['generation'];
      let cost = 0;
      if (payload.promptTemplate) {
        const g = await this.generator({ characterId: character.id, promptTemplate: payload.promptTemplate });
        if (row.spentCents + g.costCents > row.budgetCents) {
          await prisma.scheduledSocialAction.update({ where: { id: row.id }, data: { status: 'PAUSED', lastError: 'Budget exhausted' } });
          return { outcome: 'PAUSED_BUDGET' };
        }
        text = g.text;
        cost = g.costCents;
        generation = { generationId: g.generationId, model: g.model, characterVersionId: g.characterVersionId, promptVersion: g.promptVersion, safetyVersion: g.safetyVersion, estimatedCostCents: g.costCents };
      }

      const result = await CharacterSocialActionGateway.propose(
        { characterSlug: character.slug, actionType: 'PUBLISH_POST', text, generation, idempotencyKey: `sched.${row.id}.${job.run}` },
        { actorType: 'SCHEDULER', requestId: crypto.randomUUID() },
      );
      await advance({ spentCents: { increment: cost }, lastError: result.status === 'DENIED' ? result.decision.reasons.join(',').slice(0, 500) : null });
      return { outcome: result.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[ScheduledSocial] run failed', { id: row.id, error: message });
      await advance({ lastError: message.slice(0, 500) });
      return { outcome: 'FAILED' };
    }
  }
}
