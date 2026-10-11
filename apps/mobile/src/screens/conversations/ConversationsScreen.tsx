import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTypingStore } from '../../stores/typingStore.js';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ConversationApi } from '../../services/api/conversationApi.js';
import type { ConversationSummary } from '@ai-companion/types';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  Avatar,
  Skeleton,
  EmptyState,
  Icon,
  PressableScale,
} from '../../components/common/index.js';

import { ApiClient } from '../../services/api/client.js';
import { SecureAuthStorage } from '../../services/auth/SecureAuthStorage.js';
import { chatListTime } from '../../utils/chatDates.js';
import { ToastService } from '../../components/common/Toast.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [actionSheetItem, setActionSheetItem] = useState<ConversationSummary | null>(null);

  const handleChatActions = (item: ConversationSummary) => {
    setActionSheetItem(item);
  };

  const executeDeleteChat = async (item: ConversationSummary) => {
    try {
      if (!item.id.startsWith('demo_')) {
        await ConversationApi.clearChat(item.id, true);
      }
      queryClient.removeQueries({ queryKey: ['messages', item.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      ToastService.show({ message: 'Chat deleted.', type: 'info', duration: 2000 });
    } catch {
      ToastService.show({ message: 'Could not delete the chat. Try again.', type: 'error', duration: 2500 });
    }
  };

  const executeStartFresh = async (item: ConversationSummary) => {
    const name = item.character.name;
    try {
      if (!item.id.startsWith('demo_')) {
        await ConversationApi.startFresh(item.id);
      }
      queryClient.removeQueries({ queryKey: ['messages', item.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      ToastService.show({ message: `${name} has forgotten everything.`, type: 'info', duration: 2500 });
    } catch {
      ToastService.show({ message: 'Could not start fresh. Try again.', type: 'error', duration: 2500 });
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
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
  // Coming back to Chats (e.g. from a chat that got a reply after you left): show the latest.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const queryClient = useQueryClient();

  const prefetchConversation = (conversation: ConversationSummary) => {
    if (conversation.id.startsWith('demo_')) return;
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
      conversationId: conversation.id.startsWith('demo_') ? undefined : conversation.id,
      characterName: conversation.character.name,
      characterAvatarUrl: conversation.character.avatarUrl,
    });
  };

  const listItems = data?.items || [];

  const filteredItems = listItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const nameMatch = item.character.name.toLowerCase().includes(searchQuery.toLowerCase());
    const snippetMatch = (item.lastMessageSnippet || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || snippetMatch;
  });

  const formatDisplayTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
      }
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return chatListTime(isoString);
    }
  };



  // Live: which characters are typing right now (shown instead of the last message, like WhatsApp).
  const typingNow = useTypingStore((st) => st.typing);
  // The spinner only for a pull-to-refresh; live and on-return updates happen quietly in place.
  const [pulling, setPulling] = useState(false);
  const onPull = async () => {
    setPulling(true);
    await refetch().catch(() => undefined);
    setPulling(false);
  };

  const renderConversationItem = ({ item }: { item: ConversationSummary }) => {
    const timeDisplay = formatDisplayTime(item.lastMessageAt);
    const hasUnread = item.unreadCount > 0;

    return (
      <PressableScale
        style={styles.itemContainer}
        scaleTo={0.985}
        onPressIn={() => prefetchConversation(item)}
        onPress={() => handleOpenConversation(item)}
        onLongPress={() => handleChatActions(item)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${item.character.name}${hasUnread ? `, ${item.unreadCount} unread` : ''}: ${item.lastMessageSnippet || ''}`}
        accessibilityHint="Long press for more options"
      >
        <Avatar
          uri={item.character.avatarUrl}
          name={item.character.name}
          size="lg"
          style={styles.avatarStyle}
        />

        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={[styles.characterName, hasUnread && styles.characterNameUnread]} numberOfLines={1}>
              {item.character.name}
            </Text>
            <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>
              {timeDisplay}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            {typingNow[item.id] ? (
              <Text style={[styles.snippet, styles.snippetTyping]} numberOfLines={1}>
                typing…
              </Text>
            ) : (
              <Text style={[styles.snippet, hasUnread && styles.snippetUnread]} numberOfLines={1}>
                {item.lastMessageSnippet || 'Say hi 👋'}
              </Text>
            )}
            {hasUnread && (
              <View style={styles.badgeCircle}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        {isSearchActive ? (
          <View style={styles.searchHeaderContainer}>
            <Icon name="search" size={16} color="#8E8A9F" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats"
              placeholderTextColor="#7A758B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.closeSearchButton}
              onPress={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
              hitSlop={8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Chats</Text>
            {listItems.length > 0 && (
              <TouchableOpacity
                style={styles.searchIconButton}
                onPress={() => setIsSearchActive(true)}
                activeOpacity={0.7}
                accessibilityLabel="Search chats"
              >
                <Icon name="search" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </>
        )}
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
          title="Couldn't load your chats"
          description="Check your internet and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          extraData={typingNow}
          initialNumToRender={12}
          windowSize={9}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={() => void onPull()}
              tintColor="#E11D48"
            />
          }
          ListEmptyComponent={
            searchQuery.trim() ? (
              <Text style={styles.noMatch}>No chats match “{searchQuery.trim()}”</Text>
            ) : (
              <EmptyState
                icon="chat"
                title="No chats yet"
                description="Pick someone on Home and say hi — your chats will show up here."
                actionLabel="Find someone to talk to"
                onAction={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              />
            )
          }
        />
      )}

      {/* Ultra-Simple Clean Dark Action Dialog */}
      <Modal
        visible={!!actionSheetItem}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetItem(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActionSheetItem(null)}>
          <View style={styles.simpleBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.simpleCard}>
                {actionSheetItem && (
                  <>
                    <Text style={styles.simpleTitle}>
                      {actionSheetItem.character.name}
                    </Text>

                    <TouchableOpacity
                      style={styles.simpleRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        const item = actionSheetItem;
                        setActionSheetItem(null);
                        executeStartFresh(item);
                      }}
                    >
                      <Text style={styles.simpleRowText}>
                        Start fresh with {actionSheetItem.character.name}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.simpleDivider} />

                    <TouchableOpacity
                      style={styles.simpleRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        const item = actionSheetItem;
                        setActionSheetItem(null);
                        executeDeleteChat(item);
                      }}
                    >
                      <Text style={[styles.simpleRowText, { color: '#F87171' }]}>
                        Delete chat
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.simpleDivider} />

                    <TouchableOpacity
                      style={styles.simpleRow}
                      activeOpacity={0.7}
                      onPress={() => setActionSheetItem(null)}
                    >
                      <Text style={styles.simpleCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07060B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 60,
    backgroundColor: '#07060B',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C1826',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeaderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1826',
    borderRadius: 21,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 0,
  },
  closeSearchButton: {
    paddingLeft: 10,
  },
  cancelText: {
    color: '#E11D48',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarStyle: {
    marginRight: 14,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  characterName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 10,
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8A9F',
    fontWeight: '400',
  },
  characterNameUnread: {
    fontWeight: '800',
  },
  snippetUnread: {
    color: '#E5E1EE',
    fontWeight: '600',
  },
  noMatch: {
    color: '#8E8A9F',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  timestampUnread: {
    color: '#EC4899',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippet: {
    fontSize: 14,
    lineHeight: 19,
    color: '#9E9AA9',
    flex: 1,
    marginRight: 10,
  },
  snippetTyping: {
    color: '#22C55E',
    fontStyle: 'italic',
  },
  badgeCircle: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // Simple Dark Action Popup Styles
  simpleBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  simpleCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#161124',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2342',
    overflow: 'hidden',
  },
  simpleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  simpleRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  simpleRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  simpleDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  simpleCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
});

