import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ConversationApi } from '../../services/api/conversationApi.js';
import type { ConversationSummary } from '@ai-companion/types';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  Avatar,
  Skeleton,
  EmptyState,
  Icon,
} from '../../components/common/index.js';

import { ApiClient } from '../../services/api/client.js';
import { SecureAuthStorage } from '../../services/auth/SecureAuthStorage.js';
import { chatListTime } from '../../utils/chatDates.js';
import { ToastService } from '../../components/common/Toast.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Curated demo companions matching the user's reference UI
const createDemoChar = (
  id: string,
  name: string,
  slug: string,
  avatarUrl: string,
  tagline: string,
) => ({
  id,
  name,
  slug,
  avatarUrl,
  tagline,
  coverImageUrl: avatarUrl,
  category: 'love',
  status: 'PUBLISHED' as const,
  visibility: 'PUBLIC' as const,
  isFeatured: true,
  currentVersionNumber: 1,
  updatedAt: '2026-09-30T00:00:00Z',
});

const DEMO_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'demo_ritika',
    userId: 'demo_user',
    characterId: 'char_ritika_sharma',
    title: 'Ritika Sharma',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-30T18:53:00Z',
    lastMessageSnippet: 'Batao phir, aaj ka din kaisa gaya?',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T18:53:00Z',
    character: createDemoChar(
      'char_ritika_sharma',
      'Ritika Sharma',
      'ritika-sharma',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      'Possessive Law Senior Girlfriend',
    ),
  },
  {
    id: 'demo_maya',
    userId: 'demo_user',
    characterId: 'char_dr_maya',
    title: 'Dr MAYA',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-30T18:05:00Z',
    lastMessageSnippet: 'Hey, hope you are doing well!...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T18:05:00Z',
    character: createDemoChar(
      'char_dr_maya',
      'Dr MAYA',
      'dr-maya',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
      'Empathic AI Psychologist',
    ),
  },
  {
    id: 'demo_ananya',
    userId: 'demo_user',
    characterId: 'char_dr_ananya',
    title: 'Dr. Ananya',
    status: 'ACTIVE',
    unreadCount: 2,
    lastMessageAt: '2026-09-30T17:00:00Z',
    lastMessageSnippet: 'Sab theek hai na?',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T17:00:00Z',
    character: createDemoChar(
      'char_dr_ananya',
      'Dr. Ananya',
      'dr-ananya',
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
      'Caring Wellness Companion',
    ),
  },
  {
    id: 'demo_priya',
    userId: 'demo_user',
    characterId: 'char_priya_mishra',
    title: 'Priya Mishra',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-30T16:47:00Z',
    lastMessageSnippet: 'Maine socha chalo yaad dila dein ki koi yah...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T16:47:00Z',
    character: createDemoChar(
      'char_priya_mishra',
      'Priya Mishra',
      'priya-mishra',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
      'Affectionate College Friend',
    ),
  },
  {
    id: 'demo_muskan',
    userId: 'demo_user',
    characterId: 'char_muskan_arora',
    title: 'Muskan Arora',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-30T16:38:00Z',
    lastMessageSnippet: 'Mujhe laga pehle bhi baat hui hai... lagta hai...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T16:38:00Z',
    character: createDemoChar(
      'char_muskan_arora',
      'Muskan Arora',
      'muskan-arora',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      'Charming Creative Artist',
    ),
  },
  {
    id: 'demo_aanya',
    userId: 'demo_user',
    characterId: 'char_aanya_mehta',
    title: 'Aanya Mehta',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-30T16:30:00Z',
    lastMessageSnippet: 'chalo chhodo, yeh batao lunch kiya ya nahi?',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T16:30:00Z',
    character: createDemoChar(
      'char_aanya_mehta',
      'Aanya Mehta',
      'aanya-mehta',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
      'Playful Childhood Friend',
    ),
  },
  {
    id: 'demo_zoya',
    userId: 'demo_user',
    characterId: 'char_zoya',
    title: 'Zoya',
    status: 'ACTIVE',
    unreadCount: 3,
    lastMessageAt: '2026-09-29T18:00:00Z',
    lastMessageSnippet: 'Bas tumhari yaad aa rahi thi.',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-29T18:00:00Z',
    character: createDemoChar(
      'char_zoya',
      'Zoya',
      'zoya',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      'Sweet Flirty Confidante',
    ),
  },
  {
    id: 'demo_meera',
    userId: 'demo_user',
    characterId: 'char_meera_sen',
    title: 'Meera Sen',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-27T12:00:00Z',
    lastMessageSnippet: 'Aisi baatein yahan bilkul nahi chalengi... tho...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-27T12:00:00Z',
    character: createDemoChar(
      'char_meera_sen',
      'Meera Sen',
      'meera-sen',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
      'Sophisticated Mentor',
    ),
  },
  {
    id: 'demo_joel',
    userId: 'demo_user',
    characterId: 'char_joel_antony',
    title: 'Joel Antony',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-26T15:00:00Z',
    lastMessageSnippet: 'Push-Pull-Legs (PPL) split best rahega cha...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-26T15:00:00Z',
    character: createDemoChar(
      'char_joel_antony',
      'Joel Antony',
      'joel-antony',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
      'Elite Fitness Coach',
    ),
  },
  {
    id: 'demo_natasha',
    userId: 'demo_user',
    characterId: 'char_natasha',
    title: 'Natasha',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-26T14:30:00Z',
    lastMessageSnippet: 'Chalo batao, weekly kitne din gym ja sakte ...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-26T14:30:00Z',
    character: createDemoChar(
      'char_natasha',
      'Natasha',
      'natasha',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
      'Energetic Gym Partner',
    ),
  },
  {
    id: 'demo_shreya',
    userId: 'demo_user',
    characterId: 'char_shreya_mehta',
    title: 'Shreya Mehta',
    status: 'ACTIVE',
    unreadCount: 0,
    lastMessageAt: '2026-09-26T11:20:00Z',
    lastMessageSnippet: 'Hii! Lovish pe aapse connect karke accha la...',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-26T11:20:00Z',
    character: createDemoChar(
      'char_shreya_mehta',
      'Shreya Mehta',
      'shreya-mehta',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
      'Warm Romantic Girlfriend',
    ),
  },
];

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

  // Raw list combining server items or rich fallback demo items
  const serverItems = data?.items || [];
  const listItems = serverItems.length > 0 ? serverItems : DEMO_CONVERSATIONS;

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



  const renderConversationItem = ({ item }: { item: ConversationSummary }) => {
    const timeDisplay = formatDisplayTime(item.lastMessageAt);
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.7}
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
          style={styles.avatarStyle}
        />

        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={styles.characterName} numberOfLines={1}>
              {item.character.name}
            </Text>
            <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>
              {timeDisplay}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.snippet} numberOfLines={1}>
              {item.lastMessageSnippet || 'Start conversation...'}
            </Text>
            {hasUnread && (
              <View style={styles.badgeCircle}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07060B" />

      {/* Header matching exact layout */}
      <View style={styles.header}>
        {isSearchActive ? (
          <View style={styles.searchHeaderContainer}>
            <Icon name="search" size={18} color="#8E8A9F" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="#7A758B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity
              style={styles.closeSearchButton}
              onPress={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.title}>Messages</Text>
              <Text style={styles.subtitle}>Your real-time conversations with AI companions</Text>
            </View>
            <TouchableOpacity
              style={styles.searchIconButton}
              onPress={() => setIsSearchActive(true)}
              activeOpacity={0.7}
              accessibilityLabel="Search companions"
            >
              <Icon name="search" size={20} color="#FFFFFF" />
            </TouchableOpacity>
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
          title="Failed to load messages"
          description="Unable to sync conversation history. Please check your connection."
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#E11D48"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="No Conversations Found"
              description="No companion chats match your search query."
              actionLabel="Clear Search"
              onAction={() => setSearchQuery('')}
            />
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#07060B',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8A9F',
    marginTop: 3,
    fontWeight: '400',
  },
  searchIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarStyle: {
    marginRight: 14,
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
  timestampUnread: {
    color: '#D946EF',
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
  badgeCircle: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D946EF',
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

