import { create } from 'zustand';

interface UIState {
  activeSheet: 'none' | 'gift' | 'character_profile' | 'paywall';
  sheetContext: Record<string, unknown> | null;
  isOfflineBannerVisible: boolean;
  openSheet: (
    sheet: 'gift' | 'character_profile' | 'paywall',
    context?: Record<string, unknown>,
  ) => void;
  closeSheet: () => void;
  setOfflineBanner: (visible: boolean) => void;
}

export const useUIStore = create<UIState>(set => ({
  activeSheet: 'none',
  sheetContext: null,
  isOfflineBannerVisible: false,

  openSheet: (sheet, context) => set({ activeSheet: sheet, sheetContext: context || null }),
  closeSheet: () => set({ activeSheet: 'none', sheetContext: null }),
  setOfflineBanner: visible => set({ isOfflineBannerVisible: visible }),
}));
