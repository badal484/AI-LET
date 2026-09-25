import { motion as baseMotion } from '@ai-companion/ui-tokens';

export const motionPresets = {
  timing: {
    instant: { duration: baseMotion.duration.instant },
    fast: { duration: baseMotion.duration.fast },
    normal: { duration: baseMotion.duration.normal },
    slow: { duration: baseMotion.duration.slow },
  },
  spring: {
    snappy: { damping: 18, stiffness: 220, mass: 0.8 },
    bouncy: { damping: 12, stiffness: 180, mass: 1 },
    gentle: { damping: 24, stiffness: 140, mass: 1.2 },
  },
  curves: baseMotion.easing,
};
