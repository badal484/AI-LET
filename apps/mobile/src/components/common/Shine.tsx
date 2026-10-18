import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useReduceMotion } from '../../utils/motion.js';

const STREAK = 90;

/**
 * A soft light streak that crosses its parent every few seconds — for the one main button on a screen
 * (e.g. "Start for ₹1"), so the eye finds it. Put it last inside a view with overflow hidden and the
 * button's corner radius. Never takes touches; still when the phone asks for no animations or when off.
 */
export const Shine: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const on = active && !reduceMotion && width > 0;

  useEffect(() => {
    if (!on) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, x]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {on ? (
        <Animated.View
          style={[
            styles.streak,
            { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-STREAK, width] }) }, { skewX: '-20deg' }] },
          ]}
        >
          <Svg width={STREAK} height="100%">
            <Defs>
              <LinearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.32} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={STREAK} height="100%" fill="url(#streak)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  streak: { position: 'absolute', top: 0, bottom: 0, left: 0, width: STREAK },
});
