import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { prefersReducedMotion, tapFeedback } from '../../utils/motion.js';
import { GradientFill } from './GradientFill.js';
import { Icon } from './Icon.js';

/**
 * Loveek's own dialog, instead of Android's grey system alert: the app's dark card, a clear title, a filled main
 * button, a quiet Cancel and a red button for destructive actions ("Forget me", "Delete account").
 * Same call as React Native's Alert, so any `Alert.alert(title, message, buttons)` becomes `AppAlert.alert(...)`.
 * <DialogHost /> is mounted once at the app root.
 */

export interface AppAlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}
interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}
interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
}

let nextId = 1;
const queue: DialogRequest[] = [];
let notify: (() => void) | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions): void {
    queue.push({ id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], options });
    notify?.();
  },
};

/** Mounted once (App root): shows the dialogs one after another. */
export const DialogHost: React.FC = () => {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    notify = () => setCurrent((c) => c ?? queue.shift() ?? null);
    notify();
    return () => {
      notify = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    progress.setValue(prefersReducedMotion() ? 1 : 0);
    if (!prefersReducedMotion()) {
      Animated.timing(progress, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [current, progress]);

  const close = (after?: () => void) => {
    setCurrent(null);
    // Let this one leave before the button's action (which may open another dialog) and the next in line.
    setTimeout(() => {
      after?.();
      setCurrent((c) => c ?? queue.shift() ?? null);
    }, 0);
  };

  const cancelButton = current?.buttons.find((b) => b.style === 'cancel');
  const dismiss = () => {
    if (!current) return;
    if (current.options?.cancelable === false && !cancelButton) return;
    close(() => {
      cancelButton?.onPress?.();
      current.options?.onDismiss?.();
    });
  };

  useEffect(() => {
    if (!current) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  });

  if (!current) return null;
  const buttons = current.buttons;
  const stacked = buttons.length > 2 || buttons.some((b) => (b.text ?? '').length > 16);
  // Cancel first, the main action last (side by side: right; stacked: on top, so it's nearest the thumb's reach).
  const ordered = [...buttons.filter((b) => b.style === 'cancel'), ...buttons.filter((b) => b.style !== 'cancel')];
  const shown = stacked ? [...ordered].reverse() : ordered;
  const mainButton = [...buttons].reverse().find((b) => b.style !== 'cancel' && b.style !== 'destructive');
  const kindOf = (b: AppAlertButton): 'main' | 'danger' | 'quiet' =>
    b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'quiet' : b === mainButton ? 'main' : 'quiet';
  // A risky choice (delete, forget) gets a red warning badge and glow; everything else the app's purple.
  const risky = buttons.some((b) => b.style === 'destructive');

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close" />
        <Animated.View
          style={[styles.card, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <GradientFill radial colors={risky ? [['#E5484D', 0.22], ['#E5484D', 0.04], ['#1A1428', 0]] : [['#A855F7', 0.28], ['#EC4899', 0.06], ['#1A1428', 0]]} />
          <View style={[styles.badge, risky ? styles.badgeRisky : styles.badgeCalm]}>
            <Icon name={risky ? 'warning' : 'sparkles'} size={22} color={risky ? '#FCA5A5' : '#E9D5FF'} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {shown.map((b, i) => {
              const finalKind = kindOf(b);
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => {
                    tapFeedback();
                    close(() => b.onPress?.());
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonFlex,
                    finalKind === 'main' && styles.main,
                    finalKind === 'danger' && styles.danger,
                    finalKind === 'quiet' && styles.quiet,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {finalKind === 'main' && <GradientFill colors={['#7C3AED', '#DB2777']} />}
                  {finalKind === 'danger' && <GradientFill colors={['#EF4444', '#BE185D']} />}
                  <Text style={[styles.buttonText, finalKind === 'quiet' && styles.quietText]} numberOfLines={2}>
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,2,10,0.66)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1A1428',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  badge: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1 },
  badgeCalm: { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(216,180,254,0.35)' },
  badgeRisky: { backgroundColor: 'rgba(239,68,68,0.16)', borderColor: 'rgba(252,165,165,0.35)' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  message: { color: '#C9C2D9', fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  buttonsStacked: { flexDirection: 'column' },
  button: { minHeight: 50, borderRadius: 16, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonFlex: { flex: 1 },
  main: { backgroundColor: '#8B5CF6' },
  danger: { backgroundColor: '#E5484D' },
  quiet: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  quietText: { color: '#E6E0F2' },
});
