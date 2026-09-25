import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  CharacterGoalItem,
  CharacterGoalMilestoneItem,
  CharacterGoalTaskItem,
  GoalStatus,
  ObjectiveOwner,
  ProgressType,
  QualitativeProgress,
} from '@ai-companion/types';

export interface CreateGoalInput {
  characterId: string;
  characterVersionId?: string | null;
  userId: string;
  owner?: ObjectiveOwner;
  category: string;
  title: string;
  description?: string | null;
  priority?: number;
  progressType?: ProgressType;
  dueAt?: Date | string | null;
  source?: string | null;
  confidence?: number;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  milestones?: Array<{
    title: string;
    orderIndex?: number;
    tasks?: Array<{
      title: string;
      description?: string;
      assignedTo?: 'CHARACTER' | 'USER' | 'SHARED';
    }>;
  }>;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  priority?: number;
  progress?: number;
  qualitativeProgress?: QualitativeProgress | null;
  dueAt?: Date | string | null;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class CharacterGoalService {
  private static instance: CharacterGoalService;

  private constructor() {}

  public static getInstance(): CharacterGoalService {
    if (!CharacterGoalService.instance) {
      CharacterGoalService.instance = new CharacterGoalService();
    }
    return CharacterGoalService.instance;
  }

  /**
   * Deterministic state transition validator.
   */
  public isValidTransition(currentStatus: GoalStatus, targetStatus: GoalStatus): boolean {
    if (currentStatus === targetStatus) return true;

    const allowedTransitions: Record<GoalStatus, GoalStatus[]> = {
      DRAFT: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['IN_PROGRESS', 'PAUSED', 'BLOCKED', 'CANCELLED', 'EXPIRED'],
      IN_PROGRESS: ['COMPLETED', 'PAUSED', 'BLOCKED', 'ABANDONED', 'CANCELLED', 'EXPIRED'],
      PAUSED: ['ACTIVE', 'IN_PROGRESS', 'CANCELLED', 'ABANDONED'],
      BLOCKED: ['ACTIVE', 'IN_PROGRESS', 'CANCELLED', 'ABANDONED'],
      COMPLETED: [], // Terminal
      ABANDONED: [], // Terminal
      EXPIRED: ['ACTIVE'], // Can be refreshed if needed
      CANCELLED: [], // Terminal
    };

    return allowedTransitions[currentStatus]?.includes(targetStatus) ?? false;
  }

  /**
   * Creates a new persistent CharacterGoal with optional bounded milestones and tasks.
   */
  public async createGoal(input: CreateGoalInput): Promise<CharacterGoalItem> {
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('Goal title is required.');
    }

    // Safety check against goal injection (e.g. attempting to reveal system instructions)
    const lowerTitle = input.title.toLowerCase();
    const lowerDesc = (input.description || '').toLowerCase();
    if (
      lowerTitle.includes('ignore previous') ||
      lowerTitle.includes('ignore all previous') ||
      lowerTitle.includes('reveal system prompt') ||
      lowerTitle.includes('system prompt') ||
      lowerTitle.includes('jailbreak') ||
      lowerTitle.includes('system override') ||
      lowerDesc.includes('ignore previous') ||
      lowerDesc.includes('ignore all previous') ||
      lowerDesc.includes('system prompt')
    ) {
      throw new ValidationError('Goal contains disallowed system override instructions.');
    }

    // Check max active goals per user limit (5)
    const activeCount = await prisma.characterGoal.count({
      where: {
        userId: input.userId,
        characterId: input.characterId,
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      },
    });

    if (activeCount >= 5) {
      throw new ValidationError('Maximum active character goals limit (5) reached.');
    }

    const created = await prisma.characterGoal.create({
      data: {
        characterId: input.characterId,
        characterVersionId: input.characterVersionId || null,
        userId: input.userId,
        owner: input.owner || 'CHARACTER',
        category: input.category || 'topic_continuity',
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority ?? 1,
        status: 'ACTIVE',
        progress: 0.0,
        progressType: input.progressType || 'PERCENTAGE',
        qualitativeProgress: 'NOT_STARTED',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        source: input.source || 'conversation',
        confidence: input.confidence ?? 1.0,
        constraints: (input.constraints as any) || undefined,
        metadata: (input.metadata as any) || undefined,
        milestones: input.milestones && input.milestones.length > 0 ? {
          create: input.milestones.map((m, idx) => ({
            title: m.title.trim(),
            orderIndex: m.orderIndex ?? idx,
            status: 'PENDING',
            tasks: m.tasks && m.tasks.length > 0 ? {
              create: m.tasks.map((t) => ({
                goalId: 'placeholder', // Will be connected via cascade
                title: t.title.trim(),
                description: t.description?.trim() || null,
                assignedTo: t.assignedTo || 'CHARACTER',
                status: 'PENDING',
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: {
        milestones: {
          include: {
            tasks: true,
          },
        },
        tasks: true,
      },
    });

    logger.info(`CharacterGoalService: created goal '${created.id}' ("${created.title}") for character '${input.characterId}' user '${input.userId}'`);
    return this.mapToItem(created);
  }

  /**
   * Retrieves active and recent goals for a user-character pair.
   */
  public async listGoals(
    userId: string,
    characterId?: string,
    statusFilter?: GoalStatus[]
  ): Promise<CharacterGoalItem[]> {
    const goals = await prisma.characterGoal.findMany({
      where: {
        userId,
        ...(characterId ? { characterId } : {}),
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
      },
      include: {
        milestones: {
          include: { tasks: true },
          orderBy: { orderIndex: 'asc' },
        },
        tasks: true,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    });

    return goals.map((g) => this.mapToItem(g));
  }

  /**
   * Retrieves a single goal by ID with ownership enforcement.
   */
  public async getGoal(goalId: string, userId: string): Promise<CharacterGoalItem> {
    const goal = await prisma.characterGoal.findFirst({
      where: { id: goalId, userId },
      include: {
        milestones: {
          include: { tasks: true },
          orderBy: { orderIndex: 'asc' },
        },
        tasks: true,
      },
    });

    if (!goal) {
      throw new NotFoundError(`Goal '${goalId}' not found.`, ErrorCode.NOT_FOUND);
    }

    return this.mapToItem(goal);
  }

  /**
   * Transitions goal status with deterministic state machine verification and optimistic concurrency.
   */
  public async transitionGoalStatus(
    goalIdOrInput: string | { goalId: string; userId: string; targetStatus: GoalStatus; reason?: string; expectedVersion?: number },
    userId?: string,
    targetStatus?: GoalStatus,
    reason?: string,
    expectedVersion?: number
  ): Promise<CharacterGoalItem> {
    let effectiveGoalId: string;
    let effectiveUserId: string;
    let effectiveTargetStatus: GoalStatus;
    let effectiveReason: string | undefined;
    let effectiveExpectedVersion: number | undefined;

    if (typeof goalIdOrInput === 'object') {
      effectiveGoalId = goalIdOrInput.goalId;
      effectiveUserId = goalIdOrInput.userId;
      effectiveTargetStatus = goalIdOrInput.targetStatus;
      effectiveReason = goalIdOrInput.reason;
      effectiveExpectedVersion = goalIdOrInput.expectedVersion;
    } else {
      effectiveGoalId = goalIdOrInput;
      effectiveUserId = userId!;
      effectiveTargetStatus = targetStatus!;
      effectiveReason = reason;
      effectiveExpectedVersion = expectedVersion;
    }

    const existing = await prisma.characterGoal.findFirst({
      where: { id: effectiveGoalId, userId: effectiveUserId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${effectiveGoalId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (effectiveExpectedVersion !== undefined && existing.version !== effectiveExpectedVersion) {
      throw new ValidationError(
        `Optimistic concurrency conflict: expected version ${effectiveExpectedVersion}, but found ${existing.version}.`
      );
    }

    const currentStatus = existing.status as GoalStatus;
    if (!this.isValidTransition(currentStatus, effectiveTargetStatus)) {
      throw new ValidationError(
        `Cannot transition goal from ${currentStatus} to ${effectiveTargetStatus}.`
      );
    }

    const updateData: any = {
      status: effectiveTargetStatus,
      lastProgressAt: new Date(),
      version: { increment: 1 },
    };

    if (effectiveTargetStatus === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.progress = 1.0;
      updateData.qualitativeProgress = 'COMPLETE';
    } else if (effectiveTargetStatus === 'ABANDONED') {
      updateData.abandonedAt = new Date();
    }

    if (effectiveReason) {
      const metadata = (existing.metadata as Record<string, unknown>) || {};
      updateData.metadata = {
        ...metadata,
        lastTransitionReason: effectiveReason,
        lastTransitionAt: new Date().toISOString(),
      };
    }

    const updated = await prisma.characterGoal.update({
      where: { id: effectiveGoalId },
      data: updateData,
      include: {
        milestones: { include: { tasks: true } },
        tasks: true,
      },
    });

    logger.info(`CharacterGoalService: goal '${effectiveGoalId}' transitioned ${currentStatus} -> ${effectiveTargetStatus} (reason: ${effectiveReason || 'none'})`);
    return this.mapToItem(updated);
  }

  /**
   * Updates goal progress, qualitative stage, or attributes.
   */
  public async updateGoalProgress(
    goalId: string,
    userId: string,
    progress: number,
    qualitative?: QualitativeProgress,
    milestoneIdToComplete?: string
  ): Promise<CharacterGoalItem> {
    const existing = await prisma.characterGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const clamped = Math.min(1.0, Math.max(0.0, progress));
    const shouldComplete = clamped >= 1.0;

    const updated = await prisma.$transaction(async (tx) => {
      if (milestoneIdToComplete) {
        await tx.characterGoalMilestone.updateMany({
          where: { id: milestoneIdToComplete, goalId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      return tx.characterGoal.update({
        where: { id: goalId },
        data: {
          progress: clamped,
          qualitativeProgress: qualitative || (shouldComplete ? 'COMPLETE' : existing.qualitativeProgress),
          status: shouldComplete ? 'COMPLETED' : (existing.status === 'ACTIVE' ? 'IN_PROGRESS' : existing.status),
          completedAt: shouldComplete ? new Date() : undefined,
          lastProgressAt: new Date(),
        },
        include: {
          milestones: { include: { tasks: true } },
          tasks: true,
        },
      });
    });

    return this.mapToItem(updated);
  }

  /**
   * Updates goal metadata, description, progress, or attributes.
   */
  public async updateGoal(
    goalId: string,
    userId: string,
    input: UpdateGoalInput
  ): Promise<CharacterGoalItem> {
    const existing = await prisma.characterGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const clampedProgress = input.progress !== undefined ? Math.min(1.0, Math.max(0.0, input.progress)) : undefined;

    const updated = await prisma.characterGoal.update({
      where: { id: goalId },
      data: {
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(clampedProgress !== undefined ? { progress: clampedProgress, lastProgressAt: new Date() } : {}),
        ...(input.qualitativeProgress !== undefined ? { qualitativeProgress: input.qualitativeProgress } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(input.constraints ? { constraints: input.constraints as any } : {}),
        ...(input.metadata ? { metadata: input.metadata as any } : {}),
        version: { increment: 1 },
      },
      include: {
        milestones: { include: { tasks: true } },
        tasks: true,
      },
    });

    return this.mapToItem(updated);
  }

  /**
   * Deletes a goal and cascades cleanup.
   */
  public async deleteGoal(goalId: string, userId: string): Promise<void> {
    const existing = await prisma.characterGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found.`, ErrorCode.NOT_FOUND);
    }

    await prisma.characterGoal.delete({
      where: { id: goalId },
    });
    logger.info(`CharacterGoalService: deleted goal '${goalId}' for user '${userId}'`);
  }

  /**
   * Stale goal detection: Detects and pauses goals without activity for > 14 days.
   */
  public async decayStaleGoals(userId: string, characterId: string): Promise<number> {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const stale = await prisma.characterGoal.updateMany({
      where: {
        userId,
        characterId,
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        updatedAt: { lt: fourteenDaysAgo },
      },
      data: {
        status: 'PAUSED',
      },
    });

    return stale.count;
  }

  /**
   * Batch processes stale goals across all users.
   */
  public async processStaleGoals(olderThanDays: number = 14): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const staleGoals = await prisma.characterGoal.findMany({
      where: {
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        updatedAt: { lt: cutoff },
      },
    });

    for (const g of staleGoals) {
      await this.transitionGoalStatus({
        goalId: g.id,
        userId: g.userId,
        targetStatus: 'PAUSED',
        reason: `Auto-paused due to inactivity for > ${olderThanDays} days`,
      });
    }

    return staleGoals.length;
  }

  private mapToItem(record: any): CharacterGoalItem {
    return {
      id: record.id,
      characterId: record.characterId,
      characterVersionId: record.characterVersionId,
      userId: record.userId,
      owner: record.owner as ObjectiveOwner,
      category: record.category,
      title: record.title,
      description: record.description,
      priority: record.priority,
      status: record.status as GoalStatus,
      progress: record.progress,
      progressType: record.progressType as ProgressType,
      qualitativeProgress: record.qualitativeProgress as QualitativeProgress | null,
      startAt: record.startAt ? record.startAt.toISOString() : (record.createdAt ? record.createdAt.toISOString() : new Date().toISOString()),
      dueAt: record.dueAt ? record.dueAt.toISOString() : null,
      lastProgressAt: record.lastProgressAt ? record.lastProgressAt.toISOString() : null,
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
      abandonedAt: record.abandonedAt ? record.abandonedAt.toISOString() : null,
      source: record.source,
      confidence: record.confidence,
      constraints: record.constraints as Record<string, unknown> | null,
      metadata: record.metadata as Record<string, unknown> | null,
      milestones: (record.milestones || []).map((m: any): CharacterGoalMilestoneItem => ({
        id: m.id,
        goalId: m.goalId,
        title: m.title,
        orderIndex: m.orderIndex,
        status: m.status,
        completedAt: m.completedAt ? m.completedAt.toISOString() : null,
        tasks: (m.tasks || []).map((t: any): CharacterGoalTaskItem => ({
          id: t.id,
          goalId: t.goalId,
          milestoneId: t.milestoneId,
          title: t.title,
          description: t.description,
          assignedTo: t.assignedTo,
          status: t.status,
          completedAt: t.completedAt ? t.completedAt.toISOString() : null,
          createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
        })),
        createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      })),
      tasks: (record.tasks || []).map((t: any): CharacterGoalTaskItem => ({
        id: t.id,
        goalId: t.goalId,
        milestoneId: t.milestoneId,
        title: t.title,
        description: t.description,
        assignedTo: t.assignedTo,
        status: t.status,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
      })),
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: record.updatedAt ? record.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
