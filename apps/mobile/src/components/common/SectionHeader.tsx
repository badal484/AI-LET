import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing } from '../../theme/index.js';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  count?: number;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  count,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleColumn}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {typeof count === 'number' && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={styles.actionButton}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleColumn: {
    flex: 1,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: darkThemeColors.surfaceHover,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: spacing.xs,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.textMuted,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  actionButton: {
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.accent,
  },
});
