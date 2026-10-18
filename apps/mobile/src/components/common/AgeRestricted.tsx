import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon.js';

/**
 * Romance characters for someone under 18 (the server marks them ageRestricted): still shown, but blurred with
 * "18+ only", and they can't be opened or chatted with (the server refuses too).
 */
export const AGE_BLUR_RADIUS = 28;

export const ageRestricted = (c: { ageRestricted?: boolean } | null | undefined): boolean => Boolean(c?.ageRestricted);

export function explainAgeRestricted(name?: string): void {
  Alert.alert('18+ only', `${name ? `${name} is` : 'This character is'} for people 18 and older. Explore the other characters — friends, mentors, astrology and more.`);
}

/** Opens the character, or explains why not. */
export function openIfAllowed<T extends { ageRestricted?: boolean; name?: string }>(c: T, open: (c: T) => void): void {
  if (ageRestricted(c)) explainAgeRestricted(c.name);
  else open(c);
}

/** The "18+ only" badge laid over a blurred card. */
export const AgeRestrictedBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Icon name="lock" size={compact ? 12 : 14} color="#FFFFFF" />
      <Text style={[styles.text, compact && styles.textCompact]}>18+ only</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10,4,18,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeCompact: { paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  textCompact: { fontSize: 11 },
});
