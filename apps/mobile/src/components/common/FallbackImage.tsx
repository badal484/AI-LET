import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { GradientFill } from './GradientFill.js';

/**
 * A photo that never leaves an empty box: tries each URL in order (cover → avatar), and if none loads, shows a
 * soft gradient with the person's initial. Used on character cards, where a missing photo looked broken.
 */
export const FallbackImage: React.FC<{
  uris: Array<string | null | undefined>;
  name: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  blurRadius?: number;
  fadeDuration?: number;
  initialSize?: number;
}> = ({ uris, name, style, resizeMode = 'cover', blurRadius, fadeDuration, initialSize = 44 }) => {
  const list = uris.filter((u, i, all): u is string => Boolean(u) && all.indexOf(u) === i);
  const key = list.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [key]);

  const uri = list[index];
  if (!uri) {
    return (
      <View style={[style as never, styles.fallback]} accessibilityLabel={name}>
        <GradientFill colors={['#3B1D6E', '#5B1A47']} vertical />
        <Text style={[styles.initial, { fontSize: initialSize }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      blurRadius={blurRadius}
      fadeDuration={fadeDuration}
      onError={() => setIndex((i) => i + 1)}
    />
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
});
