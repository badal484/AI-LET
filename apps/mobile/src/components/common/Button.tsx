import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Text,
  View,
} from 'react-native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';

export interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'gold' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  accessibilityLabel,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[size],
    styles[variant],
    fullWidth ? styles.fullWidth : {},
    isDisabled ? styles.disabled : {},
    style as ViewStyle,
  ];

  const getTextColor = () => {
    if (variant === 'primary') return darkThemeColors.accentText;
    if (variant === 'danger') return '#FFFFFF';
    if (variant === 'ghost') return darkThemeColors.accent;
    if (variant === 'outline') return darkThemeColors.accent;
    if (variant === 'gold') return '#000000';
    return darkThemeColors.textPrimary;
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.labelText,
              styles[`label_${size}`],
              { color: getTextColor() },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    minHeight: 44, // WCAG minimum touch target
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  labelText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  label_sm: {
    fontSize: 12,
    lineHeight: 16,
  },
  label_md: {
    fontSize: 14,
    lineHeight: 18,
  },
  label_lg: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  sm: {
    minHeight: 36,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: 44,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    minHeight: 52,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
  },
  primary: {
    backgroundColor: darkThemeColors.accent,
  },
  secondary: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: darkThemeColors.accent,
  },
  glass: {
    backgroundColor: darkThemeColors.surfaceGlass,
    borderWidth: 1,
    borderColor: darkThemeColors.borderGlass,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: darkThemeColors.danger,
  },
  gold: {
    backgroundColor: darkThemeColors.gold,
  },
  disabled: {
    opacity: 0.45,
  },
});
