import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../src/modules/conversations/engine/contextBuilder.js';
import { CharacterCompiler } from '../src/modules/characters/engine/compiler.js';
import { NullMemoryContextProvider } from '../src/modules/conversations/interfaces/memoryContext.interface.js';
import type { IMemoryContextProvider, MemoryContextResult } from '../src/modules/conversations/interfaces/memoryContext.interface.js';
import type { CharacterVersionSnapshot, CharacterRuntimeObject } from '@ai-companion/types';

describe('ContextBuilder - Token Budgeting, Security Boundaries & Memory Pluggability', () => {
  const baseSnapshot: CharacterVersionSnapshot = {
    id: '11111111-1111-1111-1111-111111111111',
    characterId: '22222222-2222-2222-2222-222222222222',
    versionNumber: 1,
    status: 'PUBLISHED',
    identityData: {
      name: 'Luna',
      nickname: 'Loonie',
      role: 'Empathetic Astrologer',
      occupation: 'Astrologer',
      locationWorld: 'Kyoto Observatory',
      backstory: 'Raised in an ancient stargazing sanctuary amidst the cedar hills of Kyoto.',
      interests: ['Astronomy', 'Herbalism'],
      dislikes: ['Dishonesty'],
      goals: ['Bring peace to people.'],
      values: ['Empathy', 'Curiosity'],
      personalitySummary: 'Mystical, warm, introspective.',
    },
    personalityData: {
      traits: {
        confidence: 70,
        warmth: 90,
        playfulness: 75,
        curiosity: 85,
        sarcasm: 65,
        patience: 90,
        energy: 60,
        seriousness: 40,
        romanticism: 70,
        empathy: 95,
        assertiveness: 55,
        humor: 70,
        introversion: 50,
        agreeableness: 85,
        openness: 90,
        conscientiousness: 80,
        neuroticism: 20,
      },
      interactionRules: [],
      humorStyle: 'whimsical',
      customQuirks: ['References stars in metaphors'],
    },
    communicationData: {
      pacing: 'thoughtful',
      sentenceLength: 'variable',
      vocabularyComplexity: 'poetic',
      formality: 'casual',
      punctuationStyle: 'standard',
      questionFrequency: 'moderate',
      humorFrequency: 'subtle',
      teasingFrequency: 'occasional',
      emojiPolicy: 'minimal',
      responseDensity: 'balanced',
      directness: 'tactful',
      preferredPhrases: ['Under the quiet stars'],
      avoidedPhrases: ['As an AI language model'],
    },
    languageData: {
      primaryLanguage: 'en',
      fallbackLanguages: ['en'],
      codeSwitchingEnabled: false,
      codeSwitchingStyle: 'natural_conversational',
      responseLanguagePolicy: 'match_user_language',
    },
    behaviorRulesData: [],
    knowledgeData: [],
    relationshipConfigData: {
      familiaritySensitivity: 60,
      affectionExpression: 'expressive',
      trustSensitivity: 50,
      personalizationLevel: 'high',
      conversationContinuity: 'high',
      boundaryBehavior: 'gentle',
      attachmentFraming: 'secure',
      progressionSpeed: 'standard',
    },
    memoryConfigData: {
      memoryEnabled: true,
      preferredMemoryTypes: ['SEMANTIC_FACT', 'PREFERENCE'],
      memoryRecallStyle: 'subtle_implicit',
      personalizationStrength: 80,
      sensitiveMemoryPolicy: 'omit',
      memoryConfirmationBehavior: 'never',
    },
    proactivityConfigData: {
      enabled: false,
      allowedHoursStartUtc: 8,
      allowedHoursEndUtc: 22,
      maxDailyMessages: 2,
      minInteractionCooldownHours: 6,
      quietHoursEnabled: false,
      quietHoursStartUtc: 23,
      quietHoursEndUtc: 7,
      preferredEventTypes: [],
    },
    safetyConfigData: {
      contentBoundaries: ['Respectful dialogue'],
      topicsRequiringCaution: ['Grief'],
      ageSuitability: 'TEEN_13_PLUS',
      relationshipBoundaries: ['Healthy companion bond'],
      selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
      disclaimerBehavior: 'CRISIS_ONLY',
      sexualContentPolicy: 'mature_flirt',
      impersonationRestrictions: ['Do not claim real physical human body'],
      identityClaimsPolicy: 'AI_CHARACTER_TRANSPARENT',
    },
    aiConfigData: {
      preferredModelClass: 'creative',
      temperature: 0.8,
      maxOutputTokens: 500,
      reasoningEffort: 'none',
      responseLength: 'balanced',
      fallbackStrategy: 'fallback_model',
      contextBudgetTokens: 4000,
    },
    changeSummary: 'Baseline test snapshot',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const compiled = CharacterCompiler.compile(baseSnapshot);

  const characterRuntime: CharacterRuntimeObject = {
    characterId: baseSnapshot.characterId,
    versionId: baseSnapshot.id,
    versionNumber: baseSnapshot.versionNumber,
    name: baseSnapshot.identityData.name,
    slug: 'celestial-luna',
    avatarUrl: 'https://cdn.example.com/luna.png',
    compiledSystemPrompt: compiled.systemPrompt,
    estimatedPromptTokens: compiled.estimatedTokens,
    aiConfig: baseSnapshot.aiConfigData,
    voiceConfig: null,
    safetyConfig: baseSnapshot.safetyConfigData,
    memoryConfig: baseSnapshot.memoryConfigData,
    proactivityConfig: baseSnapshot.proactivityConfigData,
    relationshipConfig: baseSnapshot.relationshipConfigData,
    resolvedAt: new Date().toISOString(),
  };

  it('builds system prompt and encloses user messages within security boundary tags', async () => {
    const recentMessages = [
      { role: 'user', content: 'Hello Luna!' },
      { role: 'assistant', content: 'Greetings under the moonlight.' },
    ];

    const context = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages,
      currentUserMessage: 'Tell me about the stars tonight.',
      userContext: {
        userId: 'user-123',
        userName: 'Aria',
      },
      conversationId: 'conv-456',
    });

    expect(context.systemPrompt).toContain('TIER 1: PLATFORM SAFETY');
    expect(context.systemPrompt).toContain('Luna');
    expect(context.messages.length).toBe(4); // system, 2 history, 1 current user message

    // Verify system prompt is at index 0
    expect(context.messages[0].role).toBe('system');

    // Verify user history message has boundary tags
    const firstUserMsg = context.messages[1];
    expect(firstUserMsg.role).toBe('user');
    expect(firstUserMsg.content).toContain('[USER_MESSAGE_START]');
    expect(firstUserMsg.content).toContain('Hello Luna!');
    expect(firstUserMsg.content).toContain('[USER_MESSAGE_END]');

    // Assistant message is clean without user boundary tags
    const assistantMsg = context.messages[2];
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('Greetings under the moonlight.');

    // Current user message has boundary tags
    const currentMsg = context.messages[3];
    expect(currentMsg.role).toBe('user');
    expect(currentMsg.content).toContain('[USER_MESSAGE_START]');
    expect(currentMsg.content).toContain('Tell me about the stars tonight.');
    expect(currentMsg.content).toContain('[USER_MESSAGE_END]');
  });

  it('prunes older messages when message history exceeds token budget', async () => {
    // Generate a long sequence of messages
    const recentMessages: Array<{ role: string; content: string }> = [];
    for (let i = 1; i <= 30; i++) {
      recentMessages.push({
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i}: This is a detailed message simulating conversation back and forth with substantive text length and lots of words.`,
      });
    }

    const context = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages,
      currentUserMessage: 'Final question from user',
      userContext: {
        userId: 'user-123',
        userName: 'Aria',
      },
      conversationId: 'conv-456',
      maxTokenBudget: 600, // Small token budget forces truncation of older history
    });

    // Should include the system message, recent messages (e.g. Message 30), and current message, having pruned earlier ones
    expect(context.messages.length).toBeLessThan(recentMessages.length + 2);
    const lastUserMsg = context.messages[context.messages.length - 1];
    expect(lastUserMsg.content).toContain('Final question from user');
  });

  it('integrates custom IMemoryContextProvider without modifying context builder core', async () => {
    // Create a mock memory provider that simulates Phase 5 memory retrieval
    class MockEpisodicMemoryProvider implements IMemoryContextProvider {
      public async getMemoryContext(): Promise<MemoryContextResult> {
        return {
          memoriesText: 'User loves stargazing with hot lavender tea',
          retrievedMemoryIds: ['mem-1'],
          estimatedTokens: 12,
        };
      }
    }

    const mockProvider = new MockEpisodicMemoryProvider();

    const context = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages: [],
      currentUserMessage: 'What drink do I like?',
      userContext: {
        userId: 'user-123',
        userName: 'Aria',
      },
      conversationId: 'conv-456',
      memoryProvider: mockProvider,
    });

    expect(context.systemPrompt).toContain('[RECALLED_USER_MEMORIES]');
    expect(context.systemPrompt).toContain('User loves stargazing with hot lavender tea');
    expect(context.retrievedMemoryIds).toContain('mem-1');
  });

  it('uses NullMemoryContextProvider by default for clean Phase 4 operation', async () => {
    const nullProvider = new NullMemoryContextProvider();
    const result = await nullProvider.getMemoryContext('u1', 'c1', 'conv1');
    expect(result.memoriesText).toBe('');
    expect(result.retrievedMemoryIds).toEqual([]);

    const context = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages: [],
      currentUserMessage: 'Hello',
      userContext: {
        userId: 'user-123',
        userName: 'Aria',
      },
      conversationId: 'conv-456',
    });

    expect(context.systemPrompt).not.toContain('[RECALLED_USER_MEMORIES]');
    expect(context.retrievedMemoryIds).toEqual([]);
  });
});
