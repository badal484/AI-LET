import { api } from './client.js';
import type {
  BootstrapResponseData,
  OnboardingProgress,
  OnboardingStarterCharacterItem,
  UserPreferenceProfile,
} from '@ai-companion/types';
import type {
  OnboardingStepCompleteInput,
  OnboardingCompleteInput,
  UserPreferenceUpdateInput,
  ActivationFunnelEventInput,
} from '@ai-companion/validation';

export const onboardingApi = {
  /**
   * Fast, unified bootstrap initialization endpoint for mobile app launch.
   */
  getBootstrap: async (): Promise<BootstrapResponseData> => {
    const response = await api.get('/bootstrap');
    return response.data.data;
  },

  /**
   * Retrieves the current onboarding state and starter character options.
   */
  getOnboardingState: async (): Promise<{
    progress: OnboardingProgress;
    starterCharacters: OnboardingStarterCharacterItem[];
  }> => {
    const response = await api.get('/onboarding');
    return response.data.data;
  },

  /**
   * Starts the onboarding flow.
   */
  startOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await api.post('/onboarding/start', {});
    return response.data.data;
  },

  /**
   * Completes a single onboarding step.
   */
  completeStep: async (
    input: OnboardingStepCompleteInput,
  ): Promise<{ progress: OnboardingProgress; nextStep: string }> => {
    const response = await api.post('/onboarding/step', input);
    return response.data.data;
  },

  /**
   * Skips remaining onboarding steps.
   */
  skipOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await api.post('/onboarding/skip', {});
    return response.data.data;
  },

  /**
   * Completes onboarding and initializes the first conversation if character selected.
   */
  completeOnboarding: async (
    input: OnboardingCompleteInput,
  ): Promise<{
    progress: OnboardingProgress;
    conversationId?: string;
    character?: OnboardingStarterCharacterItem | null;
  }> => {
    const response = await api.post('/onboarding/complete', input);
    return response.data.data;
  },

  /**
   * Retrieves curated starter characters for onboarding.
   */
  getStarterCharacters: async (): Promise<OnboardingStarterCharacterItem[]> => {
    const response = await api.get('/onboarding/starters');
    return response.data.data;
  },

  /**
   * Tracks an activation funnel event.
   */
  trackEvent: async (input: ActivationFunnelEventInput): Promise<void> => {
    try {
      await api.post('/onboarding/events', input);
    } catch {
      // Background analytics fail gracefully
    }
  },

  /**
   * Retrieves explicit user preferences.
   */
  getPreferences: async (): Promise<UserPreferenceProfile> => {
    const response = await api.get('/preferences');
    return response.data.data;
  },

  /**
   * Updates explicit user preferences.
   */
  updatePreferences: async (input: UserPreferenceUpdateInput): Promise<UserPreferenceProfile> => {
    const response = await api.patch('/preferences', input);
    return response.data.data;
  },

  /**
   * Resets explicit user preferences to defaults.
   */
  resetPreferences: async (): Promise<UserPreferenceProfile> => {
    const response = await api.post('/preferences/reset', {});
    return response.data.data;
  },
};
