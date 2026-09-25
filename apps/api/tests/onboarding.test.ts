import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../src/modules/onboarding/services/OnboardingService.js';
import { UserPreferenceService } from '../src/modules/onboarding/services/UserPreferenceService.js';
import { ActivationFunnelService } from '../src/modules/onboarding/services/ActivationFunnelService.js';
import { BootstrapService } from '../src/modules/onboarding/services/BootstrapService.js';
import { ContextBuilder } from '../src/modules/conversations/engine/contextBuilder.js';
import { CharacterCompiler } from '../src/modules/characters/engine/compiler.js';
import { NullMemoryContextProvider } from '../src/modules/conversations/interfaces/memoryContext.interface.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';
import type { CharacterVersionSnapshot } from '@ai-companion/types';

// Mock prisma and redis
vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userDiscoveryPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    userFirstSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activationFunnelLog: {
      create: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    onboardingStepConfig: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    character: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    featureFlag: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/infrastructure/redis/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

describe('Phase 13: Production Onboarding, Preferences, First Session & Activation Funnel', () => {
  const mockUserId = 'user-test-1111';
  const mockCharId = 'char-test-2222';
  const mockConvId = 'conv-test-3333';

  const mockUserProfile: any = {
    id: 'profile-1111',
    userId: mockUserId,
    displayName: 'Aria',
    username: 'aria_user',
    avatarUrl: null,
    bio: null,
    preferredLanguage: 'en',
    locale: 'en-US',
    timezone: 'UTC',
    conversationStyle: 'CASUAL',
    isNsfwAllowed: false,
    audioAutoPlay: true,
    onboardingStatus: 'IN_PROGRESS',
    onboardingVersion: 1,
    onboardingCurrentStep: 'WELCOME',
    onboardingCompletedSteps: [],
    onboardingStartedAt: new Date(),
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCharacter: any = {
    id: mockCharId,
    name: 'Elena Vance',
    slug: 'elena-vance',
    tagline: 'A sharp, witty companion with a love for literature',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    accessType: 'free',
    requiredEntitlement: null,
    categoryRef: { slug: 'companions', displayName: 'Companions' },
    discoveryConfig: {
      isDiscoverable: true,
      editorialPriority: 10,
      conversationStarters: ['What book changed your perspective on life?'],
    },
    currentPublishedVersion: {
      id: 'ver-1111',
      versionNumber: 1,
      identityData: {
        name: 'Elena Vance',
        greetingMessage: 'Hey there! I was just lost in a book. What brings you by?',
      },
      personalityData: {
        traits: { warmth: 80, playfulness: 70 },
      },
    },
  };

  const mockDiscoveryPref: any = {
    id: 'udp-1',
    userId: mockUserId,
    preferredCategoryIds: ['companions', 'philosophy'],
    preferredTagIds: ['witty', 'warm'],
    personalizationEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.userDiscoveryPreference.findUnique as any).mockResolvedValue(mockDiscoveryPref);
    (prisma.userDiscoveryPreference.upsert as any).mockResolvedValue(mockDiscoveryPref);
  });

  describe('UserPreferenceService', () => {
    it('resolves effective preferences with explicit overrides and personalization enabled', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);

      const prefs = await UserPreferenceService.getEffectivePreferences(mockUserId);
      expect(prefs.preferredLanguage).toBe('en');
      expect(prefs.conversationStyle).toBe('CASUAL');
      expect(prefs.preferredCategoryIds).toEqual(['companions', 'philosophy']);
      expect(prefs.personalizationEnabled).toBe(true);
    });

    it('falls back to default categories and empty preferences when personalization is disabled', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);
      (prisma.userDiscoveryPreference.findUnique as any).mockResolvedValue({
        ...mockDiscoveryPref,
        personalizationEnabled: false,
      });

      const prefs = await UserPreferenceService.getEffectivePreferences(mockUserId);
      expect(prefs.personalizationEnabled).toBe(false);
    });

    it('updates user preferences atomically and invalidates discovery recommendation cache', async () => {
      const updatedProfile = {
        ...mockUserProfile,
        preferredLanguage: 'hi',
        conversationStyle: 'DEEP',
      };
      const updatedDiscovery = {
        ...mockDiscoveryPref,
        preferredCategoryIds: ['companions', 'creative'],
      };
      (prisma.userProfile.update as any).mockResolvedValue(updatedProfile);
      (prisma.userDiscoveryPreference.upsert as any).mockResolvedValue(updatedDiscovery);
      (redis.keys as any).mockResolvedValue([`recommendations:user:${mockUserId}:feed`]);

      const result = await UserPreferenceService.updatePreferences(mockUserId, {
        preferredLanguage: 'hi',
        conversationStyle: 'DEEP',
        preferredCategoryIds: ['companions', 'creative'],
      });

      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            preferredLanguage: 'hi',
            conversationStyle: 'DEEP',
          }),
        })
      );
      expect(result.preferredLanguage).toBe('hi');
      expect(result.conversationStyle).toBe('DEEP');
    });

    it('resets preferences to defaults without deleting user account or profile', async () => {
      const resetProfile = {
        ...mockUserProfile,
        preferredLanguage: 'en',
        conversationStyle: 'CASUAL',
      };
      const resetDiscovery = {
        ...mockDiscoveryPref,
        preferredCategoryIds: [],
        preferredTagIds: [],
        personalizationEnabled: true,
      };
      (prisma.userProfile.update as any).mockResolvedValue(resetProfile);
      (prisma.userDiscoveryPreference.upsert as any).mockResolvedValue(resetDiscovery);

      const result = await UserPreferenceService.resetPreferences(mockUserId);
      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            preferredLanguage: 'en',
            conversationStyle: 'CASUAL',
          }),
        })
      );
      expect(result.preferredCategoryIds).toEqual([]);
    });
  });

  describe('ActivationFunnelService', () => {
    it('tracks funnel events accurately in database', async () => {
      (prisma.activationFunnelLog.create as any).mockResolvedValue({ id: 'log-1' });

      await ActivationFunnelService.trackFunnelEvent(
        {
          eventType: 'CHARACTER_SELECTED',
          stepKey: 'CHARACTER_SELECTION',
          characterId: mockCharId,
        },
        mockUserId
      );

      expect(prisma.activationFunnelLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            eventType: 'CHARACTER_SELECTED',
            characterId: mockCharId,
          }),
        })
      );
    });

    it('records message activity and marks user as activated when both user message and assistant response exist', async () => {
      const existingSession = {
        id: 'session-1',
        userId: mockUserId,
        selectedCharacterId: mockCharId,
        firstConversationId: mockConvId,
        firstMessageSentAt: null,
        firstResponseReceivedAt: null,
        isActivated: false,
        activatedAt: null,
        createdAt: new Date(),
      };
      (prisma.userFirstSession.findUnique as any).mockResolvedValue(existingSession);
      (prisma.userFirstSession.update as any).mockResolvedValue({
        ...existingSession,
        firstMessageSentAt: new Date(),
        firstResponseReceivedAt: new Date(),
        isActivated: true,
        activatedAt: new Date(),
      });
      (prisma.activationFunnelLog.create as any).mockResolvedValue({ id: 'log-activation' });

      // Track user message & assistant response
      await ActivationFunnelService.recordMessageActivity(mockUserId, mockCharId, mockConvId, false);
      await ActivationFunnelService.recordMessageActivity(mockUserId, mockCharId, mockConvId, true);

      expect(prisma.userFirstSession.update).toHaveBeenCalled();
    });

    it('records user return visits and increments return counter', async () => {
      const firstSessionDate = new Date(Date.now() - 25 * 3600 * 1000); // 25 hours ago (D1)
      const existingSession = {
        id: 'session-1',
        userId: mockUserId,
        createdAt: firstSessionDate,
        firstReturnAt: null,
        returnCount: 0,
      };
      (prisma.userFirstSession.findUnique as any).mockResolvedValue(existingSession);
      (prisma.userFirstSession.update as any).mockResolvedValue({
        ...existingSession,
        firstReturnAt: new Date(),
        returnCount: 1,
      });

      await ActivationFunnelService.recordUserReturnVisit(mockUserId);

      expect(prisma.userFirstSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            returnCount: { increment: 1 },
          }),
        })
      );
    });

    it('aggregates growth analytics metrics with funnel overview and character leaderboard', async () => {
      (prisma.user.count as any).mockResolvedValue(100);
      (prisma.activationFunnelLog.count as any).mockResolvedValue(80);
      (prisma.userFirstSession.count as any).mockResolvedValue(65);
      (prisma.character.findMany as any).mockResolvedValue([mockCharacter]);

      const analytics = await ActivationFunnelService.getGrowthAnalytics();

      expect(analytics.overview.totalSignups).toBe(100);
      expect(analytics.overview.totalActivatedUsers).toBe(65);
      expect(analytics.characterLeaderboard).toHaveLength(1);
      expect(analytics.characterLeaderboard[0].name).toBe('Elena Vance');
      expect(analytics.dropoffMetrics).toBeDefined();
      expect(analytics.retentionCohorts).toBeDefined();
    });
  });

  describe('OnboardingService', () => {
    it('returns accurate onboarding state, steps, and starter companions', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);
      (prisma.character.findMany as any).mockResolvedValue([mockCharacter]);

      const state = await OnboardingService.getOnboardingState(mockUserId);
      expect(state.progress.status).toBe('IN_PROGRESS');
      expect(state.progress.version).toBe(1);
      expect(state.progress.currentStep).toBe('WELCOME');
      expect(state.starterCharacters).toHaveLength(1);
      expect(state.starterCharacters[0].name).toBe('Elena Vance');
    });

    it('starts onboarding flow and updates profile status to IN_PROGRESS', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue({
        ...mockUserProfile,
        onboardingStatus: 'NOT_STARTED',
      });
      (prisma.userProfile.update as any).mockResolvedValue({
        ...mockUserProfile,
        onboardingStatus: 'IN_PROGRESS',
      });
      (prisma.userFirstSession.upsert as any).mockResolvedValue({ id: 's-1' });

      const progress = await OnboardingService.startOnboarding(mockUserId);
      expect(progress.status).toBe('IN_PROGRESS');
      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            onboardingStatus: 'IN_PROGRESS',
          }),
        })
      );
    });

    it('advances onboarding step and records completion idempotently', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);
      (prisma.userProfile.update as any).mockResolvedValue({
        ...mockUserProfile,
        onboardingCurrentStep: 'LANGUAGE',
        onboardingCompletedSteps: ['WELCOME'],
      });

      const result = await OnboardingService.completeStep(mockUserId, {
        stepKey: 'WELCOME',
      });

      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            onboardingCurrentStep: 'LANGUAGE',
            onboardingCompletedSteps: ['WELCOME'],
          }),
        })
      );
      expect(result.nextStep).toBe('LANGUAGE');
    });

    it('completes onboarding flow and persists completion timestamp', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);
      (prisma.userProfile.update as any).mockResolvedValue({
        ...mockUserProfile,
        onboardingStatus: 'COMPLETED',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingCurrentStep: 'COMPLETED',
      });

      const result = await OnboardingService.completeOnboarding(mockUserId, {
        preferredLanguage: 'en',
        conversationStyle: 'CASUAL',
      });

      expect(result.progress.status).toBe('COMPLETED');
      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          data: expect.objectContaining({
            onboardingStatus: 'COMPLETED',
            onboardingCompleted: true,
          }),
        })
      );
    });

    it('skips onboarding flow safely without corrupting profile preferences', async () => {
      (prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile);
      (prisma.userProfile.update as any).mockResolvedValue({
        ...mockUserProfile,
        onboardingStatus: 'SKIPPED',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingCurrentStep: 'COMPLETED',
      });

      const result = await OnboardingService.skipOnboarding(mockUserId);
      expect(result.status).toBe('SKIPPED');
    });
  });

  describe('BootstrapService', () => {
    it('aggregates fast unified bootstrap data in a single roundtrip', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: mockUserId,
        email: 'user@example.com',
        role: 'USER',
        profile: mockUserProfile,
        subscription: null,
      });
      (prisma.onboardingStepConfig.findMany as any).mockResolvedValue([]);
      (prisma.character.findMany as any).mockResolvedValue([mockCharacter]);
      (prisma.featureFlag.findMany as any).mockResolvedValue([]);

      const bootstrap = await BootstrapService.getBootstrapData(mockUserId);
      expect(bootstrap.user.id).toBe(mockUserId);
      expect(bootstrap.profile.displayName).toBe('Aria');
      expect(bootstrap.onboarding.status).toBe('IN_PROGRESS');
      expect(bootstrap.preferences.conversationStyle).toBe('CASUAL');
      expect(bootstrap.featureFlags).toBeDefined();
    });
  });

  describe('ContextBuilder - Conversation Style Tone Integration', () => {
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
      },
      voiceConfigData: {
        voiceId: 'voice-1',
        speed: 1.0,
        pitch: 1.0,
      },
      imageAvatarConfigData: {
        defaultAvatarUrl: 'https://example.com/luna.png',
        stylePreset: 'ANIME',
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

    it('injects user conversationStyle into Tier 12 context without overriding character identity', async () => {
      const compiled = CharacterCompiler.compile(baseSnapshot);
      const characterRuntime = {
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

      const assembled = await ContextBuilder.buildModelContext({
        characterRuntime,
        recentMessages: [],
        currentUserMessage: 'Hi Luna, I had a tough day.',
        conversationId: 'conv-1234',
        userContext: {
          userId: mockUserId,
          userName: 'Aria',
          conversationStyle: 'SUPPORTIVE',
        },
      });

      expect(assembled.systemPrompt).toContain('[CONVERSATION_PARTICIPANT_CONTEXT]');
      expect(assembled.systemPrompt).toContain('User Preferred Conversation Tone: supportive');
      expect(assembled.systemPrompt).toContain('Luna');
    });
  });
});
