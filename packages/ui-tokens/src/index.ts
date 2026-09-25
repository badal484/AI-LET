export const palette = {
  // Deep space dark neutral tokens
  neutral950: '#07090E',
  neutral900: '#0D1117',
  neutral850: '#161B22',
  neutral800: '#21262D',
  neutral700: '#30363D',
  neutral600: '#484F58',
  neutral400: '#8B949E',
  neutral200: '#C9D1D9',
  neutral100: '#F0F6FC',
  neutral0: '#FFFFFF',

  // Curated editorial brand accents (Rose Quartz / Violet / Indigo)
  accentPrimary: '#9D65FF',
  accentPrimaryLight: '#B88BFF',
  accentPrimaryDark: '#793CEE',
  accentSecondary: '#F472B6',
  accentTertiary: '#38BDF8',

  // Semantic Status Tokens
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  // Glassmorphism overlays
  glassLight: 'rgba(255, 255, 255, 0.08)',
  glassMedium: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassDark: 'rgba(13, 17, 23, 0.75)',
};

export const colors = {
  background: palette.neutral950,
  backgroundSecondary: palette.neutral900,
  surface: palette.neutral900,
  surfaceElevated: palette.neutral850,
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
  accentText: palette.neutral0,

  success: palette.success,
  warning: palette.warning,
  danger: palette.error,
  info: palette.info,
};

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    display: 'Outfit, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  fontSize: {
    displayLarge: 32,
    displayMedium: 26,
    headlineLarge: 20,
    headlineMedium: 17,
    headlineSmall: 15,
    bodyLarge: 16,
    bodyMedium: 14,
    bodySmall: 12,
    labelLarge: 14,
    labelMedium: 12,
    caption: 11,
  },
  lineHeight: {
    displayLarge: 38,
    displayMedium: 32,
    headlineLarge: 26,
    headlineMedium: 22,
    headlineSmall: 20,
    bodyLarge: 24,
    bodyMedium: 20,
    bodySmall: 16,
    labelLarge: 18,
    labelMedium: 16,
    caption: 14,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const shadows = {
  none: 'none',
  subtle: '0 2px 4px rgba(0, 0, 0, 0.15)',
  medium: '0 4px 8px rgba(0, 0, 0, 0.25)',
  glass: '0 8px 16px rgba(0, 0, 0, 0.35)',
} as const;

export const zIndex = {
  deep: -1,
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  sheet: 500,
  modal: 1000,
  toast: 2000,
} as const;

export const motion = {
  duration: {
    instant: 50,
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
} as const;
