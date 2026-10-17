import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A real gradient from clear to dark, laid over the bottom of a photo so text on it stays readable while the
 * photo shows through (instead of a flat grey band). Never takes touches.
 */
export const BottomFade: React.FC<{ height: number; color?: string; strength?: number }> = ({ height, color = '#0A0412', strength = 0.92 }) => (
  <View pointerEvents="none" style={[styles.wrap, { height }]}>
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="0.45" stopColor={color} stopOpacity={strength * 0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={strength} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
