import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Avatar, Button, Icon } from './common/index.js';
import { NotificationApi, type InAppCampaignMessage } from '../services/api/notificationApi.js';
import { PushService } from '../services/push/PushService.js';
import { Realtime } from '../services/realtime/RealtimeClient.js';
import { openAppLink } from '../navigation/openAppLink.js';
import type { RootStackParamList } from '../navigation/types.js';
import { darkThemeColors, radius, spacing } from '../theme/index.js';

/**
 * Admin campaigns inside the app (console → Notifications → "Popup in the app" / "Banner in the app"):
 * a popup card with a picture and buttons, or a small banner above the tab bar. Each shows until the
 * person taps a button or closes it; what they did goes back to the admin's results.
 * Fetched on sign-in, when the app comes back to the front (at most once a minute) and when a campaign
 * push arrives while the app is open.
 */

const REFRESH_MS = 60_000;

export const CampaignMessages: React.FC<{ navigationRef: NavigationContainerRefWithCurrent<RootStackParamList> }> = ({ navigationRef }) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<InAppCampaignMessage[]>([]);
  const lastFetch = useRef(0);
  const seen = useRef(new Set<string>());

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < REFRESH_MS) return;
    lastFetch.current = Date.now();
    try {
      setMessages(await NotificationApi.inAppMessages());
    } catch {
      lastFetch.current = 0; // offline: try again next time
    }
  }, []);

  useEffect(() => {
    void load(true);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
    const off = PushService.onPush((data) => data['kind'] === 'campaign' && void load(true));
    const offLive = Realtime.on((e) => e.type === 'campaign.inapp' && void load(true));
    return () => {
      sub.remove();
      off();
      offLive();
    };
  }, [load]);

  const popup = messages.find((m) => m.kind === 'popup');
  const banner = popup ? undefined : messages.find((m) => m.kind === 'banner');
  const shown = popup ?? banner;

  // Seeing it counts as opening it (once).
  useEffect(() => {
    if (shown && !seen.current.has(shown.id)) {
      seen.current.add(shown.id);
      NotificationApi.campaignAction(shown.campaignId, 'open').catch(() => undefined);
    }
  }, [shown]);

  const remove = (m: InAppCampaignMessage) => setMessages((all) => all.filter((x) => x.id !== m.id));
  const close = (m: InAppCampaignMessage) => {
    remove(m);
    NotificationApi.campaignAction(m.campaignId, 'dismiss').catch(() => undefined);
  };
  const tap = (m: InAppCampaignMessage, link: string | null) => {
    remove(m);
    NotificationApi.campaignAction(m.campaignId, 'click').catch(() => undefined);
    openAppLink(navigationRef, link);
  };

  const buttons = popup ? (popup.buttons.length ? popup.buttons : popup.link ? [{ label: 'Open', link: popup.link }] : []) : [];

  return (
    <>
      <Modal visible={Boolean(popup)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => popup && close(popup)}>
        <View style={styles.backdrop}>
          {popup && (
            <View style={styles.card}>
              {popup.imageUrl ? (
                <Image source={{ uri: popup.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : popup.sender ? (
                <View style={styles.avatarWrap}>
                  <Avatar uri={popup.sender.avatarUrl} name={popup.sender.name ?? 'Lovira'} size="xl" />
                </View>
              ) : null}
              <Pressable onPress={() => close(popup)} style={styles.close} hitSlop={12} accessibilityLabel="Close">
                <Icon name="close" size={14} color="#fff" />
              </Pressable>
              <View style={styles.cardBody}>
                {popup.sender && popup.imageUrl && (
                  <View style={styles.senderRow}>
                    <Avatar uri={popup.sender.avatarUrl} name={popup.sender.name ?? ''} size="xs" />
                    <Text style={styles.senderName}>{popup.sender.name}</Text>
                  </View>
                )}
                {!!popup.title && <Text style={styles.title}>{popup.title}</Text>}
                {!!popup.body && <Text style={styles.body}>{popup.body}</Text>}
                <View style={styles.buttons}>
                  {buttons.map((b, i) => (
                    <Button key={b.label} label={b.label} variant={i === 0 ? 'primary' : 'ghost'} size={i === 0 ? 'lg' : 'md'} onPress={() => tap(popup, b.link)} />
                  ))}
                  {!buttons.length && <Button label="OK" variant="primary" size="lg" onPress={() => close(popup)} />}
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {banner && (
        <View pointerEvents="box-none" style={[styles.bannerWrap, { bottom: insets.bottom + 76 }]}>
          <Pressable style={styles.banner} onPress={() => tap(banner, banner.buttons[0]?.link ?? banner.link)} accessibilityRole="button">
            {banner.sender ? (
              <Avatar uri={banner.sender.avatarUrl} name={banner.sender.name ?? ''} size="sm" />
            ) : (
              <View style={styles.bannerIcon}>
                <Icon name="sparkles" size={16} color={darkThemeColors.accent} />
              </View>
            )}
            <View style={styles.bannerText}>
              {!!banner.title && (
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {banner.title}
                </Text>
              )}
              {!!banner.body && (
                <Text style={styles.bannerBody} numberOfLines={2}>
                  {banner.body}
                </Text>
              )}
            </View>
            <Pressable onPress={() => close(banner)} hitSlop={12} accessibilityLabel="Close">
              <Icon name="close" size={12} color={darkThemeColors.textMuted} />
            </Pressable>
          </Pressable>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: darkThemeColors.surface, borderRadius: radius.xl ?? 24, overflow: 'hidden', borderWidth: 1, borderColor: darkThemeColors.border },
  image: { width: '100%', aspectRatio: 2 },
  avatarWrap: { alignItems: 'center', paddingTop: spacing.xl },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  senderName: { color: darkThemeColors.textSecondary, fontSize: 13, fontWeight: '600' },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  body: { color: darkThemeColors.textSecondary, fontSize: 15, lineHeight: 21 },
  buttons: { marginTop: spacing.sm, gap: spacing.xs },
  bannerWrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 40, elevation: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg ?? 16,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.15)',
  },
  bannerText: { flex: 1 },
  bannerTitle: { color: darkThemeColors.textPrimary, fontSize: 14, fontWeight: '700' },
  bannerBody: { color: darkThemeColors.textSecondary, fontSize: 13, marginTop: 2 },
});
