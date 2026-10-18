import React, { useEffect, useState } from 'react';
import { View, Animated, Easing, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { darkThemeColors, radius, spacing } from '../../theme/index.js';
import { useReduceMotion } from '../../utils/motion.js';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  circle?: boolean;
  style?: ViewStyle;
}

/**
 * One shared sweep (0 → 1) for every bone on screen, so the light passes over them together like a single
 * sheet of shine, and only one animation runs however many bones there are.
 */
const sweep = new Animated.Value(0);
let users = 0;
let loop: Animated.CompositeAnimation | null = null;
function useSharedSweep(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (users++ === 0) {
      sweep.setValue(0);
      loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
      loop.start();
    }
    return () => {
      if (--users === 0) {
        loop?.stop();
        loop = null;
      }
    };
  }, [enabled]);
}

const SHINE = 160;

export const Skeleton: React.FC<SkeletonProps> & {
  Avatar: React.FC<{ size?: number }>;
  Line: React.FC<{ width?: DimensionValue; height?: number; style?: ViewStyle }>;
  Card: React.FC<{ height?: number; style?: ViewStyle }>;
} = ({ width = '100%', height = 16, borderRadius = radius.sm, circle = false, style }) => {
  const reduceMotion = useReduceMotion();
  const [boneWidth, setBoneWidth] = useState(0);
  useSharedSweep(!reduceMotion);

  const computedRadius = circle
    ? typeof height === 'number'
      ? height / 2
      : 24
    : borderRadius;

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SHINE, Math.max(boneWidth, 1)] });

  return (
    <View
      onLayout={(e) => setBoneWidth(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: computedRadius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduceMotion && boneWidth > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX }] }]}>
          <Svg width={SHINE} height="100%">
            <Defs>
              <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.11} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={SHINE} height="100%" fill="url(#shine)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
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
    // A touch of the app's purple, so loading bones sit in the page instead of looking grey.
    backgroundColor: '#1B1428',
    overflow: 'hidden',
  },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SHINE },
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
