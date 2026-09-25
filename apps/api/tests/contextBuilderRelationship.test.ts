import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../src/modules/conversations/engine/contextBuilder.js';
import {
  IRelationshipContextProvider,
  RelationshipContextResult,
} from '../src/modules/conversations/interfaces/relationshipContext.interface.js';
import type { CharacterRuntimeObject } from '@ai-companion/types';

describe('Phase 6: ContextBuilder Relationship & Tone Integration', () => {
  const mockRuntime: CharacterRuntimeObject = {
    characterId: 'char-456',
    slug: 'elena',
    versionId: 'ver-456',
    versionNumber: 1,
    name: 'Elena',
    status: 'PUBLISHED',
    identity: {
      name: 'Elena',
      role: 'Philosopher & Mentor',
      occupation: 'Researcher',
      locationWorld: 'Oxford',
      backstory: 'A thoughtful companion.',
      interests: ['Philosophy', 'Astronomy'],
      dislikes: ['Superficiality'],
      goals: ['Explore truth'],
      values: ['Integrity'],
      personalitySummary: 'Calm and reflective',
    },
    personality: {
      traits: {
        confidence: 70,
        warmth: 80,
        playfulness: 50,
        curiosity: 85,
        sarcasm: 20,
        patience: 90,
        energy: 55,
        seriousness: 50,
        romanticism: 40,
        empathy: 85,
        assertiveness: 60,
        humor: 60,
        introversion: 50,
        agreeableness: 80,
        openness: 85,
        conscientiousness: 80,
        neuroticism: 15,
      },
      interactionRules: [],
      humorStyle: 'dry',
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
      teasingFrequency: 'never',
      emojiPolicy: 'none',
      responseDensity: 'balanced',
      directness: 'tactful',
    },
    knowledge: [],
    relationshipRules: [],
    safety: {
      contentBoundaries: [],
      topicsRequiringCaution: [],
      ageSuitability: 'ALL_AGES',
      relationshipBoundaries: [],
      selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
      disclaimerBehavior: 'CRISIS_ONLY',
      sexualContentPolicy: 'MODERATE_FILTER',
      impersonationRestrictions: [],
      identityClaimsPolicy: 'AI_CHARACTER_TRANSPARENT',
    },
    aiConfig: {
      modelClass: 'standard_chat',
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
    relationshipConfig: {
      familiaritySensitivity: 50,
      affectionExpression: 'moderate',
      trustSensitivity: 50,
      personalizationLevel: 'high',
      conversationContinuity: 'high',
      boundaryBehavior: 'gentle',
      attachmentFraming: 'adaptive_relational',
      progressionSpeed: 'standard',
    },
    memoryConfig: {
      memoryEnabled: true,
      preferredMemoryTypes: ['SEMANTIC', 'EPISODIC'],
      memoryRecallStyle: 'natural_contextual',
      personalizationStrength: 75,
      sensitiveMemoryPolicy: 'ask_permission',
      memoryConfirmationBehavior: 'on_ambiguity',
    },
    proactivityConfig: {
      enabled: false,
      allowedHoursStartUtc: 8,
      allowedHoursEndUtc: 22,
      maxDailyMessages: 2,
      minInteractionCooldownHours: 4,
      quietHoursEnabled: true,
      quietHoursStartUtc: 23,
      quietHoursEndUtc: 7,
      preferredEventTypes: [],
    },
    compiledSystemPrompt: 'You are Elena, a thoughtful AI mentor.',
    createdAt: new Date().toISOString(),
  };

  it('should inject Tier 8 [RELATIONSHIP_DYNAMIC_STATE] when relationship context is active', async () => {
    const mockRelationshipProvider: IRelationshipContextProvider = {
      async getRelationshipContext(): Promise<RelationshipContextResult> {
        return {
          relationshipState: {
            id: 'rel-1',
            userId: 'user-1',
            characterId: 'char-456',
            stage: 'CLOSE_FRIEND',
            familiarity: 65,
            trust: 70,
            comfort: 65,
            affection: 35,
            engagement: 75,
            totalInteractions: 14,
            consecutiveDaysActive: 4,
            lastInteractionAt: new Date().toISOString(),
            version: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          currentToneState: {
            tone: 'warm',
            energy: 60,
            warmth: 75,
            seriousness: 45,
            engagement: 70,
            topicSensitivity: 'normal',
            lastUpdated: new Date().toISOString(),
          },
          relationshipContextText: `- Relational Dynamic: Close Companion (14 prior interactions)
- Interpersonal Context: Deep trust and mutual comfort. Communication is warm and authentic.
- Conversational Affect: Warm, appreciative, and affectionate
- Relational Boundaries: Respectful, non-coercive, autonomous. NEVER employ manipulative guilt or possessiveness.`,
          isPersonalizationActive: true,
        };
      },
    };

    const builtContext = await ContextBuilder.buildModelContext({
      characterRuntime: mockRuntime,
      recentMessages: [
        { role: 'user', content: 'Good morning Elena!' },
        { role: 'assistant', content: 'Good morning! How did your study session go yesterday?' },
      ],
      currentUserMessage: 'It went really well, thanks to your notes.',
      userContext: {
        userId: 'user-1',
        userName: 'Alex',
      },
      conversationId: 'conv-123',
      relationshipProvider: mockRelationshipProvider,
    });

    expect(builtContext.systemPrompt).toContain('[RELATIONSHIP_DYNAMIC_STATE]');
    expect(builtContext.systemPrompt).toContain('Relational Dynamic: Close Companion');
    expect(builtContext.systemPrompt).toContain('Conversational Affect: Warm');
    expect(builtContext.systemPrompt).toContain('Relational Boundaries: Respectful, non-coercive, autonomous');
    expect(builtContext.activeRelationshipStage).toBe('CLOSE_FRIEND');

    // Never leak raw score numbers in system prompt
    expect(builtContext.systemPrompt).not.toContain('trust = 70');
    expect(builtContext.systemPrompt).not.toContain('familiarity = 65');
  });

  it('should omit relationship dynamic state when personalization is disabled', async () => {
    const disabledRelationshipProvider: IRelationshipContextProvider = {
      async getRelationshipContext(): Promise<RelationshipContextResult> {
        return {
          relationshipState: null,
          currentToneState: null,
          relationshipContextText: '',
          isPersonalizationActive: false,
        };
      },
    };

    const builtContext = await ContextBuilder.buildModelContext({
      characterRuntime: mockRuntime,
      recentMessages: [],
      currentUserMessage: 'Hello there',
      userContext: {
        userId: 'user-1',
        userName: 'Alex',
      },
      conversationId: 'conv-123',
      relationshipProvider: disabledRelationshipProvider,
    });

    expect(builtContext.systemPrompt).not.toContain('[RELATIONSHIP_DYNAMIC_STATE]');
    expect(builtContext.activeRelationshipStage).toBeNull();
  });
});
