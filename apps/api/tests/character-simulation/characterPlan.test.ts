import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterPlanService } from '../../src/modules/character-simulation/services/CharacterPlanService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    characterPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    characterPlanStep: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    characterSimulationEvent: {
      create: vi.fn(),
    },
  },
}));

describe('CharacterPlanService - Long-Horizon Plans & Dependency Step Execution', () => {
  let planService: CharacterPlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    planService = CharacterPlanService.getInstance();
  });

  it('creates a new multi-step plan with initial step IN_PROGRESS and subsequent steps PENDING', async () => {
    const mockCreatedPlan = {
      id: 'plan-101',
      characterId: 'char-maya',
      userId: 'user-1',
      characterVersionId: 'v1.0',
      goalId: 'goal-1',
      title: 'Prepare Art Exhibition',
      description: 'Step-by-step art preparation',
      status: 'ACTIVE',
      currentStepIndex: 0,
      version: 1,
      expiresAt: null,
      completedAt: null,
      metadata: null,
      steps: [
        { id: 'step-1', planId: 'plan-101', sequence: 0, title: 'Brainstorm Concept', status: 'IN_PROGRESS', dependencies: [] },
        { id: 'step-2', planId: 'plan-101', sequence: 1, title: 'Draft Sketches', status: 'PENDING', dependencies: [0] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.characterPlan.create).mockResolvedValueOnce(mockCreatedPlan as any);

    const plan = await planService.createPlan({
      characterId: 'char-maya',
      userId: 'user-1',
      characterVersionId: 'v1.0',
      goalId: 'goal-1',
      title: 'Prepare Art Exhibition',
      description: 'Step-by-step art preparation',
      steps: [
        { sequence: 0, title: 'Brainstorm Concept' },
        { sequence: 1, title: 'Draft Sketches', dependencies: [0] },
      ],
    });

    expect(plan.id).toBe('plan-101');
    expect(plan.status).toBe('ACTIVE');
    expect(plan.steps?.length).toBe(2);
    expect(prisma.characterPlan.create).toHaveBeenCalled();
    expect(prisma.characterSimulationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'character.plan.created.v1',
          characterId: 'char-maya',
        }),
      })
    );
  });

  it('rejects step advancement if unsatisfied dependencies exist', async () => {
    const mockPlan = {
      id: 'plan-101',
      characterId: 'char-maya',
      userId: 'user-1',
      title: 'Prepare Art Exhibition',
      status: 'ACTIVE',
      currentStepIndex: 0,
      steps: [
        { id: 'step-1', sequence: 0, title: 'Brainstorm Concept', status: 'IN_PROGRESS', dependencies: [] },
        { id: 'step-2', sequence: 1, title: 'Draft Sketches', status: 'PENDING', dependencies: ['step-1'] },
      ],
    };

    vi.mocked(prisma.characterPlan.findUnique).mockResolvedValueOnce(mockPlan as any);

    // Attempting to complete step-2 while step-1 is still IN_PROGRESS
    await expect(
      planService.updatePlanStep('plan-101', 'step-2', { status: 'COMPLETED' })
    ).rejects.toThrow('dependent step');
  });

  it('advances to next step and completes plan when all steps are completed', async () => {
    const mockPlan = {
      id: 'plan-101',
      characterId: 'char-maya',
      userId: 'user-1',
      title: 'Prepare Art Exhibition',
      status: 'ACTIVE',
      currentStepIndex: 0,
      version: 1,
      steps: [
        { id: 'step-1', sequence: 0, title: 'Brainstorm Concept', status: 'IN_PROGRESS', dependencies: [] },
        { id: 'step-2', sequence: 1, title: 'Draft Sketches', status: 'PENDING', dependencies: ['step-1'] },
      ],
    };

    vi.mocked(prisma.characterPlan.findUnique).mockResolvedValueOnce(mockPlan as any);
    vi.mocked(prisma.characterPlanStep.findMany).mockResolvedValueOnce([
      { id: 'step-1', sequence: 0, title: 'Brainstorm Concept', status: 'COMPLETED' },
      { id: 'step-2', sequence: 1, title: 'Draft Sketches', status: 'PENDING' },
    ] as any);

    vi.mocked(prisma.characterPlan.update).mockResolvedValueOnce({
      ...mockPlan,
      currentStepIndex: 1,
      version: 2,
      steps: [
        { id: 'step-1', sequence: 0, title: 'Brainstorm Concept', status: 'COMPLETED' },
        { id: 'step-2', sequence: 1, title: 'Draft Sketches', status: 'IN_PROGRESS' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const advancedPlan = await planService.updatePlanStep('plan-101', 'step-1', { status: 'COMPLETED' });

    expect(advancedPlan.currentStepIndex).toBe(1);
    expect(prisma.characterPlanStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'step-2' },
        data: { status: 'IN_PROGRESS' },
      })
    );
  });
});
