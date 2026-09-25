import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { darkThemeColors, radius, spacing } from '../../theme/index.js';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  circle?: boolean;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> & {
  Avatar: React.FC<{ size?: number }>;
  Line: React.FC<{ width?: DimensionValue; height?: number; style?: ViewStyle }>;
  Card: React.FC<{ height?: number; style?: ViewStyle }>;
} = ({ width = '100%', height = 16, borderRadius = radius.sm, circle = false, style }) => {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [opacityAnim]);

  const computedRadius = circle
    ? typeof height === 'number'
      ? height / 2
      : 24
    : borderRadius;

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: computedRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

Skeleton.Avatar = ({ size = 48 }) => (
  <Skeleton width={size} height={size} circle borderRadius={size / 2} />
);

Skeleton.Line = ({ width = '100%', height = 14, style }) => (
  <Skeleton width={width} height={height} borderRadius={radius.xs} style={style} />
);

Skeleton.Card = ({ height = 120, style }) => (
  <View style={[styles.cardContainer, { minHeight: height }, style]}>
    <Skeleton.Avatar size={48} />
    <View style={styles.cardLines}>
      <Skeleton.Line width="65%" height={16} style={{ marginBottom: spacing.xs }} />
      <Skeleton.Line width="90%" height={12} style={{ marginBottom: spacing.xs }} />
      <Skeleton.Line width="40%" height={10} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  base: {
    backgroundColor: darkThemeColors.surfaceElevated,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.md,
  },
  cardLines: {
    flex: 1,
    marginLeft: spacing.md,
  },
});
