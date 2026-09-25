import { describe, it, expect } from 'vitest';
import { RelationshipPolicyEngine } from '../src/modules/relationships/services/relationshipPolicyEngine.service.js';
import type { RelationshipDimensions } from '@ai-companion/types';

describe('Phase 6: RelationshipPolicyEngine', () => {
  const baselineDimensions: RelationshipDimensions = {
    familiarity: 20,
    trust: 20,
    comfort: 20,
    affection: 10,
    engagement: 50,
  };

  it('should apply bounds strictly within [0, 100]', () => {
    // Test upper bound clamping
    const maxDimensions: RelationshipDimensions = {
      familiarity: 98,
      trust: 99,
      comfort: 99,
      affection: 98,
      engagement: 95,
    };

    const result = RelationshipPolicyEngine.evaluate({
      currentDimensions: maxDimensions,
      currentStage: 'CONFIDANT',
      totalInteractions: 50,
      consecutiveDaysActive: 10,
      signals: [
        {
          type: 'DEEP_CONVERSATION',
          confidence: 1.0,
          importance: 1.0,
          description: 'Deep dialogue',
          suggestedTone: 'reflective',
          topicSensitivity: 'normal',
        },
      ],
      characterConfig: {
        progressionSpeed: 'accelerated',
        trustSensitivity: 100,
        familiaritySensitivity: 100,
      },
    });

    expect(result.newDimensions.familiarity).toBeLessThanOrEqual(100);
    expect(result.newDimensions.trust).toBe(100);
    expect(result.newDimensions.comfort).toBe(100);
    expect(result.newDimensions.affection).toBeLessThanOrEqual(100);
    expect(result.newDimensions.engagement).toBe(100);
  });

  it('should apply diminishing returns on repeated interaction signals', () => {
    const signal = {
      type: 'SHARED_GOAL' as const,
      confidence: 1.0,
      importance: 1.0,
      description: 'Shared goal',
      suggestedTone: 'excited' as const,
      topicSensitivity: 'normal' as const,
    };

    // First occurrence (count = 0)
    const firstEval = RelationshipPolicyEngine.evaluate({
      currentDimensions: baselineDimensions,
      currentStage: 'ACQUAINTANCE',
      totalInteractions: 5,
      consecutiveDaysActive: 1,
      signals: [signal],
      eventCountsHistory: { SHARED_GOAL: 0 },
    });

    // 5th occurrence (count = 5)
    const repeatedEval = RelationshipPolicyEngine.evaluate({
      currentDimensions: baselineDimensions,
      currentStage: 'ACQUAINTANCE',
      totalInteractions: 20,
      consecutiveDaysActive: 3,
      signals: [signal],
      eventCountsHistory: { SHARED_GOAL: 5 },
    });

    expect(firstEval.deltas.trust).toBeGreaterThan(repeatedEval.deltas.trust);
    expect(firstEval.deltas.familiarity).toBeGreaterThan(repeatedEval.deltas.familiarity);
  });

  it('should enforce boundary events and prevent forced affection increases', () => {
    const boundarySignal = {
      type: 'BOUNDARY_SET' as const,
      confidence: 1.0,
      importance: 0.9,
      description: 'User requested strictly professional boundaries',
      suggestedTone: 'serious' as const,
      topicSensitivity: 'high' as const,
    };

    const result = RelationshipPolicyEngine.evaluate({
      currentDimensions: baselineDimensions,
      currentStage: 'FRIEND',
      totalInteractions: 10,
      consecutiveDaysActive: 2,
      signals: [boundarySignal],
      characterConfig: {
        boundaryBehavior: 'strict',
        affectionExpression: 'expressive',
      },
    });

    // Affection delta must be <= 0
    expect(result.deltas.affection).toBeLessThanOrEqual(0);
    // Trust should increase for respecting boundaries
    expect(result.deltas.trust).toBeGreaterThan(0);
    expect(result.newDimensions.trust).toBeGreaterThan(baselineDimensions.trust);
  });

  it('should handle user corrections gently without trust collapse', () => {
    const correctionSignal = {
      type: 'CORRECTION_GIVEN' as const,
      confidence: 0.9,
      importance: 0.5,
      description: 'User corrected misunderstandings',
      suggestedTone: 'calm' as const,
      topicSensitivity: 'normal' as const,
    };

    const result = RelationshipPolicyEngine.evaluate({
      currentDimensions: baselineDimensions,
      currentStage: 'FRIEND',
      totalInteractions: 8,
      consecutiveDaysActive: 2,
      signals: [correctionSignal],
    });

    // Correction should not decrease trust
    expect(result.deltas.trust).toBeGreaterThanOrEqual(0);
    expect(result.newDimensions.trust).toBeGreaterThanOrEqual(baselineDimensions.trust);
  });

  it('should advance stage correctly based on relational dimensions and attachment rules', () => {
    // 1. Progress to FRIEND when meeting threshold
    const friendDims: RelationshipDimensions = {
      familiarity: 45,
      trust: 45,
      comfort: 40,
      affection: 20,
      engagement: 60,
    };
    const friendStage = RelationshipPolicyEngine.determineStage(friendDims, 'ACQUAINTANCE');
    expect(friendStage).toBe('FRIEND');

    // 2. Progress to CLOSE_FRIEND
    const closeFriendDims: RelationshipDimensions = {
      familiarity: 65,
      trust: 65,
      comfort: 60,
      affection: 35,
      engagement: 75,
    };
    const closeFriendStage = RelationshipPolicyEngine.determineStage(closeFriendDims, 'FRIEND');
    expect(closeFriendStage).toBe('CLOSE_FRIEND');

    // 3. Progress to CONFIDANT
    const confidantDims: RelationshipDimensions = {
      familiarity: 80,
      trust: 80,
      comfort: 75,
      affection: 55,
      engagement: 85,
    };
    const confidantStage = RelationshipPolicyEngine.determineStage(confidantDims, 'CLOSE_FRIEND');
    expect(confidantStage).toBe('CONFIDANT');

    // 4. Romantic progression blocked if strictly platonic
    const platonicConfig = { attachmentFraming: 'strictly_platonic' as const };
    const maxDims: RelationshipDimensions = {
      familiarity: 90,
      trust: 90,
      comfort: 90,
      affection: 90,
      engagement: 90,
    };
    const blockedStage = RelationshipPolicyEngine.determineStage(maxDims, 'CONFIDANT', platonicConfig);
    expect(blockedStage).toBe('CONFIDANT');

    // 5. Romantic progression allowed if open romantic
    const romanticConfig = { attachmentFraming: 'open_romantic' as const };
    const romanticStage = RelationshipPolicyEngine.determineStage(maxDims, 'CONFIDANT', romanticConfig);
    expect(romanticStage).toBe('ROMANTIC_PARTNER');
  });

  it('should trigger milestones accurately', () => {
    // Inaugural conversation milestone
    const inauguralResult = RelationshipPolicyEngine.evaluate({
      currentDimensions: { familiarity: 0, trust: 20, comfort: 20, affection: 10, engagement: 50 },
      currentStage: 'STRANGER',
      totalInteractions: 0,
      consecutiveDaysActive: 1,
      signals: [{ type: 'FIRST_CONVERSATION', confidence: 1.0, importance: 0.8, description: 'First interaction', suggestedTone: 'warm', topicSensitivity: 'low' }],
    });

    expect(inauguralResult.newMilestones.some(m => m.type === 'FIRST_CONVERSATION')).toBe(true);

    // Reconnection milestone after 48h
    const reconnectResult = RelationshipPolicyEngine.evaluate({
      currentDimensions: baselineDimensions,
      currentStage: 'FRIEND',
      totalInteractions: 10,
      consecutiveDaysActive: 1,
      signals: [{ type: 'RETURN_AFTER_BREAK', confidence: 1.0, importance: 0.7, description: 'Returned', suggestedTone: 'warm', topicSensitivity: 'normal' }],
      hoursSinceLastInteraction: 72,
    });

    expect(reconnectResult.newMilestones.some(m => m.type === 'FIRST_RETURN')).toBe(true);
  });
});
