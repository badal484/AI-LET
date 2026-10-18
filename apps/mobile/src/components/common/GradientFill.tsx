import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * A gradient that fills its parent (put it first inside a View with overflow: 'hidden' and a borderRadius).
 * `colors` run left→right (or top→bottom with `vertical`); `radial` makes a soft glow from the top centre.
 * Never takes touches.
 */
export const GradientFill: React.FC<{
  colors: Array<string | [string, number]>;
  vertical?: boolean;
  radial?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ colors, vertical = false, radial = false, style }) => {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stops = colors.map((c, i) => {
    const [color, opacity] = Array.isArray(c) ? c : [c, 1];
    return <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={color} stopOpacity={opacity} />;
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          {radial ? (
            <RadialGradient id={id} cx="50%" cy="0%" rx="75%" ry="100%" fx="50%" fy="0%">
              {stops}
            </RadialGradient>
          ) : (
            <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0.35'}>
              {stops}
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};
