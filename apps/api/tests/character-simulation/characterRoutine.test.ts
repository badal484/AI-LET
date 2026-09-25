import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterRoutineService } from '../../src/modules/character-simulation/services/CharacterRoutineService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors/AppError.js';
import type { CharacterRoutineItem } from '@ai-companion/types';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    characterRoutine: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('CharacterRoutineService - Safety, Limits & Eligibility', () => {
  let routineService: CharacterRoutineService;

  beforeEach(() => {
    vi.clearAllMocks();
    routineService = CharacterRoutineService.getInstance();
  });

  describe('1. Routine Creation & Boundary Clamping', () => {
    it('enforces safety caps on frequencyLimitPerDay and cooldownMinutes', async () => {
      const mockCreated = {
        id: 'rt-1',
        characterId: 'char-1',
        characterVersionId: null,
        name: 'Morning Check-in',
        description: 'Friendly morning inquiry',
        routineType: 'TIME_BASED',
        scheduleCron: '0 9 * * *',
        timezonePolicy: 'USER_LOCAL_OR_UTC',
        frequencyLimitPerDay: 5, // Clamped from 50 to 5
        cooldownMinutes: 60,     // Clamped from 2 to min 15, default 60
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        priority: 2,
        active: true,
        lastTriggeredAt: null,
        constraints: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.characterRoutine.create).mockResolvedValueOnce(mockCreated as any);

      const result = await routineService.createRoutine({
        characterId: 'char-1',
        name: 'Morning Check-in',
        description: 'Friendly morning inquiry',
        routineType: 'TIME_BASED',
        scheduleCron: '0 9 * * *',
        frequencyLimitPerDay: 50, // Exceeds cap
        cooldownMinutes: 5,       // Below min
        priority: 2,
      });

      expect(prisma.characterRoutine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          frequencyLimitPerDay: 5, // Capped at 5
          cooldownMinutes: 15,    // Clamped up to min 15
        }),
      });
      expect(result.id).toBe('rt-1');
    });

    it('rejects routine creation with missing or whitespace name', async () => {
      await expect(
        routineService.createRoutine({
          characterId: 'char-1',
          name: '   ',
          routineType: 'TIME_BASED',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('2. Routine Eligibility Checks', () => {
    const baseRoutine: CharacterRoutineItem = {
      id: 'rt-100',
      characterId: 'char-1',
      name: 'Evening Reflection',
      description: null,
      routineType: 'TIME_BASED',
      scheduleCron: null,
      timezonePolicy: 'USER_LOCAL_OR_UTC',
      frequencyLimitPerDay: 1,
      cooldownMinutes: 60,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      priority: 1,
      active: true,
      lastTriggeredAt: null,
      constraints: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('denies inactive routines', () => {
      const routine = { ...baseRoutine, active: false };
      const check = routineService.isRoutineEligible(routine, { now: new Date() });
      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('inactive');
    });

    it('denies routines during active cooldown period', () => {
      const now = new Date();
      const routine: CharacterRoutineItem = {
        ...baseRoutine,
        cooldownMinutes: 60,
        lastTriggeredAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 mins ago (< 60)
      };

      const check = routineService.isRoutineEligible(routine, { now });
      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('cooldown');
    });

    it('denies routines during quiet hours (e.g., 23:00 local time)', () => {
      const routine: CharacterRoutineItem = {
        ...baseRoutine,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      };

      // Hour 23 is in quiet hours (22:00 -> 08:00)
      const checkNight = routineService.isRoutineEligible(routine, {
        now: new Date(),
        currentHourLocal: 23,
      });
      expect(checkNight.eligible).toBe(false);
      expect(checkNight.reason).toContain('quiet hours');

      // Hour 3 (3 AM) is also in quiet hours
      const checkEarlyMorning = routineService.isRoutineEligible(routine, {
        now: new Date(),
        currentHourLocal: 3,
      });
      expect(checkEarlyMorning.eligible).toBe(false);
      expect(checkEarlyMorning.reason).toContain('quiet hours');

      // Hour 14 (2 PM) is NOT in quiet hours
      const checkAfternoon = routineService.isRoutineEligible(routine, {
        now: new Date(),
        currentHourLocal: 14,
      });
      expect(checkAfternoon.eligible).toBe(true);
    });

    it('requires eventContext for EVENT_BASED routines', () => {
      const routine: CharacterRoutineItem = {
        ...baseRoutine,
        routineType: 'EVENT_BASED',
      };

      const checkWithoutEvent = routineService.isRoutineEligible(routine, {
        now: new Date(),
        currentHourLocal: 15,
      });
      expect(checkWithoutEvent.eligible).toBe(false);
      expect(checkWithoutEvent.reason).toContain('requires active event trigger');

      const checkWithEvent = routineService.isRoutineEligible(routine, {
        now: new Date(),
        currentHourLocal: 15,
        eventContext: { type: 'CONVERSATION_TOPIC_CONCLUDED' },
      });
      expect(checkWithEvent.eligible).toBe(true);
    });
  });

  describe('3. Routine Execution Recording & Deactivation', () => {
    it('records execution timestamp properly', async () => {
      vi.mocked(prisma.characterRoutine.update).mockResolvedValueOnce({} as any);

      await routineService.recordRoutineExecution('rt-100');

      expect(prisma.characterRoutine.update).toHaveBeenCalledWith({
        where: { id: 'rt-100' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });

    it('deactivates routine upon request', async () => {
      vi.mocked(prisma.characterRoutine.findUnique).mockResolvedValueOnce({
        id: 'rt-100',
        active: true,
      } as any);
      vi.mocked(prisma.characterRoutine.update).mockResolvedValueOnce({
        id: 'rt-100',
        active: false,
        name: 'Evening Reflection',
        routineType: 'TIME_BASED',
        timezonePolicy: 'USER_LOCAL_OR_UTC',
        frequencyLimitPerDay: 1,
        cooldownMinutes: 60,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await routineService.deactivateRoutine('rt-100');
      expect(result.active).toBe(false);
    });
  });
});
