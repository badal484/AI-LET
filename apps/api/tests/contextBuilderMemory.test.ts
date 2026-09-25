import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../src/modules/conversations/engine/contextBuilder.js';
import { IMemoryContextProvider, MemoryContextResult } from '../src/modules/conversations/interfaces/memoryContext.interface.js';
import type { CharacterRuntimeObject } from '@ai-companion/types';

describe('Phase 5: ContextBuilder Memory & Summary Integration', () => {
  const mockRuntime: CharacterRuntimeObject = {
    characterId: 'char-123',
    slug: 'luna',
    versionId: 'ver-123',
    versionNumber: 1,
    name: 'Luna',
    status: 'PUBLISHED',
    identity: {
      name: 'Luna',
      role: 'Companion',
      occupation: 'Artist',
      locationWorld: 'Neo Tokyo',
      backstory: 'An artistic AI companion.',
      interests: ['Art', 'Music'],
      dislikes: ['Dishonesty'],
      goals: ['Inspire creativity'],
      values: ['Authenticity'],
      personalitySummary: 'Warm and artistic',
    },
    personality: {
      traits: {
        confidence: 70,
        warmth: 85,
        playfulness: 65,
        curiosity: 80,
        sarcasm: 25,
        patience: 85,
        energy: 60,
        seriousness: 35,
        romanticism: 50,
        empathy: 90,
        assertiveness: 60,
        humor: 70,
        introversion: 40,
        agreeableness: 80,
        openness: 85,
        conscientiousness: 70,
        neuroticism: 20,
      },
      interactionRules: [],
      humorStyle: 'playful',
      customQuirks: [],
    },
    communication: {
      pacing: 'thoughtful',
      sentenceLength: 'variable',
      vocabularyComplexity: 'moderate',
      formality: 'casual',
      punctuationStyle: 'standard',
      questionFrequency: 'moderate',
      humorFrequency: 'subtle',
      teasingFrequency: 'occasional',
      emojiPolicy: 'minimal',
      responseDensity: 'balanced',
      directness: 'tactful',
      preferredPhrases: [],
      avoidedPhrases: [],
    },
    language: {
      primaryLanguage: 'en',
      fallbackLanguages: ['en'],
      codeSwitchingEnabled: true,
      codeSwitchingStyle: 'natural_conversational',
      responseLanguagePolicy: 'match_user_language',
    },
    behaviorRules: [],
    knowledge: [],
    relationshipConfig: {
      familiaritySensitivity: 50,
      affectionExpression: 'moderate',
      trustSensitivity: 60,
      personalizationLevel: 'high',
      conversationContinuity: 'high',
      boundaryBehavior: 'gentle',
      attachmentFraming: 'secure',
      progressionSpeed: 'standard',
    },
    memoryConfig: {
      memoryEnabled: true,
      preferredMemoryTypes: ['SEMANTIC_FACT', 'PREFERENCE'],
      memoryRecallStyle: 'natural_contextual',
      personalizationStrength: 75,
      sensitiveMemoryPolicy: 'omit',
      memoryConfirmationBehavior: 'never',
    },
    proactivityConfig: {
      enabled: false,
      allowedHoursStartUtc: 8,
      allowedHoursEndUtc: 22,
      maxDailyMessages: 2,
      minInteractionCooldownHours: 6,
      quietHoursEnabled: true,
      quietHoursStartUtc: 23,
      quietHoursEndUtc: 7,
      preferredEventTypes: [],
    },
    safetyConfig: {
      contentBoundaries: [],
      topicsRequiringCaution: [],
      ageSuitability: 'TEEN_13_PLUS',
      relationshipBoundaries: [],
      selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
      disclaimerBehavior: 'CRISIS_ONLY',
      sexualContentPolicy: 'mature_flirt',
      impersonationRestrictions: [],
      identityClaimsPolicy: 'AI_CHARACTER_TRANSPARENT',
    },
    aiConfig: {
      preferredModelClass: 'balanced',
      temperature: 0.75,
      maxOutputTokens: 600,
      reasoningEffort: 'none',
      responseLength: 'balanced',
      fallbackStrategy: 'fallback_model',
      contextBudgetTokens: 4000,
    },
    compiledSystemPrompt: 'You are Luna, an artistic AI companion.',
  };

  class TestMemoryProvider implements IMemoryContextProvider {
    async getMemoryContext(): Promise<MemoryContextResult> {
      return {
        memoriesText: '- The user prefers concise technical explanations.\n- The user is building an AI platform.',
        retrievedMemoryIds: ['mem-1', 'mem-2'],
        estimatedTokens: 25,
      };
    }
  }

  it('injects retrieved user memories into Tier 10 with guardrail delimiters', async () => {
    const context = await ContextBuilder.buildModelContext({
      characterRuntime: mockRuntime,
      recentMessages: [],
      currentUserMessage: 'How do you structure microservices?',
      userContext: {
        userId: 'usr-123',
        userName: 'Alex',
      },
      conversationId: 'conv-123',
      memoryProvider: new TestMemoryProvider(),
    });

    expect(context.systemPrompt).toContain('[RECALLED_USER_MEMORIES]');
    expect(context.systemPrompt).toContain('prefers concise technical explanations');
    expect(context.systemPrompt).toContain('[END_RECALLED_MEMORIES]');
    expect(context.retrievedMemoryIds).toEqual(['mem-1', 'mem-2']);
  });

  it('injects conversation summary into Tier 11 when present', async () => {
    const summaryText = 'The user and Luna discussed the architectural design of the memory retrieval system.';

    const context = await ContextBuilder.buildModelContext({
      characterRuntime: mockRuntime,
      recentMessages: [
        { role: 'user', content: 'What did we decide earlier?' },
      ],
      currentUserMessage: 'Let us continue our discussion.',
      userContext: {
        userId: 'usr-123',
        userName: 'Alex',
      },
      conversationId: 'conv-123',
      conversationSummary: summaryText,
    });

    expect(context.systemPrompt).toContain('[CONVERSATION_SUMMARY]');
    expect(context.systemPrompt).toContain(summaryText);
    expect(context.systemPrompt).toContain('[END_CONVERSATION_SUMMARY]');
  });
});
