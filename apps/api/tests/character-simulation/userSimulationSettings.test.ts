import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSimulationSettingsService } from '../../src/modules/character-simulation/services/UserSimulationSettingsService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
    userSimulationSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    characterGoal: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    characterPlan: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    characterCommitment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    openConversationalThread: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    characterWorldState: {
      deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
    },
    characterSimulationState: {
      upsert: vi.fn(),
    },
    characterSimulationEvent: {
      create: vi.fn(),
    },
  },
}));

describe('UserSimulationSettingsService - Autonomy, Quiet Hours & Granular Resets', () => {
  let settingsService: UserSimulationSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService = UserSimulationSettingsService.getInstance();
  });

  it('updates autonomy levels and quiet hours with validation', async () => {
    const mockUpdated = {
      id: 'set-1',
      userId: 'user-1',
      characterId: 'char-maya',
      enabled: true,
      autonomyLevel: 'TASK_ORIENTED',
      proactiveEnabled: false,
      routinesEnabled: true,
      remindersEnabled: true,
      plansEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      userTimezone: 'Asia/Tokyo',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.userSimulationSettings.upsert).mockResolvedValueOnce(mockUpdated as any);

    const updated = await settingsService.updateSettings('user-1', 'char-maya', {
      autonomyLevel: 'TASK_ORIENTED',
      proactiveEnabled: false,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      userTimezone: 'Asia/Tokyo',
    });

    expect(updated.autonomyLevel).toBe('TASK_ORIENTED');
    expect(updated.proactiveEnabled).toBe(false);
    expect(updated.userTimezone).toBe('Asia/Tokyo');
  });

  it('performs scoped reset of simulation state without deleting memories', async () => {
    const res = await settingsService.resetSimulationState('user-1', 'char-maya', 'ALL');

    expect(res.success).toBe(true);
    expect(res.resetCounts['goals']).toBe(2);
    expect(res.resetCounts['plans']).toBe(1);
    expect(res.resetCounts['commitments']).toBe(1);
    expect(res.resetCounts['worldStates']).toBe(4);
    expect(prisma.characterSimulationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'character.simulation.reset.v1',
        }),
      })
    );
  });
});
