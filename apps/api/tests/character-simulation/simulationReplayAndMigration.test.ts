import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationReplayService } from '../../src/modules/character-simulation/services/SimulationReplayService.js';
import { SimulationStateMigrator } from '../../src/modules/character-simulation/services/SimulationStateMigrator.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
    simulationRunRecord: {
      findUnique: vi.fn(),
    },
    characterGoal: {
      findMany: vi.fn().mockResolvedValue([{ id: 'g-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    characterPlan: {
      findMany: vi.fn().mockResolvedValue([{ id: 'p-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    characterRoutine: {
      findMany: vi.fn().mockResolvedValue([{ id: 'r-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    characterWorldState: {
      findMany: vi.fn().mockResolvedValue([{ id: 'w-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    characterSimulationEvent: {
      create: vi.fn(),
    },
  },
}));

describe('SimulationReplayService & SimulationStateMigrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays a historical simulation run against its snapshot state', async () => {
    const replayService = SimulationReplayService.getInstance();

    const mockRun = {
      id: 'run-1',
      userId: 'user-1',
      characterId: 'char-maya',
      characterVersionId: 'v1.0',
      triggerType: 'CONVERSATION',
      triggerEventId: null,
      status: 'COMPLETED',
      modelId: 'gpt-4o-mini',
      promptVersion: 'v1.0.0',
      contextHash: 'hash-1',
      outputHash: 'out-1',
      proposalsCount: 1,
      acceptedProposalsCount: 1,
      costUsd: 0.0001,
      latencyMs: 120,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      snapshots: [
        {
          id: 'snap-1',
          simulationRunId: 'run-1',
          userId: 'user-1',
          characterId: 'char-maya',
          stateHash: 'hash-1',
          activeGoalIds: ['g-1'],
          openThreadIds: [],
          commitmentIds: [],
          behaviorMode: 'supportive',
          createdAt: new Date(),
        },
      ],
    };

    vi.mocked(prisma.simulationRunRecord.findUnique).mockResolvedValueOnce(mockRun as any);

    const result = await replayService.replayRun('run-1');

    expect(result.simulationRunId).toBe('run-1');
    expect(result.isDeterministicMatch).toBe(true);
    expect(result.replayedProposals.length).toBe(1);
    expect(result.replayedProposals[0]?.type).toBe('UPDATE_GOAL');
  });

  it('migrates simulation entities safely to a new character version', async () => {
    const migrator = SimulationStateMigrator.getInstance();

    const res = await migrator.migrateCharacterState('char-maya', 'v1.0', 'v2.0', false);

    expect(res.status).toBe('SUCCESS');
    expect(res.goalsMigrated).toBe(1);
    expect(res.plansMigrated).toBe(1);
    expect(res.routinesMigrated).toBe(1);
    expect(res.worldStateMigrated).toBe(1);
    expect(prisma.characterSimulationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'character.simulation.migrated.v1',
          characterVersionId: 'v2.0',
        }),
      })
    );
  });
});
