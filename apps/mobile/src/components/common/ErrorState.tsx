import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button.js';
import { Icon, type IconName } from './Icon.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

export type ErrorType =
  | 'network'
  | 'auth'
  | 'billing'
  | 'permission'
  | 'rate_limit'
  | 'ai_unavailable'
  | 'general';

export interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'general',
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
  isRetrying = false,
  secondaryLabel,
  onSecondaryAction,
  style,
}) => {
  const getDefaultContent = (): { icon: IconName; title: string; message: string } => {
    switch (type) {
      case 'network':
        return {
          icon: 'compass',
          title: 'Connection Lost',
          message:
            'Unable to reach our servers. Please check your internet connection and try again.',
        };
      case 'auth':
        return {
          icon: 'lock',
          title: 'Session Expired',
          message: 'Your login session has expired. Please sign in again to continue.',
        };
      case 'billing':
        return {
          icon: 'star',
          title: 'Payment Required',
          message: 'This action requires an active subscription or additional credits.',
        };
      case 'permission':
        return {
          icon: 'mic',
          title: 'Permission Needed',
          message: 'Please grant microphone or notification access in device settings to use this feature.',
        };
      case 'rate_limit':
        return {
          icon: 'warning',
          title: 'Too Many Requests',
          message: 'You have reached the temporary rate limit. Please wait a moment before trying again.',
        };
      case 'ai_unavailable':
        return {
          icon: 'sparkles',
          title: 'Companion Unavailable',
          message: 'The companion engine is temporarily busy. We are restoring connectivity.',
        };
      case 'general':
      default:
        return {
          icon: 'warning',
          title: 'Something went wrong',
          message: 'An unexpected issue occurred while processing your request.',
        };
    }
  };

  const defaults = getDefaultContent();
  const displayTitle = title || defaults.title;
  const displayMessage = message || defaults.message;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon name={defaults.icon} size={28} color={darkThemeColors.danger} />
      </View>

      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>

      <View style={styles.actionsContainer}>
        {onRetry && (
          <Button
            label={retryLabel}
            onPress={onRetry}
            isLoading={isRetrying}
            variant="secondary"
            size="md"
            style={styles.retryBtn}
          />
        )}

        {secondaryLabel && onSecondaryAction && (
          <Button
            label={secondaryLabel}
            onPress={onSecondaryAction}
            variant="ghost"
            size="sm"
            style={styles.secondaryBtn}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  actionsContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 240,
  },
  retryBtn: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  secondaryBtn: {
    marginTop: spacing.xs,
  },
});
