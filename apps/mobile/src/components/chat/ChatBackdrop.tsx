import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A barely-there glow behind the chat (top-right violet, bottom-left pink) so it isn't a flat black page.
 * Soft edges come from a few stacked, nearly transparent circles — no gradient library, no extra work per frame.
 */
const Glow: React.FC<{ color: string; size: number; style: object }> = ({ color, size, style }) => (
  <View style={[styles.glow, style]} pointerEvents="none">
    {/* Many faint rings, each a little smaller, so the edge fades instead of showing bands. */}
    {Array.from({ length: 14 }, (_, i) => 1 - i * 0.065).map((k) => (
      <View
        key={k}
        style={{
          position: 'absolute',
          width: size * k,
          height: size * k,
          borderRadius: (size * k) / 2,
          backgroundColor: color,
          opacity: 0.012,
          left: (size - size * k) / 2,
          top: (size - size * k) / 2,
        }}
      />
    ))}
  </View>
);

export const ChatBackdrop: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Glow color="#8B5CF6" size={520} style={{ top: -180, right: -220, width: 520, height: 520 }} />
    <Glow color="#EC4899" size={460} style={{ bottom: 40, left: -240, width: 460, height: 460 }} />
  </View>
);

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
