import type {
  RelationshipDimensions,
  RelationshipStage,
  RelationshipEventType,
  RelationshipMilestoneType,
  RelationshipAnalysisSignal,
  RelationshipBehaviorConfigData,
} from '@ai-companion/types';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export interface PolicyEvaluationInput {
  currentDimensions: RelationshipDimensions;
  currentStage: RelationshipStage;
  totalInteractions: number;
  consecutiveDaysActive: number;
  signals: RelationshipAnalysisSignal[];
  characterConfig?: Partial<RelationshipBehaviorConfigData>;
  eventCountsHistory?: Record<string, number>;
  achievedMilestones?: string[];
  hoursSinceLastInteraction?: number | null;
}

export interface PolicyEvaluationOutput {
  deltas: RelationshipDimensions;
  newDimensions: RelationshipDimensions;
  newStage: RelationshipStage;
  stageChanged: boolean;
  stageTransitionReason?: string;
  newMilestones: Array<{
    type: RelationshipMilestoneType;
    title: string;
    description: string;
  }>;
}

export class RelationshipPolicyEngine {
  private static readonly BASE_DELTAS: Record<RelationshipEventType, RelationshipDimensions> = {
    FIRST_CONVERSATION: {
      familiarity: 15.0,
      trust: 5.0,
      comfort: 5.0,
      affection: 2.0,
      engagement: 20.0,
    },
    CASUAL_CHAT: {
      familiarity: 1.0,
      trust: 0.5,
      comfort: 0.5,
      affection: 0.2,
      engagement: 3.0,
    },
    SHARED_GOAL: {
      familiarity: 4.0,
      trust: 4.0,
      comfort: 3.5,
      affection: 1.5,
      engagement: 6.0,
    },
    SHARED_PREFERENCE: {
      familiarity: 3.0,
      trust: 2.5,
      comfort: 3.0,
      affection: 1.0,
      engagement: 4.0,
    },
    MEANINGFUL_SUPPORT: {
      familiarity: 3.5,
      trust: 5.0,
      comfort: 6.0,
      affection: 2.5,
      engagement: 5.0,
    },
    RETURN_AFTER_BREAK: {
      familiarity: 1.0,
      trust: 1.0,
      comfort: 2.0,
      affection: 1.0,
      engagement: 15.0,
    },
    DEEP_CONVERSATION: {
      familiarity: 5.0,
      trust: 5.5,
      comfort: 5.0,
      affection: 3.0,
      engagement: 8.0,
    },
    BOUNDARY_SET: {
      familiarity: 2.0,
      trust: 3.0, // Respecting boundaries builds trust
      comfort: 2.0,
      affection: 0.0, // Never forced upward on boundary event
      engagement: 2.0,
    },
    CORRECTION_GIVEN: {
      familiarity: 1.5,
      trust: 0.5, // Constructive calibration is positive/neutral
      comfort: 0.5,
      affection: 0.0,
      engagement: 2.0,
    },
    POSITIVE_FEEDBACK: {
      familiarity: 1.5,
      trust: 2.0,
      comfort: 2.5,
      affection: 1.5,
      engagement: 4.0,
    },
    NEGATIVE_FEEDBACK: {
      familiarity: 0.0,
      trust: -2.0,
      comfort: -2.0,
      affection: -1.0,
      engagement: -1.0,
    },
    MILESTONE_REACHED: {
      familiarity: 2.0,
      trust: 2.0,
      comfort: 2.0,
      affection: 1.0,
      engagement: 5.0,
    },
  };

