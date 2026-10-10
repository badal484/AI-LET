import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { UserNotificationPreferenceData } from '@ai-companion/types';
import { Icon, IconButton, ToastService } from '../../components/common/index.js';
import { NotificationApi } from '../../services/api/notificationApi.js';
import { PushService } from '../../services/push/PushService.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

/**
 * Notifications, kept simple: is this phone getting them, three choices, lock-screen text, quiet hours,
 * and your reminders. Replies from characters always come (that's the point); payments and account
 * notices too.
 */

const QUIET: Array<{ start: string; end: string; label: string }> = [
  { start: '22:30', end: '08:00', label: '10:30 pm – 8 am' },
  { start: '23:00', end: '09:00', label: '11 pm – 9 am' },
  { start: '00:00', end: '10:00', label: '12 am – 10 am' },
];

type Prefs = Partial<UserNotificationPreferenceData>;

export const NotificationPreferencesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [permission, setPermission] = useState<string>('AUTHORIZED');

  const checkPermission = useCallback(() => {
    PushService.permission().then(setPermission).catch(() => undefined);
  }, []);

  useEffect(() => {
    NotificationApi.getPreferences()
      .then((p) => setPrefs(p))
      .catch(() => setPrefs({}));
    checkPermission();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && checkPermission());
    return () => sub.remove();
  }, [checkPermission]);

  const save = async (patch: Prefs) => {
    const before = prefs;
    setPrefs((p) => ({ ...(p ?? {}), ...patch })); // instant; undone if the server says no
    try {
      await NotificationApi.updatePreferences(patch);
    } catch {
      setPrefs(before);
      ToastService.show({ message: 'Could not save. Please try again.', type: 'error', duration: 2500 });
    }
  };

  const turnOn = async () => {
    if (await PushService.askedAt()) PushService.openSettings();
    else await PushService.askPermission().catch(() => undefined);
    checkPermission();
  };

  const on = permission === 'AUTHORIZED' || permission === 'PROVISIONAL';

  const toggle = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void, first = false) => (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#3A3F55', true: darkThemeColors.accent }} thumbColor="#FFFFFF" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.title}>Notifications</Text>
      </View>

      {!prefs ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={darkThemeColors.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Is this phone getting them? */}
          <View style={[styles.status, !on && styles.statusOff]}>
            <Icon name="bell" size={18} color={on ? darkThemeColors.success : darkThemeColors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{on ? 'On for this phone' : 'Off for this phone'}</Text>
              <Text style={styles.statusSub}>{on ? 'You’ll see replies even when the app is closed.' : 'You won’t see replies or reminders while the app is closed.'}</Text>
            </View>
            {!on && (
              <Pressable style={styles.turnOn} onPress={() => void turnOn()} accessibilityRole="button">
                <Text style={styles.turnOnText}>Turn on</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            {toggle('Characters can text you first', 'Now and then, when they have something to say', prefs.proactivityEnabled ?? true, (v) => void save({ proactivityEnabled: v }), true)}
            {toggle('Reminders', 'When a character reminds you of something you asked', prefs.userReminderCategoryEnabled ?? true, (v) => void save({ userReminderCategoryEnabled: v }))}
            {toggle('News & offers', 'New characters and deals, rarely', (prefs.productUpdatesCategoryEnabled ?? true) || (prefs.marketingCategoryEnabled ?? false), (v) =>
              void save({ productUpdatesCategoryEnabled: v, marketingCategoryEnabled: v }),
            )}
            {toggle('Show message on lock screen', 'Off: only “New message from Kiara”', prefs.showPreview ?? true, (v) => void save({ showPreview: v }))}
          </View>

          <View style={styles.card}>
            {toggle('Quiet hours', 'No notifications while you sleep', prefs.quietHoursEnabled ?? true, (v) => void save({ quietHoursEnabled: v }), true)}
            {(prefs.quietHoursEnabled ?? true) && (
              <View style={styles.chips}>
                {QUIET.map((q) => {
                  const active = (prefs.quietHoursStart ?? '22:30') === q.start && (prefs.quietHoursEnd ?? '08:00') === q.end;
                  return (
                    <Pressable key={q.label} style={[styles.chip, active && styles.chipOn]} onPress={() => void save({ quietHoursStart: q.start, quietHoursEnd: q.end })} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>{q.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <Pressable style={[styles.card, styles.link]} onPress={() => navigation.navigate('Reminders' as never)} accessibilityRole="button">
            <Icon name="moon" size={16} color={darkThemeColors.accent} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Your reminders</Text>
            <Icon name="arrow-right" size={12} color={darkThemeColors.textMuted} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    backgroundColor: 'rgba(52,211,153,0.08)',
  },
  statusOff: { borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)' },
  statusTitle: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '700' },
  statusSub: { color: darkThemeColors.textSecondary, fontSize: 12, marginTop: 2 },
  turnOn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: darkThemeColors.accent },
  turnOnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: darkThemeColors.surface, borderRadius: 16, borderWidth: 1, borderColor: darkThemeColors.border, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: darkThemeColors.border },
  rowText: { flex: 1 },
  rowTitle: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: darkThemeColors.border },
  chipOn: { borderColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.12)' },
  chipText: { color: darkThemeColors.textSecondary, fontSize: 13 },
  chipTextOn: { color: '#F472B6', fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
});
