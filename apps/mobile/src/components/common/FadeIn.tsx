import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { prefersReducedMotion } from '../../utils/motion.js';

/**
 * Content arriving: a short fade and a 10px rise, staggered by `index` for the first rows of a list (later
 * rows, scrolled into view, appear at once). Runs once per mount on the native thread; nothing moves when
 * the phone asks for no animations.
 */
export const FadeIn: React.FC<{ index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ index = 0, style, children }) => {
  const still = prefersReducedMotion() || index > 8;
  const progress = useRef(new Animated.Value(still ? 1 : 0)).current;

  useEffect(() => {
    if (still) return;
    Animated.timing(progress, { toValue: 1, duration: 280, delay: index * 40, useNativeDriver: true }).start();
    // Only on mount: a re-render must not replay it.
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
