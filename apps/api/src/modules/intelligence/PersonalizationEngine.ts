import {
  UserPersonalizationProfile,
  UserExplicitPreferences,
  UserInferredPreferenceItem,
  UserContextSnapshot,
  PersonalizationResetScope,
} from '@ai-companion/types';
import { INTELLIGENCE_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../shared/utils/logger.js';

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;

  // In-memory persistent cache for user personalization profiles
  private readonly profiles: Map<string, UserPersonalizationProfile> = new Map();

  private constructor() {}

  public static getInstance(): PersonalizationEngine {
    if (!PersonalizationEngine.instance) {
      PersonalizationEngine.instance = new PersonalizationEngine();
    }
    return PersonalizationEngine.instance;
  }

  /**
   * Retrieves or initializes a user's personalization profile
   */
  public getProfile(userId: string): UserPersonalizationProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        isPersonalizationEnabled: true,
        explicitPreferences: {
          primaryLanguage: 'en',
          responseLength: 'balanced',
          topicsOfInterest: [],
          interactionStyle: 'friendly',
          favoriteCategories: [],
        },
        inferredPreferences: [],
        updatedAt: new Date().toISOString(),
      };
      this.profiles.set(userId, profile);
    }
    return this.applyDecay(profile);
  }

  /**
   * Updates explicit user preferences (highest priority user layer)
   */
  public updateExplicitPreferences(
    userId: string,
    preferences: Partial<UserExplicitPreferences>,
    isPersonalizationEnabled?: boolean
  ): UserPersonalizationProfile {
    const profile = this.getProfile(userId);

    if (isPersonalizationEnabled !== undefined) {
      profile.isPersonalizationEnabled = isPersonalizationEnabled;
    }

    if (preferences) {
      profile.explicitPreferences = {
        ...profile.explicitPreferences,
        ...preferences,
      };
    }

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    logger.info(`Updated explicit personalization preferences for user ${userId}`);
    return profile;
  }

  /**
   * Reinforces or registers an inferred behavioral preference.
   * Only stored if confidence >= MIN_CONFIDENCE_THRESHOLD (0.60).
   */
  public reinforceInferredPreference(
    userId: string,
    key: string,
    value: string,
    source: string,
    confidence: number = 0.70
  ): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    if (!profile.isPersonalizationEnabled) return profile;

    if (confidence < INTELLIGENCE_CONSTANTS.PERSONALIZATION.MIN_CONFIDENCE_THRESHOLD) {
      return profile;
    }

    const existingIndex = profile.inferredPreferences.findIndex((p) => p.key.toLowerCase() === key.toLowerCase());
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = profile.inferredPreferences[existingIndex]!;
      // Reinforce confidence asymptotically towards 1.0
      existing.confidence = Math.min(1.0, existing.confidence * 0.85 + confidence * 0.15);
      existing.value = value;
      existing.lastReinforcedAt = now;
      existing.lastObservedAt = now;
    } else {
      const newItem: UserInferredPreferenceItem = {
        key,
        value,
        confidence,
        source,
        lastObservedAt: now,
        lastReinforcedAt: now,
        decayHalfLifeDays: INTELLIGENCE_CONSTANTS.PERSONALIZATION.DEFAULT_DECAY_HALF_LIFE_DAYS,
      };
      profile.inferredPreferences.push(newItem);
    }

    profile.updatedAt = now;
    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Applies half-life decay to inferred preferences.
   * Inferred preferences that fall below 0.35 confidence are pruned.
   */
  private applyDecay(profile: UserPersonalizationProfile): UserPersonalizationProfile {
    const nowMs = Date.now();
    const halfLifeDays = INTELLIGENCE_CONSTANTS.PERSONALIZATION.DEFAULT_DECAY_HALF_LIFE_DAYS;

    profile.inferredPreferences = profile.inferredPreferences
      .map((pref) => {
        const lastReinforcedMs = new Date(pref.lastReinforcedAt).getTime();
        const daysElapsed = Math.max(0, (nowMs - lastReinforcedMs) / (1000 * 60 * 60 * 24));
        // Exponential decay: C(t) = C0 * 0.5^(t / halfLife)
        const decayedConfidence = pref.confidence * Math.pow(0.5, daysElapsed / halfLifeDays);
        return {
          ...pref,
          confidence: Math.round(decayedConfidence * 100) / 100,
        };
      })
      .filter((pref) => pref.confidence >= 0.35);

    return profile;
  }

  /**
   * Resets personalization according to user request
   */
  public resetPersonalization(userId: string, scope: PersonalizationResetScope = 'inferred_only'): UserPersonalizationProfile {
    const profile = this.getProfile(userId);

    if (scope === 'all') {
      profile.explicitPreferences = {
        primaryLanguage: 'en',
        responseLength: 'balanced',
        topicsOfInterest: [],
        interactionStyle: 'friendly',
        favoriteCategories: [],
      };
      profile.inferredPreferences = [];
    } else {
      profile.inferredPreferences = [];
    }

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    logger.info(`Reset personalization for user ${userId} with scope '${scope}'`);
    return profile;
  }

  /**
   * Builds the structured personalization directive for prompt composition.
   * Enforces Precedence Hierarchy:
   * Safety > System > Character Identity > Character Personality > Explicit User Preference > Inferred Preference
   */
  public buildPromptDirective(
    userId: string,
    characterName: string,
    characterRole: string
  ): { directive: string; snapshot: UserContextSnapshot } {
    const profile = this.getProfile(userId);

    if (!profile.isPersonalizationEnabled) {
      return {
        directive: '',
        snapshot: {
          userId,
          language: 'en',
          responseLength: 'balanced',
          explicitPreferences: {},
          activeInferredPreferences: [],
          retrievedMemoryIds: [],
          tokenBudgetUsed: { personalization: 0 },
        },
      };
    }

    const explicit = profile.explicitPreferences;
    const activeInferred = profile.inferredPreferences
      .filter((p) => p.confidence >= INTELLIGENCE_CONSTANTS.PERSONALIZATION.MIN_CONFIDENCE_THRESHOLD)
      .slice(0, INTELLIGENCE_CONSTANTS.PERSONALIZATION.MAX_INFERRED_PREFERENCES_IN_CONTEXT);

    const directiveLines: string[] = [
      '### PERSONALIZATION DIRECTIVES (USER PREFERENCE LAYER)',
      `[Hierarchy Notice]: Your core persona as "${characterName}" (${characterRole}) and platform safety policies ALWAYS supersede user style preferences. Do NOT compromise your core identity or role.`,
    ];

    // Explicit style instructions
    if (explicit.responseLength === 'concise') {
      directiveLines.push('- User prefers concise, direct responses. Keep answers compact without losing warmth.');
    } else if (explicit.responseLength === 'detailed') {
      directiveLines.push('- User enjoys rich, descriptive, and detailed responses.');
    }

    if (explicit.primaryLanguage && explicit.primaryLanguage !== 'en') {
      directiveLines.push(`- Preferred conversation language: ${explicit.primaryLanguage}.`);
    }

    if (explicit.interactionStyle) {
      directiveLines.push(`- Preferred interaction tone: ${explicit.interactionStyle}.`);
    }

    if (explicit.customStyleNotes) {
      directiveLines.push(`- Explicit user styling note: ${explicit.customStyleNotes}.`);
    }

    // Inferred preferences as gentle nudges
    if (activeInferred.length > 0) {
      directiveLines.push('[Behavioral Context Hints]:');
      for (const inf of activeInferred) {
        directiveLines.push(`- ${inf.key}: ${inf.value} (Confidence: ${Math.round(inf.confidence * 100)}%)`);
      }
    }

    const directive = directiveLines.join('\n');

    const snapshot: UserContextSnapshot = {
      userId,
      language: explicit.primaryLanguage || 'en',
      responseLength: explicit.responseLength || 'balanced',
      explicitPreferences: explicit,
      activeInferredPreferences: activeInferred.map((p) => ({ key: p.key, value: p.value, confidence: p.confidence })),
      retrievedMemoryIds: [],
      tokenBudgetUsed: { personalization: Math.ceil(directive.length / 4) },
    };

    return { directive, snapshot };
  }
}
