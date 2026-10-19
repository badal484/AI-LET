import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors, spacing } from '../../theme/index.js';
import { NotificationApi } from '../../services/api/notificationApi.js';
import type { UserReminderData } from '@ai-companion/types';
import { AppAlert } from '../../components/common/AppDialog.js';
import { Icon, IconButton, Skeleton } from '../../components/common/index.js';
import { GradientFill } from '../../components/common/GradientFill.js';

/** Reminders characters set when you asked them to ("remind me tomorrow…"): upcoming first, cancel any of them. */

const STATUS_LABEL: Record<string, string> = { PENDING: 'Upcoming', CANCELLED: 'Cancelled' };
const fmtWhen = (d: Date) =>
  `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()}`;

export const RemindersScreen: React.FC = () => {
  const navigation = useNavigation();
  const [reminders, setReminders] = useState<UserReminderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const data = await NotificationApi.listReminders();
      setReminders(data);
    } catch (err: any) {
      AppAlert.alert('Couldn’t load reminders', err.message || 'Please try again in a moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders();
  };

  const handleCancelReminder = (id: string) => {
    AppAlert.alert('Cancel this reminder?', 'You won’t get it.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel reminder',
        style: 'destructive',
        onPress: async () => {
          try {
            await NotificationApi.cancelReminder(id);
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
          } catch (err: any) {
            AppAlert.alert('Couldn’t cancel', err.message || 'Please try again in a moment.');
          }
        },
      },
    ]);
  };

  const sorted = [...reminders].sort((a, b) => {
    const ap = a.status === 'PENDING' ? 0 : 1;
    const bp = b.status === 'PENDING' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const at = new Date(a.targetTime).getTime();
    const bt = new Date(b.targetTime).getTime();
    return ap === 0 ? at - bt : bt - at;
  });

  const renderReminderItem = ({ item }: { item: UserReminderData }) => {
    const isPending = item.status === 'PENDING';
    return (
      <View style={[styles.card, !isPending && styles.cardDone]}>
        <View style={[styles.icon, !isPending && styles.iconDone]}>
          <Icon name="bell" size={18} color={isPending ? darkThemeColors.accent : darkThemeColors.textMuted} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.content ? (
            <Text style={styles.cardContent} numberOfLines={2}>
              {item.content}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.when}>{fmtWhen(new Date(item.targetTime))}</Text>
            <Text style={[styles.status, isPending && styles.statusUpcoming]}>{STATUS_LABEL[item.status] ?? 'Sent'}</Text>
          </View>
        </View>
        {isPending && (
          <TouchableOpacity
            onPress={() => handleCancelReminder(item.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Cancel reminder: ${item.title}`}
          >
            <Icon name="close" size={18} color={darkThemeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill radial colors={[['#A855F7', 0.2], ['#EC4899', 0.05], ['#0B0614', 0]]} />
      </View>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.title}>Your reminders</Text>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} borderRadius={16} />
          ))}
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="bell" size={26} color={darkThemeColors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.emptySubtitle}>Ask anyone to remind you of something — it shows up here.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderReminderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkThemeColors.accent} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  cardDone: { opacity: 0.55 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,92,246,0.14)' },
  iconDone: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: darkThemeColors.textPrimary },
  cardContent: { fontSize: 13, lineHeight: 18, color: darkThemeColors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 8 },
  when: { fontSize: 12, color: darkThemeColors.textMuted },
  status: { fontSize: 11, fontWeight: '700', color: darkThemeColors.textMuted },
  statusUpcoming: { color: '#C4B5FD' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, paddingBottom: 80 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: darkThemeColors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, lineHeight: 20, color: darkThemeColors.textMuted, textAlign: 'center', maxWidth: 280 },
});
