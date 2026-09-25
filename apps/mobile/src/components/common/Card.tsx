import React from 'react';
import { View, ViewProps, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors, spacing, radius, shadows } from '../../theme/index.js';

export interface CardProps extends ViewProps {
  variant?: 'elevated' | 'glass' | 'outlined';
  padding?: keyof typeof spacing;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  padding = 'lg',
  style,
  children,
  ...rest
}) => {
  const cardStyles: ViewStyle[] = [
    styles.base,
    styles[variant],
    { padding: spacing[padding] },
    style as ViewStyle,
  ];

  return (
    <View style={cardStyles} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: darkThemeColors.surfaceElevated,
    ...shadows.subtle,
  },
  glass: {
    backgroundColor: darkThemeColors.surfaceGlass,
    borderWidth: 1,
    borderColor: darkThemeColors.borderGlass,
    ...shadows.glass,
  },
  outlined: {
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
});
