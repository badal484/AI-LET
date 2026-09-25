import { UserGoalItem, UserGoalStatus } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class UserGoalService {
  private static instance: UserGoalService;

  private constructor() {}

  public static getInstance(): UserGoalService {
    if (!UserGoalService.instance) {
      UserGoalService.instance = new UserGoalService();
    }
    return UserGoalService.instance;
  }

  /**
   * Creates or records a new user goal. If another goal is currently active for this user & character,
   * it transitions the existing goal to 'paused' to prevent multi-goal conflicts.
   */
  public async createGoal(
    userId: string,
    input: {
      characterId?: string | null;
      conversationId?: string | null;
      category: string;
      title: string;
      constraints?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      priority?: number;
    }
  ): Promise<UserGoalItem> {
    // 1. Pause any currently active goal for this user & character to prevent conflict
    if (input.characterId) {
      await this.pauseActiveGoalIfExists(userId, input.characterId);
    }

    // 2. Persist new goal in PostgreSQL
    const created = await prisma.userGoal.create({
      data: {
        userId,
        characterId: input.characterId || null,
        conversationId: input.conversationId || null,
        category: input.category,
        title: input.title,
        status: 'active',
        priority: input.priority || 0,
        progress: 0.0,
        constraints: (input.constraints as any) || undefined,
        metadata: (input.metadata as any) || undefined,
        lastActiveAt: new Date(),
      },
    });

    logger.info(`UserGoalService: created goal '${created.id}' ("${created.title}") for user '${userId}'`);
    return this.mapToItem(created);
  }

  /**
   * Retrieves the active goal for a user and character, if one exists.
   */
  public async getActiveGoal(
    userId: string,
    characterId?: string | null
  ): Promise<UserGoalItem | null> {
    const goal = await prisma.userGoal.findFirst({
      where: {
        userId,
        ...(characterId ? { characterId } : {}),
        status: { in: ['active', 'awaiting_input', 'awaiting_confirmation', 'executing'] },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return goal ? this.mapToItem(goal) : null;
  }

  /**
   * Updates progress (0.0 to 1.0) and optionally updates status.
   */
  public async updateGoalProgress(
    goalId: string,
    userId: string,
    progress: number,
    status?: UserGoalStatus,
    activeTaskId?: string
  ): Promise<UserGoalItem> {
    const existing = await prisma.userGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found for user '${userId}'.`, ErrorCode.NOT_FOUND);
    }

    const clampedProgress = Math.min(1.0, Math.max(0.0, progress));
    const nextStatus = status || (clampedProgress >= 1.0 ? 'completed' : existing.status);

    const updated = await prisma.userGoal.update({
      where: { id: goalId },
      data: {
        progress: clampedProgress,
        status: nextStatus,
        ...(activeTaskId ? { activeTaskId } : {}),
        lastActiveAt: new Date(),
      },
    });

    return this.mapToItem(updated);
  }

  /**
   * Pauses an active goal upon interruption.
   */
  public async pauseGoal(goalId: string, userId: string): Promise<UserGoalItem> {
    return this.updateGoalProgress(goalId, userId, 0.0, 'paused');
  }

  /**
   * Resumes a paused or blocked goal.
   */
  public async resumeGoal(goalId: string, userId: string): Promise<UserGoalItem> {
    const existing = await prisma.userGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found for user '${userId}'.`, ErrorCode.NOT_FOUND);
    }

    if (existing.characterId) {
      await this.pauseActiveGoalIfExists(userId, existing.characterId);
    }

    const updated = await prisma.userGoal.update({
      where: { id: goalId },
      data: {
        status: 'active',
        lastActiveAt: new Date(),
      },
    });

    logger.info(`UserGoalService: resumed goal '${goalId}' for user '${userId}'`);
    return this.mapToItem(updated);
  }

  /**
   * Cancels a goal upon explicit user request.
   */
  public async cancelGoal(goalId: string, userId: string): Promise<UserGoalItem> {
    const existing = await prisma.userGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Goal '${goalId}' not found for user '${userId}'.`, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.userGoal.update({
      where: { id: goalId },
      data: {
        status: 'cancelled',
        lastActiveAt: new Date(),
      },
    });

    logger.info(`UserGoalService: cancelled goal '${goalId}' for user '${userId}'`);
    return this.mapToItem(updated);
  }

  /**
   * Lists goals for a user with optional status filter.
   */
  public async listUserGoals(userId: string, status?: string): Promise<UserGoalItem[]> {
    const goals = await prisma.userGoal.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { lastActiveAt: 'desc' },
      take: 50,
    });

    return goals.map(this.mapToItem);
  }

  /**
   * Periodic reconciliation job: transitions stale goals (> 30 days inactive) to expired.
   */
  public async reconcileStaleGoals(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await prisma.userGoal.updateMany({
      where: {
        status: { in: ['active', 'paused', 'awaiting_input'] },
        lastActiveAt: { lt: cutoff },
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      logger.info(`UserGoalService: expired ${result.count} stale goals inactive since ${cutoff.toISOString()}`);
    }
    return result.count;
  }

  private async pauseActiveGoalIfExists(userId: string, characterId: string): Promise<void> {
    await prisma.userGoal.updateMany({
      where: {
        userId,
        characterId,
        status: { in: ['active', 'executing', 'awaiting_input'] },
      },
      data: {
        status: 'paused',
        lastActiveAt: new Date(),
      },
    });
  }

  private mapToItem(record: any): UserGoalItem {
    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      category: record.category,
      title: record.title,
      status: record.status as UserGoalStatus,
      priority: record.priority,
      progress: record.progress,
      constraints: record.constraints as Record<string, unknown> | null,
      activeTaskId: record.activeTaskId,
      metadata: record.metadata as Record<string, unknown> | null,
      lastActiveAt: record.lastActiveAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
