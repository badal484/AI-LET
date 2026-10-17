import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../common/Icon.js';
import { tapFeedback, useReduceMotion } from '../../utils/motion.js';

/**
 * The round button next to the message box: 🎁 when the box is empty, the send arrow once they type.
 * The two swap with a quick spin-and-scale; a press squeezes it and gives a light tap you can feel.
 */
export const ComposerActionButton: React.FC<{ hasText: boolean; onSend: () => void; onGift: () => void }> = ({ hasText, onSend, onGift }) => {
  const reduceMotion = useReduceMotion();
  const mode = useRef(new Animated.Value(hasText ? 1 : 0)).current; // 0 = gift, 1 = send
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) mode.setValue(hasText ? 1 : 0);
    else Animated.spring(mode, { toValue: hasText ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 9 }).start();
  }, [hasText, mode, reduceMotion]);

  const squeeze = (to: number) => !reduceMotion && Animated.spring(press, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPressIn={() => squeeze(0.88)}
      onPressOut={() => squeeze(1)}
      onPress={() => {
        tapFeedback();
        if (hasText) onSend();
        else onGift();
      }}
      accessibilityRole="button"
      accessibilityLabel={hasText ? 'Send message' : 'Send gift'}
      hitSlop={6}
    >
      <Animated.View style={[styles.circle, { transform: [{ scale: press }] }]}>
        {/* Two layers cross-fading: the gift background behind, the send gradient colour in front. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.giftBg, { opacity: mode.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.sendBg, { opacity: mode }]} />
        <Animated.View
          style={[
            styles.icon,
            {
              opacity: mode.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ scale: mode.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }, { rotate: mode.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }],
            },
          ]}
        >
          <Text style={styles.gift}>🎁</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.icon,
            {
              opacity: mode,
              transform: [{ scale: mode.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: mode.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }],
            },
          ]}
        >
          <Icon name="arrow-up" size={22} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  giftBg: { backgroundColor: '#2A1B45', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(168,85,247,0.45)' },
  sendBg: { backgroundColor: '#8B5CF6', borderRadius: 26 },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gift: { fontSize: 24 },
});
