import { palette } from '@ai-companion/ui-tokens';

export const darkThemeColors = {
  background: palette.neutral950,
  backgroundSecondary: palette.neutral900,
  surface: palette.neutral900,
  surfaceElevated: palette.neutral850,
  surfaceSubtle: palette.neutral850,
  surfaceHover: palette.neutral800,
  surfaceGlass: palette.glassMedium,
  border: palette.neutral800,
  borderSubtle: palette.neutral850,
  borderGlass: palette.glassBorder,

  textPrimary: palette.neutral100,
  textSecondary: palette.neutral200,
  textMuted: palette.neutral400,
  textDisabled: palette.neutral600,

  accent: palette.accentPrimary,
  accentHover: palette.accentPrimaryLight,
  accentMuted: 'rgba(157, 101, 255, 0.18)',
  accentText: palette.neutral0,

  success: palette.success,
  successBg: 'rgba(52, 211, 153, 0.15)',
  warning: palette.warning,
  warningBg: 'rgba(251, 191, 36, 0.15)',
  danger: palette.error,
  dangerBg: 'rgba(248, 113, 113, 0.15)',
  info: palette.info,
  infoBg: 'rgba(96, 165, 250, 0.15)',

  gold: '#EAB308',
  goldBg: 'rgba(234, 179, 8, 0.18)',
  verified: '#38BDF8',
  verifiedBg: 'rgba(56, 189, 248, 0.18)',
  partner: '#A855F7',
  partnerBg: 'rgba(168, 85, 247, 0.18)',
  voiceActive: '#10B981',
  voiceActiveBg: 'rgba(16, 185, 129, 0.18)',
  speaking: '#4E6EE2',
  userSpeaking: '#00D084',
  overlay: 'rgba(0, 0, 0, 0.75)',
};

export const lightThemeColors: ThemeColors = {
  background: '#F8FAFC',
  backgroundSecondary: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceSubtle: '#F1F5F9',
  surfaceHover: '#E2E8F0',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  border: '#E2E8F0',
  borderSubtle: '#CBD5E1',
  borderGlass: 'rgba(0, 0, 0, 0.08)',

  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textDisabled: '#94A3B8',

  accent: palette.accentPrimary,
  accentHover: palette.accentPrimaryDark,
  accentMuted: 'rgba(157, 101, 255, 0.12)',
  accentText: '#FFFFFF',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  warning: '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#2563EB',
  infoBg: 'rgba(37, 99, 235, 0.12)',

  gold: '#D97706',
  goldBg: 'rgba(217, 119, 6, 0.12)',
  verified: '#0284C7',
  verifiedBg: 'rgba(2, 132, 199, 0.12)',
  partner: '#9333EA',
  partnerBg: 'rgba(147, 51, 234, 0.12)',
  voiceActive: '#059669',
  voiceActiveBg: 'rgba(5, 150, 105, 0.12)',
  speaking: '#3B82F6',
  userSpeaking: '#10B981',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export type ThemeColors = typeof darkThemeColors;
export { palette };
