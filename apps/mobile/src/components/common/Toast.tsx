import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { Icon, IconName } from './Icon.js';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

type ToastListener = (opts: ToastOptions | null) => void;
let activeToastListener: ToastListener | null = null;

export class ToastService {
  public static show(options: ToastOptions): void {
    if (activeToastListener) {
      activeToastListener(options);
    }
  }

  public static hide(): void {
    if (activeToastListener) {
      activeToastListener(null);
    }
  }

  public static subscribe(listener: ToastListener): () => void {
    activeToastListener = listener;
    return () => {
      if (activeToastListener === listener) {
        activeToastListener = null;
      }
    };
  }
}

export const Toast: React.FC = () => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = ToastService.subscribe((opts) => {
      if (opts) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setToast(opts);

        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 20,
            useNativeDriver: true,
            bounciness: 6,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        const duration = opts.duration || 3000;
        hideTimerRef.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -100,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => setToast(null));
        }, duration);
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => setToast(null));
      }
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [opacity, translateY]);

  if (!toast) return null;

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return darkThemeColors.success;
      case 'error':
        return darkThemeColors.danger;
      case 'warning':
        return darkThemeColors.warning;
      case 'info':
      default:
        return darkThemeColors.accent;
    }
  };

  const getIconName = (): IconName => {
    switch (toast.type) {
      case 'success':
        return 'check';
      case 'error':
        return 'close';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'sparkles';
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          borderColor: getBorderColor(),
          transform: [{ translateY }],
          opacity,
        } as ViewStyle,
      ]}
      accessibilityRole="alert"
    >
      <Icon name={getIconName()} size={14} color={getBorderColor()} />
      <Text style={styles.messageText}>{toast.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  messageText: {
    flex: 1,
    color: darkThemeColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
