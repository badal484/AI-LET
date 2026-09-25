import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  CharacterRoutineItem,
  RoutineType,
} from '@ai-companion/types';

export interface CreateRoutineInput {
  characterId: string;
  characterVersionId?: string | null;
  name: string;
  description?: string | null;
  routineType: RoutineType;
  scheduleCron?: string | null;
  timezonePolicy?: string;
  frequencyLimitPerDay?: number;
  cooldownMinutes?: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  priority?: number;
  constraints?: Record<string, unknown>;
}

export class CharacterRoutineService {
  private static instance: CharacterRoutineService;

  private constructor() {}

  public static getInstance(): CharacterRoutineService {
    if (!CharacterRoutineService.instance) {
      CharacterRoutineService.instance = new CharacterRoutineService();
    }
    return CharacterRoutineService.instance;
  }

  /**
   * Creates a character routine with strict safety parameters.
   */
  public async createRoutine(input: CreateRoutineInput): Promise<CharacterRoutineItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Routine name is required.');
    }

    const created = await prisma.characterRoutine.create({
      data: {
        characterId: input.characterId,
        characterVersionId: input.characterVersionId || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        routineType: input.routineType || 'CONVERSATION_BASED',
        scheduleCron: input.scheduleCron || null,
        timezonePolicy: input.timezonePolicy || 'USER_LOCAL_OR_UTC',
        frequencyLimitPerDay: Math.max(1, Math.min(input.frequencyLimitPerDay ?? 1, 5)), // Cap at 5/day
        cooldownMinutes: Math.max(15, input.cooldownMinutes ?? 60), // Min 15 mins cooldown
        quietHoursStart: input.quietHoursStart || '22:00',
        quietHoursEnd: input.quietHoursEnd || '08:00',
        priority: input.priority ?? 1,
        active: true,
        constraints: (input.constraints as any) || undefined,
      },
    });

    logger.info(`CharacterRoutineService: created routine '${created.id}' ("${created.name}") for character '${input.characterId}'`);
    return this.mapToItem(created);
  }

  /**
   * Lists routines for a character.
   */
  public async listRoutines(characterId: string, activeOnly: boolean = true): Promise<CharacterRoutineItem[]> {
    const routines = await prisma.characterRoutine.findMany({
      where: {
        characterId,
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return routines.map((r) => this.mapToItem(r));
  }

  /**
   * Evaluates whether a routine is eligible to trigger right now.
   */
  public isRoutineEligible(
    routine: CharacterRoutineItem,
    context: {
      now?: Date;
      userTimezone?: string;
      currentHourLocal?: number;
      eventContext?: { type: string; payload?: Record<string, unknown> };
    }
  ): { eligible: boolean; reason: string } {
    if (!routine.active) {
      return { eligible: false, reason: 'Routine is inactive' };
    }

    const now = context.now || new Date();

    // 1. Check cooldown
    if (routine.lastTriggeredAt) {
      const lastTrigger = new Date(routine.lastTriggeredAt).getTime();
      const elapsedMinutes = (now.getTime() - lastTrigger) / (60 * 1000);
      if (elapsedMinutes < routine.cooldownMinutes) {
        return {
          eligible: false,
          reason: `Routine in cooldown (${elapsedMinutes.toFixed(1)}m < ${routine.cooldownMinutes}m)`,
        };
      }
    }

    // 2. Check quiet hours (local timezone)
    if (routine.quietHoursStart && routine.quietHoursEnd) {
      const currentHour = context.currentHourLocal ?? now.getUTCHours();
      const startH = Number(routine.quietHoursStart.split(':')[0] ?? '22');
      const endH = Number(routine.quietHoursEnd.split(':')[0] ?? '8');

      const inQuietHours =
        startH > endH
          ? currentHour >= startH || currentHour < endH
          : currentHour >= startH && currentHour < endH;

      if (inQuietHours) {
        return { eligible: false, reason: `Currently within quiet hours (${routine.quietHoursStart}-${routine.quietHoursEnd})` };
      }
    }

    // 3. Event-based routine check
    if (routine.routineType === 'EVENT_BASED' && !context.eventContext) {
      return { eligible: false, reason: 'Event-based routine requires active event trigger' };
    }

    return { eligible: true, reason: 'Eligible for execution' };
  }

  /**
   * Records execution of a routine, updating lastTriggeredAt.
   */
  public async recordRoutineExecution(routineId: string): Promise<void> {
    await prisma.characterRoutine.update({
      where: { id: routineId },
      data: { lastTriggeredAt: new Date() },
    });
    logger.debug(`CharacterRoutineService: recorded execution for routine '${routineId}'`);
  }

  /**
   * Updates routine configuration.
   */
  public async updateRoutine(routineId: string, data: Partial<CreateRoutineInput> & { active?: boolean }): Promise<CharacterRoutineItem> {
    const existing = await prisma.characterRoutine.findUnique({
      where: { id: routineId },
    });

    if (!existing) {
      throw new NotFoundError(`Routine '${routineId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.characterRoutine.update({
      where: { id: routineId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        routineType: data.routineType,
        scheduleCron: data.scheduleCron,
        frequencyLimitPerDay: data.frequencyLimitPerDay,
        cooldownMinutes: data.cooldownMinutes,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        priority: data.priority,
        active: data.active,
        constraints: data.constraints as any,
      },
    });

    return this.mapToItem(updated);
  }

  /**
   * Deactivates a routine.
   */
  public async deactivateRoutine(routineId: string): Promise<CharacterRoutineItem> {
    return this.updateRoutine(routineId, { active: false });
  }

  /**
   * Deletes a routine.
   */
  public async deleteRoutine(routineId: string): Promise<void> {
    await prisma.characterRoutine.delete({
      where: { id: routineId },
    });
  }

  private mapToItem(record: any): CharacterRoutineItem {
    return {
      id: record.id,
      characterId: record.characterId,
      characterVersionId: record.characterVersionId,
      name: record.name,
      description: record.description,
      routineType: record.routineType as RoutineType,
      scheduleCron: record.scheduleCron,
      timezonePolicy: record.timezonePolicy,
      frequencyLimitPerDay: record.frequencyLimitPerDay,
      cooldownMinutes: record.cooldownMinutes,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      priority: record.priority,
      active: record.active,
      constraints: record.constraints as Record<string, unknown> | null,
      lastTriggeredAt: record.lastTriggeredAt ? record.lastTriggeredAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
