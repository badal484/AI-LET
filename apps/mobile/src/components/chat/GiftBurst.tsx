import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { prefersReducedMotion } from '../../utils/motion.js';

/**
 * A little celebration when a gift is sent: the gift and a few hearts float up from the message box and fade.
 * Drawn above the chat, never blocks touches, and skipped when the phone asks for reduced motion.
 * Change `burstKey` to play it again.
 */
const COUNT = 12;
const HEARTS = ['💖', '💕', '❤️', '💗'];

export const GiftBurst: React.FC<{ emoji: string; burstKey: number }> = ({ emoji, burstKey }) => {
  const { width, height } = Dimensions.get('window');
  const items = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        symbol: i % 3 === 0 ? emoji : HEARTS[i % HEARTS.length]!,
        x: width * (0.55 + Math.random() * 0.4),
        drift: (Math.random() - 0.5) * 120,
        rise: height * (0.35 + Math.random() * 0.3),
        size: 22 + Math.random() * 18,
        delay: i * 55,
        value: new Animated.Value(0),
      })),
    // A new set of particles for every burst.
    [burstKey, emoji, width, height],
  );
  const running = useRef(false);

  useEffect(() => {
    if (!burstKey || prefersReducedMotion()) return;
    running.current = true;
    Animated.parallel(
      items.map((it) =>
        Animated.timing(it.value, { toValue: 1, duration: 1500, delay: it.delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
    ).start(() => (running.current = false));
  }, [burstKey, items]);

  if (!burstKey) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it, i) => (
        <Animated.Text
          key={`${burstKey}-${i}`}
          style={{
            position: 'absolute',
            left: it.x,
            bottom: 90,
            fontSize: it.size,
            opacity: it.value.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [
              { translateY: it.value.interpolate({ inputRange: [0, 1], outputRange: [0, -it.rise] }) },
              { translateX: it.value.interpolate({ inputRange: [0, 1], outputRange: [0, it.drift] }) },
              { scale: it.value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.15, 0.9] }) },
            ],
          }}
        >
          {it.symbol}
        </Animated.Text>
      ))}
    </View>
  );
};
