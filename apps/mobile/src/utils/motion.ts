import { useEffect, useState } from 'react';
import { AccessibilityInfo, Vibration } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore.js';

/**
 * Motion and touch feedback, shared by the whole app.
 * - Animations respect Android's "Remove animations" setting (motion sensitivity, accessibility).
 * - Haptics respect the app's own setting, and are tiny (a tap, not a buzz).
 */

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduceMotion = v));

/** True when the phone asks for no animations. */
export const prefersReducedMotion = (): boolean => reduceMotion;

export function useReduceMotion(): boolean {
  const [value, setValue] = useState(reduceMotion);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setValue);
    AccessibilityInfo.isReduceMotionEnabled().then(setValue).catch(() => undefined);
    return () => sub.remove();
  }, []);
  return value;
}

/** A light tap you feel when sending, sending a gift, or switching tabs. */
export function tapFeedback(kind: 'light' | 'medium' = 'light'): void {
  if (!useSettingsStore.getState().hapticFeedbackEnabled) return;
  try {
    Vibration.vibrate(kind === 'light' ? 8 : 18);
  } catch {
    // Some devices have no vibrator.
  }
}
