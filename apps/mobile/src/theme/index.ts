import { darkThemeColors } from './colors.js';
import { typography } from './typography.js';
import { spacing } from './spacing.js';
import { radius } from './radius.js';
import { shadows } from './shadows.js';
import { motionPresets } from './motion.js';

export const theme = {
  colors: darkThemeColors,
  typography,
  spacing,
  radius,
  shadows,
  motion: motionPresets,
};

export type Theme = typeof theme;
export * from './colors.js';
export * from './typography.js';
export * from './spacing.js';
export * from './radius.js';
export * from './shadows.js';
export * from './motion.js';
