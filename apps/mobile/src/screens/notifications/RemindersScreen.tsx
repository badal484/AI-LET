import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import { NotificationApi } from '../../services/api/notificationApi.js';
import type { UserReminderData } from '@ai-companion/types';

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
      Alert.alert('Error', err.message || 'Failed to load reminders');
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

  const handleCancelReminder = async (id: string) => {
    Alert.alert('Cancel Reminder', 'Are you sure you want to cancel this scheduled reminder?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Reminder',
        style: 'destructive',
        onPress: async () => {
          try {
            await NotificationApi.cancelReminder(id);
            setReminders(prev => prev.map(r => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel reminder');
          }
        },
      },
    ]);
  };

  const renderReminderItem = ({ item }: { item: UserReminderData }) => {
    const isPending = item.status === 'PENDING';
    const targetDate = new Date(item.targetTime);

    return (
      <View style={[styles.reminderCard, !isPending && styles.inactiveCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View
            style={[
              styles.statusBadge,
              isPending ? styles.pendingBadge : styles.triggeredBadge,
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.cardContent} numberOfLines={2}>
          {item.content}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.scheduledTimeText}>
            ⏰ {targetDate.toLocaleDateString()} at{' '}
            {targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {isPending && (
            <TouchableOpacity
              onPress={() => handleCancelReminder(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Companion Reminders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={darkThemeColors.accent} />
          <Text style={styles.loadingText}>Loading reminders...</Text>
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>⏰</Text>
          <Text style={styles.emptyTitle}>No Reminders Scheduled</Text>
          <Text style={styles.emptySubtitle}>
            When you ask your companion to follow up on a topic, your scheduled reminders will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={item => item.id}
          renderItem={renderReminderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={darkThemeColors.accent}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backText: {
    color: darkThemeColors.textPrimary,
    fontSize: 28,
    fontWeight: '300',
  },
  title: {
    ...typography.h3,
    color: darkThemeColors.textPrimary,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  reminderCard: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pendingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  triggeredBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  cardContent: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  scheduledTimeText: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
  },
  cancelActionText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: darkThemeColors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
