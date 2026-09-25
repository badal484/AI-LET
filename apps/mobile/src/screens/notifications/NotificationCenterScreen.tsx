import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  IconButton,
  Icon,
  type IconName,
  Badge,
  Skeleton,
  EmptyState,
  ToastService,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { useNotificationStore } from '../../stores/notificationStore.js';
import type { InAppNotificationItem, NotificationCategory } from '@ai-companion/types';

const CATEGORY_TABS: Array<{ label: string; key?: NotificationCategory }> = [
  { label: 'All', key: undefined },
  { label: 'Messages', key: 'character_message' },
  { label: 'Reminders', key: 'reminder' },
  { label: 'Discoveries', key: 'recommendations' },
  { label: 'Updates', key: 'product_update' },
  { label: 'Billing', key: 'billing' },
  { label: 'System', key: 'system' },
];

export const NotificationCenterScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchInbox,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInbox(selectedCategory, true);
  }, [selectedCategory, fetchInbox]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInbox(selectedCategory, true);
    setRefreshing(false);
  }, [selectedCategory, fetchInbox]);

  const handleNotificationTap = (item: InAppNotificationItem) => {
    if (!item.isRead) {
      markAsRead([item.id]);
    }

    const data = item.data || {};
    if (data.conversationId) {
      navigation.navigate('Chat', {
        characterId: data.characterId || '',
        conversationId: data.conversationId,
      });
    } else if (data.characterId) {
      navigation.navigate('CharacterDetail', {
        characterId: data.characterId,
      });
    } else if (item.category === 'billing' || item.category === 'subscription') {
      navigation.navigate('SubscriptionManagement');
    } else if (item.category === 'reminder') {
      navigation.navigate('Reminders');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    ToastService.show({ message: 'All notifications marked as read', type: 'info', duration: 1500 });
  };

  const getCategoryIcon = (category: string): IconName => {
    switch (category) {
      case 'character_message':
        return 'chat';
      case 'reminder':
        return 'moon';
      case 'recommendations':
        return 'sparkles';
      case 'product_update':
      case 'campaign':
        return 'star';
      case 'billing':
      case 'subscription':
        return 'zap';
      case 'system':
      case 'safety_alert':
        return 'shield';
      default:
        return 'bell';
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: InAppNotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.isRead && styles.unreadNotificationCard,
      ]}
      onPress={() => handleNotificationTap(item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.body}, ${formatTimeAgo(item.createdAt)}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconRow}>
          <Icon name={getCategoryIcon(item.category)} size={16} color={darkThemeColors.accent} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.timestampText}>{formatTimeAgo(item.createdAt)}</Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
      </View>

      <Text style={styles.cardBody} numberOfLines={3}>
        {item.body}
      </Text>

      <View style={styles.cardFooter}>
        <Badge
          label={item.category.replace(/_/g, ' ')}
          variant="category"
          size="sm"
        />
        <TouchableOpacity
          onPress={() => deleteNotification(item.id)}
          style={styles.deleteButton}
          accessibilityLabel="Delete notification"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={navigation.goBack}
          accessibilityLabel="Back"
        />
        <View style={{ flex: 1, marginLeft: spacing.xs }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllReadBtn}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_TABS}
          keyExtractor={(t) => t.label}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item: tab }) => {
            const isSelected = selectedCategory === tab.key;
            return (
              <TouchableOpacity
                style={[styles.tabChip, isSelected && styles.tabChipActive]}
                onPress={() => setSelectedCategory(tab.key)}
                accessibilityRole="tab"
                accessibilityLabel={`Filter by ${tab.label}`}
              >
                <Text style={[styles.tabChipText, isSelected && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={darkThemeColors.accent}
            />
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              fetchInbox(selectedCategory, false);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loading && notifications.length > 0 ? (
              <ActivityIndicator color={darkThemeColors.accent} style={{ marginVertical: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="No Notifications"
              description={
                selectedCategory
                  ? 'No notifications found in this category.'
                  : 'You have no notifications or alerts right now.'
              }
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
    paddingTop: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: darkThemeColors.background,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  markAllReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllReadText: {
    color: darkThemeColors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xl,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  tabChipActive: {
    backgroundColor: darkThemeColors.accent,
    borderColor: darkThemeColors.accent,
  },
  tabChipText: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: darkThemeColors.accentText,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  notificationCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  unreadNotificationCard: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(157, 101, 255, 0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: darkThemeColors.accent,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  deleteButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteText: {
    fontSize: 11,
    color: darkThemeColors.danger,
    fontWeight: '600',
  },
});
