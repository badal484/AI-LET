import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

import { ApiClient } from '../../services/api/client.js';
import { SecureAuthStorage } from '../../services/auth/SecureAuthStorage.js';
import { chatListTime } from '../../utils/chatDates.js';
import { ToastService } from '../../components/common/Toast.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: async () => {
      const session = await SecureAuthStorage.getSession();
      if (session?.accessToken) {
        ApiClient.setAuthToken(session.accessToken);
      }
      return ConversationApi.listConversations({ limit: 50 });
    },
    retry: 1,
  });

  const queryClient = useQueryClient();

  // Start loading the chat on touch-down, so history is usually ready by the time the screen opens.
  // Keys and params mirror ChatScreen's queries so it reuses this cache.
  const prefetchConversation = (conversation: ConversationSummary) => {
    queryClient.prefetchQuery({
      queryKey: ['conversation', conversation.id],
      queryFn: () => ConversationApi.getConversation(conversation.id),
      staleTime: 30_000,
    });
    queryClient.prefetchInfiniteQuery({
      queryKey: ['messages', conversation.id],
      queryFn: ({ pageParam }) =>
        ConversationApi.getMessages(conversation.id, { cursor: pageParam as string | undefined, limit: 30, direction: 'before' }),
      initialPageParam: undefined as string | undefined,
      staleTime: 30_000,
    });
  };

  const handleOpenConversation = (conversation: ConversationSummary) => {
    prefetchConversation(conversation);
    navigation.navigate('Chat', {
      characterId: conversation.character.id,
      conversationId: conversation.id,
      characterName: conversation.character.name,
      characterAvatarUrl: conversation.character.avatarUrl,
    });
  };


  // Long-press a chat (like WhatsApp): "Delete chat" — gone from your list and screen, but they still
  // remember you — or "Start fresh" — they forget everything (the real privacy option).
  const handleChatActions = (item: ConversationSummary) => {
    const name = item.character.name;
    Alert.alert(name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Start fresh with ${name}`, style: 'destructive', onPress: () => confirmStartFresh(item) },
      { text: 'Delete chat', onPress: () => confirmDeleteChat(item) },
    ]);
  };

  const confirmDeleteChat = (item: ConversationSummary) => {
    const name = item.character.name;
    Alert.alert('Delete this chat?', `It will disappear from your chats. ${name} will still remember you and what you talked about.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete chat',
        onPress: async () => {
          try {
            await ConversationApi.clearChat(item.id, true);
            queryClient.removeQueries({ queryKey: ['messages', item.id] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          } catch {
            ToastService.show({ message: 'Could not delete the chat. Try again.', type: 'error', duration: 2500 });
          }
        },
      },
    ]);
  };

  const confirmStartFresh = (item: ConversationSummary) => {
    const name = item.character.name;
    Alert.alert(
      `Start fresh with ${name}?`,
      `${name} will forget everything about you — your chats, what they remember and your bond. You'll meet as strangers. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: async () => {
            try {
              await ConversationApi.startFresh(item.id);
              queryClient.removeQueries({ queryKey: ['messages', item.id] });
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              ToastService.show({ message: `${name} has forgotten everything.`, type: 'info', duration: 2500 });
            } catch {
              ToastService.show({ message: 'Could not start fresh. Try again.', type: 'error', duration: 2500 });
            }
          },
        },
      ],
    );
  };

  const renderConversationItem = ({ item }: { item: ConversationSummary }) => {
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.75}
        onPressIn={() => prefetchConversation(item)}
        onPress={() => handleOpenConversation(item)}
        onLongPress={() => handleChatActions(item)}
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
            <Text style={styles.timestamp}>{chatListTime(item.lastMessageAt)}</Text>
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
