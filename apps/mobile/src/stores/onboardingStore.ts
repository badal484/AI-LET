import { create } from 'zustand';
import { onboardingApi } from '../services/api/onboardingApi.js';
import type {
  OnboardingStepKey,
  ConversationStyle,
  OnboardingStarterCharacterItem,
  OnboardingProgress,
} from '@ai-companion/types';

interface OnboardingState {
  currentStep: OnboardingStepKey;
  progress: OnboardingProgress | null;
  selectedLanguage: string;
  selectedCategories: string[];
  selectedStyle: ConversationStyle;
  selectedCharacterId: string | null;
  starterCharacters: OnboardingStarterCharacterItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;

  init: () => Promise<void>;
  setLanguage: (lang: string) => void;
  toggleCategory: (categoryId: string) => void;
  setStyle: (style: ConversationStyle) => void;
  selectCharacter: (charId: string) => void;
  completeCurrentStep: (stepKey: OnboardingStepKey, skipped?: boolean) => Promise<string>;
  skipAll: () => Promise<void>;
  finishOnboarding: () => Promise<{ conversationId?: string }>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 'WELCOME',
  progress: null,
  selectedLanguage: 'en',
  selectedCategories: [],
  selectedStyle: 'CASUAL',
  selectedCharacterId: null,
  starterCharacters: [],
  isLoading: false,
  isSubmitting: false,
  errorMessage: null,

  init: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const { progress, starterCharacters } = await onboardingApi.getOnboardingState();
      set({
        progress,
        currentStep: progress.currentStep || 'WELCOME',
        selectedStyle: progress.conversationStyle || 'CASUAL',
        starterCharacters,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, errorMessage: err.message || 'Failed to load onboarding state' });
    }
  },

  setLanguage: (selectedLanguage: string) => {
    set({ selectedLanguage });
  },

  toggleCategory: (categoryId: string) => {
    const current = get().selectedCategories;
    if (current.includes(categoryId)) {
      set({ selectedCategories: current.filter(id => id !== categoryId) });
    } else {
      set({ selectedCategories: [...current, categoryId] });
    }
  },

  setStyle: (selectedStyle: ConversationStyle) => {
    set({ selectedStyle });
  },

  selectCharacter: (selectedCharacterId: string) => {
    set({ selectedCharacterId });
  },

  completeCurrentStep: async (stepKey: OnboardingStepKey, skipped = false): Promise<string> => {
    const state = get();
    set({ isSubmitting: true });
    try {
      const payload: any = {
        stepKey,
        skipped,
      };

      if (stepKey === 'LANGUAGE') {
        payload.language = state.selectedLanguage;
      } else if (stepKey === 'INTERESTS') {
        payload.categoryIds = state.selectedCategories;
      } else if (stepKey === 'STYLE') {
        payload.conversationStyle = state.selectedStyle;
      } else if (stepKey === 'CHARACTER_SELECTION') {
        payload.selectedCharacterId = state.selectedCharacterId || undefined;
      }

      const result = await onboardingApi.completeStep(payload);
      set({
        progress: result.progress,
        currentStep: result.nextStep as OnboardingStepKey,
        isSubmitting: false,
      });
      return result.nextStep;
    } catch (err: any) {
      set({ isSubmitting: false, errorMessage: err.message });
      throw err;
    }
  },

  skipAll: async () => {
    set({ isSubmitting: true });
    try {
      const progress = await onboardingApi.skipOnboarding();
      set({ progress, currentStep: 'COMPLETED', isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, errorMessage: err.message });
      throw err;
    }
  },

  finishOnboarding: async (): Promise<{ conversationId?: string }> => {
    const state = get();
    set({ isSubmitting: true });
    try {
      const result = await onboardingApi.completeOnboarding({
        selectedCharacterId: state.selectedCharacterId || undefined,
        conversationStyle: state.selectedStyle,
        preferredLanguage: state.selectedLanguage,
        categoryIds: state.selectedCategories,
      });

      set({
        progress: result.progress,
        currentStep: 'COMPLETED',
        isSubmitting: false,
      });

      return { conversationId: result.conversationId };
    } catch (err: any) {
      set({ isSubmitting: false, errorMessage: err.message });
      throw err;
    }
  },
}));
