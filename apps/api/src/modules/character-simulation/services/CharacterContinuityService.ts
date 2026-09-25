import { prisma } from '../../../infrastructure/database/prisma.js';
import { CharacterGoalService } from './CharacterGoalService.js';
import { CharacterThreadAndCommitmentService } from './CharacterThreadAndCommitmentService.js';
import type {
  CharacterContinuityContext,
  CharacterSimulationStateItem,
  BehaviorMode,
} from '@ai-companion/types';

export class CharacterContinuityService {
  private static instance: CharacterContinuityService;

  private constructor() {}

  public static getInstance(): CharacterContinuityService {
    if (!CharacterContinuityService.instance) {
      CharacterContinuityService.instance = new CharacterContinuityService();
    }
    return CharacterContinuityService.instance;
  }

  /**
   * Retrieves or initializes the simulation state for a user-character pair.
   */
  public async getOrCreateSimulationState(userId: string, characterId: string): Promise<CharacterSimulationStateItem> {
    let state = await prisma.characterSimulationState.findUnique({
      where: {
        userId_characterId: { userId, characterId },
      },
    });

    if (!state) {
      state = await prisma.characterSimulationState.create({
        data: {
          userId,
          characterId,
          version: 1,
          behaviorMode: 'supportive',
          initiativeLevel: 'BALANCED',
        },
      });
    }

    return {
      id: state.id,
      userId: state.userId,
      characterId: state.characterId,
      version: state.version,
      currentFocus: state.currentFocus,
      behaviorMode: state.behaviorMode as BehaviorMode,
      behaviorReason: state.behaviorReason,
      behaviorExpiresAt: state.behaviorExpiresAt ? state.behaviorExpiresAt.toISOString() : null,
      initiativeLevel: state.initiativeLevel as any,
      lastSimulationAt: state.lastSimulationAt ? state.lastSimulationAt.toISOString() : null,
      nextEligibleSimulationAt: state.nextEligibleSimulationAt ? state.nextEligibleSimulationAt.toISOString() : null,
      metadata: state.metadata as Record<string, unknown> | null,
      updatedAt: state.updatedAt.toISOString(),
    };
  }

  /**
   * Updates behavioral mode with optional TTL decay.
   */
  public async updateBehaviorMode(
    userId: string,
    characterId: string,
    mode: BehaviorMode,
    reason?: string,
    ttlHours: number = 24
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await prisma.characterSimulationState.upsert({
      where: {
        userId_characterId: { userId, characterId },
      },
      update: {
        behaviorMode: mode,
        behaviorReason: reason || null,
        behaviorExpiresAt: expiresAt,
        version: { increment: 1 },
      },
      create: {
        userId,
        characterId,
        behaviorMode: mode,
        behaviorReason: reason || null,
        behaviorExpiresAt: expiresAt,
        initiativeLevel: 'BALANCED',
      },
    });
  }

  /**
   * Assembles a compact, budgeted continuity context for prompt compilation.
   */
  public async getContinuityContext(userId: string, characterId: string): Promise<CharacterContinuityContext> {
    const [state, goals, threads, commitments] = await Promise.all([
      this.getOrCreateSimulationState(userId, characterId),
      CharacterGoalService.getInstance().listGoals(userId, characterId, ['ACTIVE', 'IN_PROGRESS']),
      CharacterThreadAndCommitmentService.getInstance().listActiveThreads(userId, characterId),
      CharacterThreadAndCommitmentService.getInstance().listPendingCommitments(userId, characterId),
    ]);

    // Check if behavioral mode expired
    let currentMode: BehaviorMode = state.behaviorMode;
    if (state.behaviorExpiresAt && new Date(state.behaviorExpiresAt).getTime() < Date.now()) {
      currentMode = 'supportive'; // Reset to baseline default
    }

    // Format concise bullet points for prompt injection (budget: < 200 tokens)
    const lines: string[] = [];
    lines.push(`- Current Demeanor / Behavioral Mode: ${currentMode}${state.behaviorReason ? ` (${state.behaviorReason})` : ''}`);

    if (state.currentFocus) {
      lines.push(`- Active Focus: ${state.currentFocus}`);
    }

    const topGoal = goals[0];
    if (topGoal) {
      lines.push(`- Persistent Objective: "${topGoal.title}" (${(topGoal.progress * 100).toFixed(0)}% progress)`);
    }

    const topThread = threads[0];
    if (topThread) {
      lines.push(`- Unresolved Topic Thread: "${topThread.topic}" (Status: ${topThread.status})`);
    }

    const topCommitment = commitments[0];
    if (topCommitment) {
      lines.push(`- Pending Character Commitment: "${topCommitment.description}"`);
    }

    lines.push(`*Note: Continuity is subtle contextual background. Never force unresolved topics if the user wishes to speak about something else.*`);

    const snippet = lines.join('\n');

    return {
      activeGoals: goals,
      openThreads: threads,
      activeCommitments: commitments,
      behaviorMode: currentMode,
      currentFocus: state.currentFocus,
      continuityPromptSnippet: snippet,
    };
  }
}
