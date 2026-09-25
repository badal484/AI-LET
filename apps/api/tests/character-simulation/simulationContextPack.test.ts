import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationContextPackService } from '../../src/modules/character-simulation/services/SimulationContextPackService.js';
import { CharacterGoalService } from '../../src/modules/character-simulation/services/CharacterGoalService.js';
import { CharacterPlanService } from '../../src/modules/character-simulation/services/CharacterPlanService.js';
import { CharacterRoutineService } from '../../src/modules/character-simulation/services/CharacterRoutineService.js';
import { CharacterThreadAndCommitmentService } from '../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js';
import { CharacterWorldStateService } from '../../src/modules/character-simulation/services/CharacterWorldStateService.js';
import { UserSimulationSettingsService } from '../../src/modules/character-simulation/services/UserSimulationSettingsService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    characterSimulationState: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterGoalService.js', () => ({
  CharacterGoalService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterPlanService.js', () => ({
  CharacterPlanService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterRoutineService.js', () => ({
  CharacterRoutineService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js', () => ({
  CharacterThreadAndCommitmentService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterWorldStateService.js', () => ({
  CharacterWorldStateService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/UserSimulationSettingsService.js', () => ({
  UserSimulationSettingsService: {
    getInstance: vi.fn(),
  },
}));

describe('SimulationContextPackService - Comprehensive Context Assembly for ContextBuilder', () => {
  let packService: SimulationContextPackService;

  beforeEach(() => {
    vi.clearAllMocks();
    packService = SimulationContextPackService.getInstance();

    vi.mocked(UserSimulationSettingsService.getInstance).mockReturnValue({
      getSettings: vi.fn().mockResolvedValue({
        userTimezone: 'UTC',
        autonomyLevel: 'CONTEXTUAL',
      }),
    } as any);

    vi.mocked(prisma.characterSimulationState.findUnique).mockResolvedValue({
      behaviorMode: 'reflective',
      currentFocus: 'Fictional Novel Chapter 3',
      behaviorExpiresAt: null,
    } as any);

    vi.mocked(CharacterGoalService.getInstance).mockReturnValue({
      listGoals: vi.fn().mockResolvedValue([
        { id: 'g-1', title: 'Write Chapter 3', progress: 0.6, status: 'ACTIVE' },
      ]),
    } as any);

    vi.mocked(CharacterPlanService.getInstance).mockReturnValue({
      listPlans: vi.fn().mockResolvedValue([
        {
          id: 'p-1',
          title: 'Publish Book',
          currentStepIndex: 1,
          steps: [
            { id: 's-1', title: 'Draft Outline', status: 'COMPLETED' },
            { id: 's-2', title: 'Write Manuscript', status: 'IN_PROGRESS' },
          ],
        },
      ]),
    } as any);

    vi.mocked(CharacterRoutineService.getInstance).mockReturnValue({
      listRoutines: vi.fn().mockResolvedValue([
        { id: 'r-1', name: 'Morning Coffee Check-in', active: true },
      ]),
      isRoutineEligible: vi.fn().mockReturnValue({ eligible: true }),
    } as any);

    vi.mocked(CharacterThreadAndCommitmentService.getInstance).mockReturnValue({
      listPendingCommitments: vi.fn().mockResolvedValue([
        { id: 'c-1', description: 'Share new poetry draft tomorrow' },
      ]),
    } as any);

    vi.mocked(CharacterWorldStateService.getInstance).mockReturnValue({
      listRecentEvents: vi.fn().mockResolvedValue([
        { id: 'e-1', eventType: 'PROJECT_STARTED', entityKey: 'novel_manuscript' },
      ]),
    } as any);
  });

  it('compiles all elements into a structured SimulationContextPack with a concise prompt snippet', async () => {
    const pack = await packService.getContextPack('user-1', 'char-maya', 'UTC', new Date(Date.now() - 86400000));

    expect(pack.activeGoals.length).toBe(1);
    expect(pack.relevantPlans.length).toBe(1);
    expect(pack.dueRoutines.length).toBe(1);
    expect(pack.activeCommitments.length).toBe(1);
    expect(pack.recentWorldEvents.length).toBe(1);
    expect(pack.behaviorMode).toBe('reflective');
    expect(pack.currentFocus).toBe('Fictional Novel Chapter 3');

    expect(pack.continuityPromptSnippet).toContain('Active Objective: "Write Chapter 3" (60% progress)');
    expect(pack.continuityPromptSnippet).toContain('Ongoing Plan: "Publish Book" (Current Step 2/2: "Write Manuscript")');
    expect(pack.continuityPromptSnippet).toContain('Pending Commitment: "Share new poetry draft tomorrow"');
    expect(pack.continuityPromptSnippet).toContain('Demeanor / Behavioral Mode: reflective');
    expect(pack.continuityPromptSnippet).toContain('Time Elapsed Since Last Exchange: 1 day(s)');
  });
});
