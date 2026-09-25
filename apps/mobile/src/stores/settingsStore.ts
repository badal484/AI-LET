import { create } from 'zustand';

export type AppLocale = 'en' | 'hi' | 'hinglish';

interface SettingsState {
  themeOverride: 'system' | 'dark' | 'light';
  locale: AppLocale;
  isAudioAutoPlayEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  setThemeOverride: (theme: 'system' | 'dark' | 'light') => void;
  setAudioAutoPlay: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setLocale: (locale: AppLocale) => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  themeOverride: 'system',
  locale: 'en',
  isAudioAutoPlayEnabled: true,
  hapticFeedbackEnabled: true,

  setThemeOverride: theme => set({ themeOverride: theme }),
  setAudioAutoPlay: enabled => set({ isAudioAutoPlayEnabled: enabled }),
  setHapticFeedback: enabled => set({ hapticFeedbackEnabled: enabled }),
  setLocale: locale => set({ locale }),
}));
