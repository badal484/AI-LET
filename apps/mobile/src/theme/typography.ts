import { TextStyle } from 'react-native';
import { typography as baseTypography } from '@ai-companion/ui-tokens';

export const typography: Record<string, TextStyle> = {
  // Display styles
  displayLarge: {
    fontSize: baseTypography.fontSize.displayLarge,
    lineHeight: baseTypography.lineHeight.displayLarge,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: baseTypography.fontSize.displayMedium,
    lineHeight: baseTypography.lineHeight.displayMedium,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  displaySmall: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Headings
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headlineLarge: {
    fontSize: baseTypography.fontSize.headlineLarge,
    lineHeight: baseTypography.lineHeight.headlineLarge,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headlineMedium: {
    fontSize: baseTypography.fontSize.headlineMedium,
    lineHeight: baseTypography.lineHeight.headlineMedium,
    fontWeight: '600',
  },
  headlineSmall: {
    fontSize: baseTypography.fontSize.headlineSmall,
    lineHeight: baseTypography.lineHeight.headlineSmall,
    fontWeight: '600',
  },

  // Titles & Subtitles
  titleLarge: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  titleSmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  subtitle1: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  subtitle2: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Body text
  bodyLarge: {
    fontSize: baseTypography.fontSize.bodyLarge,
    lineHeight: baseTypography.lineHeight.bodyLarge,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: baseTypography.fontSize.bodyMedium,
    lineHeight: baseTypography.lineHeight.bodyMedium,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: baseTypography.fontSize.bodySmall,
    lineHeight: baseTypography.lineHeight.bodySmall,
    fontWeight: '400',
  },
  body1: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  body2: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },

  // Labels & Buttons
  labelLarge: {
    fontSize: baseTypography.fontSize.labelLarge,
    lineHeight: baseTypography.lineHeight.labelLarge,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelMedium: {
    fontSize: baseTypography.fontSize.labelMedium,
    lineHeight: baseTypography.lineHeight.labelMedium,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Captions & Microcopy
  caption: {
    fontSize: baseTypography.fontSize.caption,
    lineHeight: baseTypography.lineHeight.caption,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
};

export const MAX_FONT_SIZE_MULTIPLIER = 1.35;
