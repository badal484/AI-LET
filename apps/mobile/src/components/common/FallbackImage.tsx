import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { GradientFill } from './GradientFill.js';

/**
 * A photo that never leaves an empty box: tries each URL in order (cover → avatar), and if none loads, shows a
 * soft gradient with the person's initial. Uses aggressive disk caching and a smooth placeholder while loading.
 */
export const FallbackImage: React.FC<{
  uris: Array<string | null | undefined>;
  name: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  blurRadius?: number;
  fadeDuration?: number;
  initialSize?: number;
}> = ({ uris, name, style, resizeMode = 'cover', blurRadius, fadeDuration = 150, initialSize = 44 }) => {
  const list = uris.filter((u, i, all): u is string => Boolean(u) && all.indexOf(u) === i);
  const key = list.join('|');
  const [index, setIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIndex(0);
    setIsLoaded(false);
  }, [key]);

  const uri = list[index];
  if (!uri) {
    return (
      <View style={[styles.fallback, style]} accessibilityLabel={name}>
        <GradientFill colors={['#3B1D6E', '#5B1A47']} vertical />
        <Text style={[styles.initial, { fontSize: initialSize }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Subtle placeholder while image is downloading */}
      {!isLoaded && (
        <View style={StyleSheet.absoluteFill}>
          <GradientFill colors={['#1E172E', '#2B1B3D']} vertical />
        </View>
      )}
      <Image
        source={{ uri, cache: 'force-cache' }}
        style={[StyleSheet.absoluteFill, { opacity: isLoaded ? 1 : 0 }]}
        resizeMode={resizeMode}
        blurRadius={blurRadius}
        fadeDuration={fadeDuration}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setIsLoaded(false);
          setIndex((i) => i + 1);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#140F20' },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
});