  /**
   * Evaluates relationship signals deterministically, applying bounds, diminishing returns,
   * character modifiers, and stage transition rules.
   */
  public static evaluate(input: PolicyEvaluationInput): PolicyEvaluationOutput {
    const {
      currentDimensions,
      currentStage,
      totalInteractions,
      consecutiveDaysActive,
      signals,
      characterConfig = {},
      eventCountsHistory = {},
      achievedMilestones = [],
      hoursSinceLastInteraction = null,
    } = input;

    // Speed multiplier from character configuration
    let speedMultiplier = 1.0;
    if (characterConfig.progressionSpeed === 'slow_burn') speedMultiplier = 0.6;
    if (characterConfig.progressionSpeed === 'accelerated') speedMultiplier = 1.4;

    // Trust sensitivity multiplier
    const trustSens = (characterConfig.trustSensitivity ?? 50) / 50; // 0.0 - 2.0
    // Familiarity sensitivity multiplier
    const famSens = (characterConfig.familiaritySensitivity ?? 50) / 50; // 0.0 - 2.0

    // Accumulate deltas across all signals
    const accumulatedDeltas: RelationshipDimensions = {
      familiarity: 0,
      trust: 0,
      comfort: 0,
      affection: 0,
      engagement: 0,
    };

    const updatedEventCounts = { ...eventCountsHistory };

    for (const signal of signals) {
      const baseDelta = this.BASE_DELTAS[signal.type] || this.BASE_DELTAS.CASUAL_CHAT;
      const count = updatedEventCounts[signal.type] || 0;
      updatedEventCounts[signal.type] = count + 1;

      // Diminishing returns formula: 1 / (1 + factor * count)
      const diminishingFactor = 1 / (1 + SYSTEM_CONSTANTS.RELATIONSHIP.DIMINISHING_RETURNS_FACTOR * count);
      const signalConfidence = Math.max(0.1, Math.min(1.0, signal.confidence || 0.8));
      const signalImportance = Math.max(0.1, Math.min(1.0, signal.importance || 0.5));

      const weight = signalConfidence * signalImportance * speedMultiplier * diminishingFactor;

      accumulatedDeltas.familiarity += baseDelta.familiarity * famSens * weight;
      accumulatedDeltas.trust += baseDelta.trust * trustSens * weight;
      accumulatedDeltas.comfort += baseDelta.comfort * weight;
      accumulatedDeltas.affection += this.applyAffectionLimits(baseDelta.affection * weight, characterConfig.affectionExpression);
      accumulatedDeltas.engagement += baseDelta.engagement * weight;
    }

    // Anti-manipulation safeguard: if boundary was set, clamp affection delta <= 0
    const hasBoundarySet = signals.some(s => s.type === 'BOUNDARY_SET');
    if (hasBoundarySet) {
      accumulatedDeltas.affection = Math.min(0, accumulatedDeltas.affection);
    }

    // Calculate new dimensions with strict clamping [0, 100]
    const newDimensions: RelationshipDimensions = {
      familiarity: this.clamp(currentDimensions.familiarity + accumulatedDeltas.familiarity),
      trust: this.clamp(currentDimensions.trust + accumulatedDeltas.trust),
      comfort: this.clamp(currentDimensions.comfort + accumulatedDeltas.comfort),
      affection: this.clamp(currentDimensions.affection + accumulatedDeltas.affection),
      engagement: this.clamp(currentDimensions.engagement + accumulatedDeltas.engagement),
    };

    // Evaluate stage transitions
    const newStage = this.determineStage(newDimensions, currentStage, characterConfig);
    const stageChanged = newStage !== currentStage;
    const stageTransitionReason = stageChanged
      ? `Progressed from ${currentStage} to ${newStage} based on relational dynamics.`
      : undefined;

    // Evaluate milestone achievements
    const newMilestones = this.evaluateMilestones({
      dimensions: newDimensions,
      totalInteractions: totalInteractions + 1,
      consecutiveDaysActive,
      achievedMilestones,
      signals,
      hoursSinceLastInteraction,
    });

    return {
      deltas: accumulatedDeltas,
      newDimensions,
      newStage,
      stageChanged,
      stageTransitionReason,
      newMilestones,
    };
  }

  /**
   * Applies character configuration limits to affection delta
   */
  private static applyAffectionLimits(
    rawAffectionDelta: number,
    expression?: 'reserved' | 'moderate' | 'expressive' | 'intense',
  ): number {
    if (rawAffectionDelta <= 0) return rawAffectionDelta;
    switch (expression) {
      case 'reserved':
        return Math.min(rawAffectionDelta, 0.5);
      case 'expressive':
        return Math.min(rawAffectionDelta, 3.5);
      case 'intense':
        return Math.min(rawAffectionDelta, 5.0);
      case 'moderate':
      default:
        return Math.min(rawAffectionDelta, 2.0);
    }
  }

