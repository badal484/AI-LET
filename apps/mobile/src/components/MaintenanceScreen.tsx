import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './common/index.js';
import { useMaintenanceStore } from '../stores/maintenanceStore.js';
import { darkThemeColors, spacing } from '../theme/index.js';

/**
 * Maintenance mode, as users see it (admin console → Settings → Maintenance: title, message, emoji,
 * picture, back-by time, a button). Appears the moment the switch goes on (live update, or any request
 * the server turns away) and disappears the moment it goes off — then everything reloads quietly.
 * Nothing typed is lost: the screens underneath stay as they were.
 */

function backBy(until: string | null, now: number): string | null {
  if (!until) return null;
  const at = Date.parse(until);
  const mins = Math.round((at - now) / 60_000);
  const time = new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (mins <= 0) return 'Any minute now';
  if (mins < 60) return `Back by ${time} · about ${mins} min`;
  const h = Math.floor(mins / 60);
  return `Back by ${time} · about ${h} h${mins % 60 ? ` ${mins % 60} min` : ''}`;
}

export const MaintenanceScreen: React.FC<{ onRetry: () => Promise<void> }> = ({ onRetry }) => {
  const info = useMaintenanceStore((s) => s.info);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(false);
  const wasOn = useRef(false);

  // Countdown, and a gentle re-check every 30 s in case the live update is missed.
  useEffect(() => {
    if (!info) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const recheck = setInterval(() => void onRetry(), 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(recheck);
    };
  }, [info, onRetry]);

  // Switched off: reload everything that may have failed meanwhile.
  useEffect(() => {
    if (info) wasOn.current = true;
    else if (wasOn.current) {
      wasOn.current = false;
      void queryClient.invalidateQueries();
    }
  }, [info, queryClient]);

  const retry = async () => {
    setChecking(true);
    await onRetry().catch(() => undefined);
    setChecking(false);
  };

  const when = backBy(info?.until ?? null, now);

  return (
    <Modal visible={Boolean(info)} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        {info && (
          <View style={styles.body}>
            {info.imageUrl ? (
              <Image source={{ uri: info.imageUrl }} style={styles.image} resizeMode="cover" />
            ) : info.emoji ? (
              <Text style={styles.emoji}>{info.emoji}</Text>
            ) : null}
            <Text style={styles.title}>{info.title}</Text>
            {!!info.message && <Text style={styles.message}>{info.message}</Text>}
            {when && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{when}</Text>
              </View>
            )}
            <Text style={styles.safe}>Your chats and memories are safe.</Text>
            <View style={styles.actions}>
              <Button label={checking ? 'Checking…' : 'Try again'} variant="primary" size="lg" onPress={() => void retry()} disabled={checking} />
              {info.link && (
                <Pressable onPress={() => Linking.openURL(info.link!.url).catch(() => undefined)} style={styles.link} accessibilityRole="link">
                  <Text style={styles.linkText}>{info.link.label}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkThemeColors.background, justifyContent: 'center', paddingHorizontal: spacing.xl },
  body: { alignItems: 'center', gap: spacing.md },
  image: { width: '100%', aspectRatio: 2, borderRadius: 20, marginBottom: spacing.sm },
  emoji: { fontSize: 64, marginBottom: spacing.sm },
  title: { color: darkThemeColors.textPrimary, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  message: { color: darkThemeColors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  pill: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(236,72,153,0.15)',
  },
  pillText: { color: '#F472B6', fontSize: 14, fontWeight: '600' },
  safe: { color: darkThemeColors.textMuted, fontSize: 13, marginTop: spacing.sm },
  actions: { alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  link: { paddingVertical: spacing.sm },
  linkText: { color: '#F472B6', fontSize: 15, fontWeight: '600' },
});
