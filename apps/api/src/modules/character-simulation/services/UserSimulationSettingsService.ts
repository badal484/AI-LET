import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import type { UserSimulationSettingsItem, AutonomyLevel } from '@ai-companion/types';

export interface UpdateSimulationSettingsInput {
  enabled?: boolean;
  autonomyLevel?: AutonomyLevel;
  proactiveEnabled?: boolean;
  routinesEnabled?: boolean;
  remindersEnabled?: boolean;
  plansEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  userTimezone?: string;
  metadata?: Record<string, unknown>;
}

export type ResetScope = 'GOALS' | 'PLANS' | 'ROUTINES' | 'COMMITMENTS' | 'WORLD_STATE' | 'ALL';

export class UserSimulationSettingsService {
  private static instance: UserSimulationSettingsService;

  private constructor() {}

  public static getInstance(): UserSimulationSettingsService {
    if (!UserSimulationSettingsService.instance) {
      UserSimulationSettingsService.instance = new UserSimulationSettingsService();
    }
    return UserSimulationSettingsService.instance;
  }

  /**
   * Retrieves or initializes the user simulation settings for a user-character pair.
   */
  public async getSettings(userId: string, characterId: string): Promise<UserSimulationSettingsItem> {
    if (!prisma.userSimulationSettings) {
      return {
        id: 'settings-default',
        userId,
        characterId,
        enabled: true,
        autonomyLevel: 'CONTEXTUAL',
        proactiveEnabled: true,
        routinesEnabled: true,
        remindersEnabled: true,
        plansEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        userTimezone: 'UTC',
        metadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const existing = await prisma.userSimulationSettings.findUnique({
      where: {
        userId_characterId: { userId, characterId },
      },
    });

    if (existing) {
      return this.mapToItem(existing);
    }

    const created = await prisma.userSimulationSettings.create({
      data: {
        userId,
        characterId,
        enabled: true,
        autonomyLevel: 'CONTEXTUAL',
        proactiveEnabled: true,
        routinesEnabled: true,
        remindersEnabled: true,
        plansEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        userTimezone: 'UTC',
      },
    });

    return this.mapToItem(created);
  }

  /**
   * Updates user simulation settings.
   */
  public async updateSettings(
    userId: string,
    characterId: string,
    input: UpdateSimulationSettingsInput
  ): Promise<UserSimulationSettingsItem> {
    if (input.autonomyLevel) {
      const validLevels: AutonomyLevel[] = ['PASSIVE', 'CONTEXTUAL', 'PROACTIVE', 'TASK_ORIENTED'];
      if (!validLevels.includes(input.autonomyLevel)) {
        throw new ValidationError(`Invalid autonomyLevel: ${input.autonomyLevel}`);
      }
    }

    const updated = await prisma.userSimulationSettings.upsert({
      where: {
        userId_characterId: { userId, characterId },
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.autonomyLevel ? { autonomyLevel: input.autonomyLevel } : {}),
        ...(input.proactiveEnabled !== undefined ? { proactiveEnabled: input.proactiveEnabled } : {}),
        ...(input.routinesEnabled !== undefined ? { routinesEnabled: input.routinesEnabled } : {}),
        ...(input.remindersEnabled !== undefined ? { remindersEnabled: input.remindersEnabled } : {}),
        ...(input.plansEnabled !== undefined ? { plansEnabled: input.plansEnabled } : {}),
        ...(input.quietHoursStart ? { quietHoursStart: input.quietHoursStart } : {}),
        ...(input.quietHoursEnd ? { quietHoursEnd: input.quietHoursEnd } : {}),
        ...(input.userTimezone ? { userTimezone: input.userTimezone } : {}),
        ...(input.metadata ? { metadata: input.metadata as any } : {}),
      },
      create: {
        userId,
        characterId,
        enabled: input.enabled !== undefined ? input.enabled : true,
        autonomyLevel: input.autonomyLevel || 'CONTEXTUAL',
        proactiveEnabled: input.proactiveEnabled !== undefined ? input.proactiveEnabled : true,
        routinesEnabled: input.routinesEnabled !== undefined ? input.routinesEnabled : true,
        remindersEnabled: input.remindersEnabled !== undefined ? input.remindersEnabled : true,
        plansEnabled: input.plansEnabled !== undefined ? input.plansEnabled : true,
        quietHoursStart: input.quietHoursStart || '22:00',
        quietHoursEnd: input.quietHoursEnd || '08:00',
        userTimezone: input.userTimezone || 'UTC',
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });

    logger.info(`UserSimulationSettingsService: updated settings for user '${userId}', character '${characterId}'`);
    return this.mapToItem(updated);
  }

  /**
   * Resets granular or all simulation state for a user-character pair.
   * Does NOT delete permanent memories or relationship levels unless explicitly managed.
   */
  public async resetSimulationState(
    userId: string,
    characterId: string,
    scope: ResetScope = 'ALL'
  ): Promise<{ success: boolean; scope: ResetScope; resetCounts: Record<string, number> }> {
    const counts: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      if (scope === 'GOALS' || scope === 'ALL') {
        const deletedGoals = await tx.characterGoal.updateMany({
          where: { userId, characterId, status: { in: ['ACTIVE', 'IN_PROGRESS', 'PAUSED', 'DRAFT'] } },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
        counts['goals'] = deletedGoals.count;
      }

      if (scope === 'PLANS' || scope === 'ALL') {
        const deletedPlans = await tx.characterPlan.updateMany({
          where: { userId, characterId, status: { in: ['ACTIVE', 'PAUSED', 'DRAFT'] } },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
        counts['plans'] = deletedPlans.count;
      }

      if (scope === 'COMMITMENTS' || scope === 'ALL') {
        const cancelledCommitments = await tx.characterCommitment.updateMany({
          where: { userId, characterId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        const resolvedThreads = await tx.openConversationalThread.updateMany({
          where: { userId, characterId, status: { in: ['OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_SYSTEM'] } },
          data: { status: 'DISMISSED', resolvedAt: new Date() },
        });
        counts['commitments'] = cancelledCommitments.count;
        counts['threads'] = resolvedThreads.count;
      }

      if (scope === 'WORLD_STATE' || scope === 'ALL') {
        const deletedWorldState = await tx.characterWorldState.deleteMany({
          where: { userId, characterId },
        });
        counts['worldStates'] = deletedWorldState.count;
      }

      if (scope === 'ALL') {
        await tx.characterSimulationState.upsert({
          where: { userId_characterId: { userId, characterId } },
          update: {
            behaviorMode: 'supportive',
            currentFocus: null,
            behaviorReason: 'User initiated full simulation state reset',
            behaviorExpiresAt: null,
            version: { increment: 1 },
          },
          create: {
            userId,
            characterId,
            behaviorMode: 'supportive',
            version: 1,
          },
        });
      }

      // Record audit event
      await tx.characterSimulationEvent.create({
        data: {
          characterId,
          userId,
          eventType: 'character.simulation.reset.v1',
          source: 'USER_ACTION',
          payload: { scope, counts } as any,
          stateVersion: 1,
        },
      });
    });

    logger.info(`UserSimulationSettingsService: reset scope '${scope}' for user '${userId}', character '${characterId}'`);
    return {
      success: true,
      scope,
      resetCounts: counts,
    };
  }

  private mapToItem(record: any): UserSimulationSettingsItem {
    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      enabled: record.enabled,
      autonomyLevel: record.autonomyLevel as AutonomyLevel,
      proactiveEnabled: record.proactiveEnabled,
      routinesEnabled: record.routinesEnabled,
      remindersEnabled: record.remindersEnabled,
      plansEnabled: record.plansEnabled,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      userTimezone: record.userTimezone,
      metadata: record.metadata as Record<string, unknown> | null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
