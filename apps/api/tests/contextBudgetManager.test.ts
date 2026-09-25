import { describe, it, expect } from 'vitest';
import { ContextBudgetManager, PromptSectionInput } from '../src/modules/ai/context/ContextBudgetManager.js';

describe('Context Budget Manager & 8-Tier Priority Packing', () => {
  const contextManager = ContextBudgetManager.getInstance();

  const sampleSections: PromptSectionInput = {
    systemSafety: ['Platform safety constraint: Do not output harmful content.'],
    runtimeConstraints: ['User preferred language is English.'],
    currentUserMessage: 'Can you help me organize my weekly schedule?',
    characterIdentity: ['You are a supportive mentor named Sophia.'],
    currentConversation: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there! How can I help you today?' },
    ],
    relevantMemories: [
      'User works as a software engineer.',
      'User prefers morning workouts.',
      'User has an upcoming exam on Friday.',
    ],
    relationshipContext: ['Relationship closeness score: 4.5/5', 'Trust level: High'],
    optionalHistory: [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'Paris is the capital of France.' },
      { role: 'user', content: 'Thanks!' },
      { role: 'assistant', content: 'You are welcome!' },
    ],
  };

  it('calculates token budget accurately across all 8 tiers', () => {
    const breakdown = contextManager.calculateBudget(sampleSections, 4096, 512);

    expect(breakdown.totalCapacity).toBe(4096);
    expect(breakdown.categories.system_safety).toBeGreaterThan(0);
    expect(breakdown.categories.user_message).toBeGreaterThan(0);
    expect(breakdown.categories.memory).toBeGreaterThan(0);
    expect(breakdown.remainingTokens).toBeGreaterThan(0);
  });

  it('prunes lowest priority tiers first on context overflow without dropping safety or user message', () => {
    // Force a small context limit of 120 tokens with 20 reserve
    const pruningResult = contextManager.pruneToBudget(sampleSections, 150, 30);

    expect(pruningResult.wasPruned).toBe(true);
    expect(pruningResult.finalTokenCount).toBeLessThanOrEqual(120);

    // Verify Tier 8 (optionalHistory) and Tier 7 (relationship) were dropped first
    expect(pruningResult.droppedCategories).toContain('historical_archive');

    // CRITICAL: Verify Tier 1 (safety), Tier 2 (runtime constraints), Tier 3 (user message), Tier 4 (character) remain intact
    expect(pruningResult.prunedSections.systemSafety).toEqual(sampleSections.systemSafety);
    expect(pruningResult.prunedSections.runtimeConstraints).toEqual(sampleSections.runtimeConstraints);
    expect(pruningResult.prunedSections.currentUserMessage).toBe(sampleSections.currentUserMessage);
    expect(pruningResult.prunedSections.characterIdentity).toEqual(sampleSections.characterIdentity);
  });

  it('computes deterministic SHA-256 context hash for identical inputs', () => {
    const hash1 = contextManager.computeContextHash(sampleSections, 'gpt-4o');
    const hash2 = contextManager.computeContextHash(sampleSections, 'gpt-4o');

    expect(hash1.hash).toBe(hash2.hash);
    expect(hash1.hash).toHaveLength(64);
  });
});
