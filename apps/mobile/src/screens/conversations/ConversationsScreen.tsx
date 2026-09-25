import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ConversationApi } from '../../services/api/conversationApi.js';
import type { ConversationSummary } from '@ai-companion/types';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  Avatar,
  Badge,
  Skeleton,
  EmptyState,
  IconButton,
} from '../../components/common/index.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => ConversationApi.listConversations({ limit: 50 }),
  });

  const handleOpenConversation = (conversation: ConversationSummary) => {
    navigation.navigate('Chat', {
      characterId: conversation.character.id,
      conversationId: conversation.id,
    });
  };

  const formatTimeAgo = (dateString?: string | null) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  };

  const renderConversationItem = ({ item }: { item: ConversationSummary }) => {
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.75}
        onPress={() => handleOpenConversation(item)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${item.character.name}: ${item.lastMessageSnippet || 'Conversation open'}`}
      >
        <Avatar
          uri={item.character.avatarUrl}
          name={item.character.name}
          size="md"
          style={styles.avatarMargin}
        />

        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={styles.characterName} numberOfLines={1}>
              {item.character.name}
            </Text>
            <Text style={styles.timestamp}>{formatTimeAgo(item.lastMessageAt)}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.snippet} numberOfLines={1}>
              {item.lastMessageSnippet || 'Conversation started'}
            </Text>
            {item.unreadCount > 0 && (
              <Badge label={item.unreadCount} variant="count" size="sm" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Your real-time conversations with AI companions</Text>
        </View>
        <IconButton
          icon="search"
          size="md"
          variant="surface"
          onPress={() => navigation.navigate('Search')}
          accessibilityLabel="Search companions"
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton.Card height={72} />
          <Skeleton.Card height={72} />
          <Skeleton.Card height={72} />
          <Skeleton.Card height={72} />
        </View>
      ) : isError ? (
        <EmptyState
          icon="warning"
          title="Failed to load messages"
          description="Unable to sync conversation history. Please check your connection."
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={darkThemeColors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="No Conversations Yet"
              description="Discover a companion and start your first conversation."
              actionLabel="Explore Companions"
              onAction={() => navigation.navigate('MainTabs', { screen: 'Discover' })}
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
    paddingTop: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  avatarMargin: {
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  characterName: {
    fontSize: 15,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
});
