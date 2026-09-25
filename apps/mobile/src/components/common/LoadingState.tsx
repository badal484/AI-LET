import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

export interface LoadingStateProps {
  message?: string;
  timeoutMs?: number;
  onTimeoutRetry?: () => void;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  timeoutMs = 12000,
  onTimeoutRetry,
  style,
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!timeoutMs) return;
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={darkThemeColors.accent} />
      <Text style={styles.message}>{message}</Text>

      {isTimedOut && (
        <View style={styles.timeoutBox}>
          <Text style={styles.timeoutText}>Taking longer than usual...</Text>
          {onTimeoutRetry && (
            <Button
              label="Reload"
              size="sm"
              variant="secondary"
              onPress={() => {
                setIsTimedOut(false);
                onTimeoutRetry();
              }}
              style={styles.retryBtn}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  message: {
    fontSize: 14,
    color: darkThemeColors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  timeoutBox: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  timeoutText: {
    fontSize: 12,
    color: darkThemeColors.warning,
    marginBottom: spacing.sm,
  },
  retryBtn: {
    minWidth: 100,
  },
});