  /**
   * Evaluates stage progression thresholds
   */
  public static determineStage(
    dimensions: RelationshipDimensions,
    _currentStage?: RelationshipStage,
    config?: Partial<RelationshipBehaviorConfigData>,
  ): RelationshipStage {
    const { familiarity, trust, comfort, affection } = dimensions;
    const t = SYSTEM_CONSTANTS.RELATIONSHIP.STAGE_THRESHOLDS;

    // Progression is monotonic unless reset or significant negative events drop dimensions below minimum floor
    const isRomanticAllowed =
      config?.affectionExpression !== 'reserved' &&
      (config as any)?.attachmentFraming !== 'strictly_platonic';

    if (
      isRomanticAllowed &&
      familiarity >= t.ROMANTIC_PARTNER.minFamiliarity &&
      trust >= t.ROMANTIC_PARTNER.minTrust &&
      comfort >= t.ROMANTIC_PARTNER.minComfort &&
      affection >= t.ROMANTIC_PARTNER.minAffection
    ) {
      return 'ROMANTIC_PARTNER';
    }

    if (
      familiarity >= t.CONFIDANT.minFamiliarity &&
      trust >= t.CONFIDANT.minTrust &&
      comfort >= t.CONFIDANT.minComfort &&
      affection >= t.CONFIDANT.minAffection
    ) {
      return 'CONFIDANT';
    }

    if (
      familiarity >= t.CLOSE_FRIEND.minFamiliarity &&
      trust >= t.CLOSE_FRIEND.minTrust &&
      comfort >= t.CLOSE_FRIEND.minComfort &&
      affection >= t.CLOSE_FRIEND.minAffection
    ) {
      return 'CLOSE_FRIEND';
    }

    if (
      familiarity >= t.FRIEND.minFamiliarity &&
      trust >= t.FRIEND.minTrust &&
      comfort >= t.FRIEND.minComfort &&
      affection >= t.FRIEND.minAffection
    ) {
      return 'FRIEND';
    }

    if (
      familiarity >= t.ACQUAINTANCE.minFamiliarity &&
      trust >= t.ACQUAINTANCE.minTrust &&
      comfort >= t.ACQUAINTANCE.minComfort
    ) {
      return 'ACQUAINTANCE';
    }

    return 'STRANGER';
  }

  /**
   * Evaluates milestone triggers
   */
  private static evaluateMilestones(params: {
    dimensions: RelationshipDimensions;
    totalInteractions: number;
    consecutiveDaysActive: number;
    achievedMilestones: string[];
    signals: RelationshipAnalysisSignal[];
    hoursSinceLastInteraction: number | null;
  }): Array<{ type: RelationshipMilestoneType; title: string; description: string }> {
    const { totalInteractions, consecutiveDaysActive, achievedMilestones, signals, hoursSinceLastInteraction } = params;
    const newlyAchieved: Array<{ type: RelationshipMilestoneType; title: string; description: string }> = [];

    const hasAchieved = (type: string) => achievedMilestones.includes(type);

    if (totalInteractions === 1 && !hasAchieved('FIRST_CONVERSATION')) {
      newlyAchieved.push({
        type: 'FIRST_CONVERSATION',
        title: 'First Connection',
        description: 'Completed the inaugural conversation with the character.',
      });
    }

    if (
      hoursSinceLastInteraction !== null &&
      hoursSinceLastInteraction >= 48 &&
      !hasAchieved('FIRST_RETURN')
    ) {
      newlyAchieved.push({
        type: 'FIRST_RETURN',
        title: 'Reconnected',
        description: 'Returned to converse after a break of over 48 hours.',
      });
    }

    if (signals.some(s => s.type === 'SHARED_GOAL') && !hasAchieved('SHARED_GOAL')) {
      newlyAchieved.push({
        type: 'SHARED_GOAL',
        title: 'Shared Aspirations',
        description: 'Shared an important life aspiration or personal objective.',
      });
    }

    if (signals.some(s => s.type === 'DEEP_CONVERSATION') && !hasAchieved('DEEP_CONVERSATION')) {
      newlyAchieved.push({
        type: 'DEEP_CONVERSATION',
        title: 'Deep Exploration',
        description: 'Engaged in a thoughtful and vulnerable dialogue.',
      });
    }

    if (
      (consecutiveDaysActive >= 7 || totalInteractions >= 25) &&
      !hasAchieved('PROLONGED_CONNECTION')
    ) {
      newlyAchieved.push({
        type: 'PROLONGED_CONNECTION',
        title: 'Consistent Companion',
        description: 'Established a sustained, multi-day conversational relationship.',
      });
    }

    return newlyAchieved;
  }

  private static clamp(value: number): number {
    return Math.max(
      SYSTEM_CONSTANTS.RELATIONSHIP.DIMENSION_BOUNDS.MIN,
      Math.min(SYSTEM_CONSTANTS.RELATIONSHIP.DIMENSION_BOUNDS.MAX, Math.round(value * 10) / 10),
    );
  }
}
