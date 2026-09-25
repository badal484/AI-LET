import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterContinuityService } from '../../src/modules/character-simulation/services/CharacterContinuityService.js';
import { CharacterGoalService } from '../../src/modules/character-simulation/services/CharacterGoalService.js';
import { CharacterThreadAndCommitmentService } from '../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    characterSimulationState: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterGoalService.js', () => ({
  CharacterGoalService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js', () => ({
  CharacterThreadAndCommitmentService: {
    getInstance: vi.fn(),
  },
}));

describe('CharacterContinuityService - Context Compilation & Behavioral State', () => {
  let continuityService: CharacterContinuityService;
  let mockGoalService: any;
  let mockThreadService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    continuityService = CharacterContinuityService.getInstance();

    mockGoalService = {
      listGoals: vi.fn().mockResolvedValue([]),
    };
    (CharacterGoalService.getInstance as any).mockReturnValue(mockGoalService);

    mockThreadService = {
      listActiveThreads: vi.fn().mockResolvedValue([]),
      listPendingCommitments: vi.fn().mockResolvedValue([]),
    };
    (CharacterThreadAndCommitmentService.getInstance as any).mockReturnValue(mockThreadService);
  });

  describe('1. State Initialization & Retrieval', () => {
    it('creates default simulation state if none exists', async () => {
      vi.mocked(prisma.characterSimulationState.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.characterSimulationState.create).mockResolvedValueOnce({
        id: 'sim-state-1',
        userId: 'u-1',
        characterId: 'c-1',
        version: 1,
        behaviorMode: 'supportive',
        behaviorReason: null,
        behaviorExpiresAt: null,
        currentFocus: null,
        initiativeLevel: 'BALANCED',
        lastSimulationAt: null,
        nextEligibleSimulationAt: null,
        metadata: null,
        updatedAt: new Date(),
      } as any);

      const state = await continuityService.getOrCreateSimulationState('u-1', 'c-1');
      expect(state.behaviorMode).toBe('supportive');
      expect(state.initiativeLevel).toBe('BALANCED');
      expect(prisma.characterSimulationState.create).toHaveBeenCalled();
    });
  });

  describe('2. Behavioral Mode Decay', () => {
    it('resets expired behavior mode to supportive baseline', async () => {
      const expiredState = {
        id: 'sim-state-1',
        userId: 'u-1',
        characterId: 'c-1',
        version: 2,
        behaviorMode: 'reflective',
        behaviorReason: 'Recent serious topic',
        behaviorExpiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
        currentFocus: 'Philosophy',
        initiativeLevel: 'BALANCED',
        lastSimulationAt: null,
        nextEligibleSimulationAt: null,
        metadata: null,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.characterSimulationState.findUnique).mockResolvedValueOnce(expiredState as any);

      const continuity = await continuityService.getContinuityContext('u-1', 'c-1');
      expect(continuity.behaviorMode).toBe('supportive');
      expect(continuity.continuityPromptSnippet).toContain('Current Demeanor / Behavioral Mode: supportive');
    });

    it('persists updated behavior mode with TTL', async () => {
      vi.mocked(prisma.characterSimulationState.upsert).mockResolvedValueOnce({} as any);

      await continuityService.updateBehaviorMode('u-1', 'c-1', 'playful', 'User is celebrating', 12);

      expect(prisma.characterSimulationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            behaviorMode: 'playful',
            behaviorReason: 'User is celebrating',
            behaviorExpiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('3. Continuity Prompt Snippet Compilation', () => {
    it('compiles bounded, bulleted continuity snippet with safety reminder', async () => {
      const activeState = {
        id: 'sim-state-1',
        userId: 'u-1',
        characterId: 'c-1',
        version: 1,
        behaviorMode: 'curious',
        behaviorReason: 'Exploring user hobby',
        behaviorExpiresAt: new Date(Date.now() + 10 * 3600 * 1000),
        currentFocus: 'Astrophotography',
        initiativeLevel: 'BALANCED',
        lastSimulationAt: null,
        nextEligibleSimulationAt: null,
        metadata: null,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.characterSimulationState.findUnique).mockResolvedValueOnce(activeState as any);
      mockGoalService.listGoals.mockResolvedValueOnce([
        {
          id: 'g-1',
          title: 'Learn telescope optics',
          progress: 0.4,
        },
      ]);
      mockThreadService.listActiveThreads.mockResolvedValueOnce([
        {
          id: 't-1',
          topic: 'Stargazing trip in July',
          status: 'OPEN',
        },
      ]);
      mockThreadService.listPendingCommitments.mockResolvedValueOnce([
        {
          id: 'c-1',
          description: 'Share article on deep sky filters',
          status: 'PENDING',
        },
      ]);

      const context = await continuityService.getContinuityContext('u-1', 'c-1');

      expect(context.continuityPromptSnippet).toContain('Current Demeanor / Behavioral Mode: curious (Exploring user hobby)');
      expect(context.continuityPromptSnippet).toContain('Active Focus: Astrophotography');
      expect(context.continuityPromptSnippet).toContain('Persistent Objective: "Learn telescope optics" (40% progress)');
      expect(context.continuityPromptSnippet).toContain('Unresolved Topic Thread: "Stargazing trip in July" (Status: OPEN)');
      expect(context.continuityPromptSnippet).toContain('Pending Character Commitment: "Share article on deep sky filters"');
      expect(context.continuityPromptSnippet).toContain('Never force unresolved topics if the user wishes to speak about something else.');
    });
  });
});
