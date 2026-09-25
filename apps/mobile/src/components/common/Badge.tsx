import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';

export type BadgeVariant =
  | 'pro'
  | 'verified'
  | 'partner'
  | 'voice'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'category'
  | 'stage'
  | 'count';

export interface BadgeProps {
  label: string | number;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'category',
  size = 'md',
  icon,
  style,
}) => {
  const getBadgeStyles = () => {
    switch (variant) {
      case 'pro':
        return {
          bg: darkThemeColors.goldBg,
          text: darkThemeColors.gold,
          border: 'rgba(234, 179, 8, 0.4)',
        };
      case 'verified':
        return {
          bg: darkThemeColors.verifiedBg,
          text: darkThemeColors.verified,
          border: 'rgba(56, 189, 248, 0.4)',
        };
      case 'partner':
        return {
          bg: darkThemeColors.partnerBg,
          text: darkThemeColors.partner,
          border: 'rgba(168, 85, 247, 0.4)',
        };
      case 'voice':
        return {
          bg: darkThemeColors.voiceActiveBg,
          text: darkThemeColors.voiceActive,
          border: 'rgba(16, 185, 129, 0.4)',
        };
      case 'success':
        return {
          bg: darkThemeColors.successBg,
          text: darkThemeColors.success,
          border: 'rgba(52, 211, 153, 0.4)',
        };
      case 'warning':
        return {
          bg: darkThemeColors.warningBg,
          text: darkThemeColors.warning,
          border: 'rgba(251, 191, 36, 0.4)',
        };
      case 'danger':
        return {
          bg: darkThemeColors.dangerBg,
          text: darkThemeColors.danger,
          border: 'rgba(248, 113, 113, 0.4)',
        };
      case 'stage':
        return {
          bg: darkThemeColors.accentMuted,
          text: darkThemeColors.accent,
          border: 'rgba(157, 101, 255, 0.3)',
        };
      case 'count':
        return {
          bg: darkThemeColors.accent,
          text: '#000000',
          border: 'transparent',
        };
      case 'category':
      default:
        return {
          bg: darkThemeColors.surfaceHover,
          text: darkThemeColors.textSecondary,
          border: darkThemeColors.borderSubtle,
        };
    }
  };

  const current = getBadgeStyles();

  return (
    <View
      style={[
        styles.base,
        styles[size],
        { backgroundColor: current.bg, borderColor: current.border },
        icon ? { flexDirection: 'row', gap: 4 } : {},
        style,
      ]}
    >
      {icon}
      <Text style={[styles.text, styles[`text_${size}`], { color: current.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  md: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: {
    fontWeight: '700',
  },
  text_sm: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  text_md: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
