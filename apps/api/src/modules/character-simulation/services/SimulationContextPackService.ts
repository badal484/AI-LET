import { prisma } from '../../../infrastructure/database/prisma.js';
import { CharacterGoalService } from './CharacterGoalService.js';
import { CharacterPlanService } from './CharacterPlanService.js';
import { CharacterRoutineService } from './CharacterRoutineService.js';
import { CharacterThreadAndCommitmentService } from './CharacterThreadAndCommitmentService.js';
import { CharacterWorldStateService } from './CharacterWorldStateService.js';
import { CharacterTimeContextService } from './CharacterTimeContextService.js';
import { UserSimulationSettingsService } from './UserSimulationSettingsService.js';
import type {
  SimulationContextPack,
  BehaviorMode,
} from '@ai-companion/types';

export class SimulationContextPackService {
  private static instance: SimulationContextPackService;

  private constructor() {}

  public static getInstance(): SimulationContextPackService {
    if (!SimulationContextPackService.instance) {
      SimulationContextPackService.instance = new SimulationContextPackService();
    }
    return SimulationContextPackService.instance;
  }

  /**
   * Compiles the comprehensive, token-budgeted SimulationContextPack for ContextBuilder.
   */
  public async getContextPack(
    userId: string,
    characterId: string,
    userTimezone: string = 'UTC',
    lastInteractionAt?: Date | string | null
  ): Promise<SimulationContextPack> {
    const [settings, simState, goals, plans, routines, commitments, worldEvents] = await Promise.all([
      UserSimulationSettingsService.getInstance().getSettings(userId, characterId),
      prisma.characterSimulationState.findUnique({ where: { userId_characterId: { userId, characterId } } }),
      CharacterGoalService.getInstance().listGoals(userId, characterId, ['ACTIVE', 'IN_PROGRESS']),
      CharacterPlanService.getInstance().listPlans(userId, characterId, ['ACTIVE']),
      CharacterRoutineService.getInstance().listRoutines(characterId, true),
      CharacterThreadAndCommitmentService.getInstance().listPendingCommitments(userId, characterId),
      CharacterWorldStateService.getInstance().listRecentEvents(characterId, userId, 3),
    ]);

    const resolvedTimezone = settings.userTimezone || userTimezone || 'UTC';
    const timeContext = CharacterTimeContextService.getInstance().getTimeContext(
      resolvedTimezone,
      lastInteractionAt
    );

    // Evaluate due routines
    const dueRoutines = routines.filter((r) =>
      CharacterRoutineService.getInstance().isRoutineEligible(r, {
        now: new Date(),
        userTimezone: resolvedTimezone,
      }).eligible
    );

    // Behavioral mode & focus
    let mode: BehaviorMode = (simState?.behaviorMode as BehaviorMode) || 'supportive';
    if (simState?.behaviorExpiresAt && new Date(simState.behaviorExpiresAt).getTime() < Date.now()) {
      mode = 'supportive';
    }

    // Build concise bullet points (token budget: < 250 tokens)
    const lines: string[] = [];

    // 1. Time context
    lines.push(`- Current Contextual Time: ${timeContext.dayOfWeek} ${timeContext.timeOfDay} (${timeContext.localDate})`);
    if (timeContext.elapsedSinceLastInteractionSeconds !== null && timeContext.elapsedSinceLastInteractionSeconds !== undefined) {
      const hours = Math.floor(timeContext.elapsedSinceLastInteractionSeconds / 3600);
      const days = Math.floor(hours / 24);
      if (days > 0) {
        lines.push(`- Time Elapsed Since Last Exchange: ${days} day(s)`);
      } else if (hours > 0) {
        lines.push(`- Time Elapsed Since Last Exchange: ${hours} hour(s)`);
      }
    }

    // 2. Behavioral mode & focus
    lines.push(`- Demeanor / Behavioral Mode: ${mode}${simState?.behaviorReason ? ` (${simState.behaviorReason})` : ''}`);
    if (simState?.currentFocus) {
      lines.push(`- Active Focus: ${simState.currentFocus}`);
    }

    // 3. Active Goal & Plan
    const topGoal = goals[0];
    if (topGoal) {
      lines.push(`- Active Objective: "${topGoal.title}" (${(topGoal.progress * 100).toFixed(0)}% progress)`);
    }

    const topPlan = plans[0];
    if (topPlan && topPlan.steps && topPlan.steps.length > 0) {
      const curStep = topPlan.steps[topPlan.currentStepIndex] || topPlan.steps[0];
      if (curStep) {
        lines.push(`- Ongoing Plan: "${topPlan.title}" (Current Step ${topPlan.currentStepIndex + 1}/${topPlan.steps.length}: "${curStep.title}")`);
      }
    }

    // 4. Commitments
    const topCommitment = commitments[0];
    if (topCommitment) {
      lines.push(`- Pending Commitment: "${topCommitment.description}"`);
    }

    // 5. World Events
    const topEvent = worldEvents[0];
    if (topEvent) {
      lines.push(`- Contextual Event: ${topEvent.eventType} on ${topEvent.entityKey}`);
    }

    lines.push(`*Instruction: Use continuity state as ambient, subtle knowledge. Never force unfinished topics if the user changes the subject.*`);

    const continuityPromptSnippet = lines.join('\n');

    return {
      activeGoals: goals,
      relevantPlans: plans,
      dueRoutines,
      activeCommitments: commitments,
      recentWorldEvents: worldEvents,
      timeContext,
      behaviorMode: mode,
      currentFocus: simState?.currentFocus,
      continuityPromptSnippet,
    };
  }
}
