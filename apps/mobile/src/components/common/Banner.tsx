import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { Icon, type IconName } from './Icon.js';

export interface BannerProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
}

export const Banner: React.FC<BannerProps> = ({
  type = 'info',
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
}) => {
  const getBannerTheme = (): { bg: string; border: string; text: string; icon: IconName } => {
    switch (type) {
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: darkThemeColors.danger,
          text: darkThemeColors.danger,
          icon: 'warning',
        };
      case 'warning':
        return {
          bg: 'rgba(251, 191, 36, 0.15)',
          border: darkThemeColors.warning,
          text: darkThemeColors.warning,
          icon: 'zap',
        };
      case 'success':
        return {
          bg: 'rgba(52, 211, 153, 0.15)',
          border: darkThemeColors.success,
          text: darkThemeColors.success,
          icon: 'check',
        };
      case 'info':
      default:
        return {
          bg: 'rgba(96, 165, 250, 0.15)',
          border: darkThemeColors.info,
          text: darkThemeColors.info,
          icon: 'sparkles',
        };
    }
  };

  const theme = getBannerTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, borderColor: theme.border },
        style,
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.iconWrapper}>
        <Icon name={theme.icon} size={15} color={theme.text} />
      </View>
      <Text style={[styles.message, { color: theme.text }]}>{message}</Text>

      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: theme.text }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}

      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissBtn}
          accessibilityLabel="Dismiss banner"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={13} color={theme.text} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  iconWrapper: {
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionBtn: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'currentColor',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dismissBtn: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
