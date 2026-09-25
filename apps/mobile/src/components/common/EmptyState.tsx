import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button.js';
import { Icon, IconName } from './Icon.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

export interface EmptyStateProps {
  icon?: IconName | string | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

const EMOJI_TO_ICON: Record<string, IconName> = {
  '💬': 'chat',
  '🔍': 'search',
  '🔔': 'bell',
  '⚠️': 'warning',
  '⚠': 'warning',
  '🧠': 'sparkles',
  '🎭': 'sparkles',
  '✨': 'sparkles',
  '❤️': 'heart-filled',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'chat',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      const mapped = EMOJI_TO_ICON[icon] || (icon as IconName);
      const isKnown = [
        'bell', 'search', 'home', 'compass', 'chat', 'user', 'heart', 'heart-filled',
        'voice', 'mic', 'phone', 'close', 'arrow-left', 'arrow-up', 'send', 'settings',
        'warning', 'flag', 'sparkles', 'trash', 'check', 'plus', 'more', 'lock', 'share'
      ].includes(mapped);

      if (isKnown) {
        return <Icon name={mapped as IconName} size={28} color={darkThemeColors.accent} />;
      }
      return <Text style={styles.iconText}>{icon}</Text>;
    }
    return icon;
  };

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={styles.iconContainer}>
          {renderIcon()}
        </View>
      )}

      <Text style={styles.title}>{title}</Text>

      {description && <Text style={styles.description}>{description}</Text>}

      <View style={styles.actionsContainer}>
        {actionLabel && onAction && (
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="primary"
            size="md"
            style={styles.primaryBtn}
          />
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <Button
            label={secondaryActionLabel}
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  actionsContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 260,
  },
  primaryBtn: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  secondaryBtn: {
    marginTop: spacing.xs,
  },
});
