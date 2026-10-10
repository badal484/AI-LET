import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A tappable that gently shrinks while pressed (runs on the native thread), so cards and rows feel
 * responsive the moment a finger touches them.
 */
export const PressableScale: React.FC<PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }> = ({
  style,
  scaleTo = 0.97,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};
