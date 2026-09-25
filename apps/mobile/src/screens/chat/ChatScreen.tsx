import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageBackground,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { ChatStreamClient } from '../../services/api/chatStreamClient.js';
import { feedbackApi } from '../../services/api/feedbackApi.js';
import { useChatStreamStore } from '../../stores/chatStreamStore.js';
import {
  Avatar,
  MessageBubble,
  Banner,
  Skeleton,
  ToastService,
  Icon,
} from '../../components/common/index.js';
import { MessageFeedbackModal } from '../../components/chat/MessageFeedbackModal.js';
import { spacing, radius } from '../../theme/index.js';
import type { ChatMessageItem, ConversationDetail } from '@ai-companion/types';

type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

const VIRTUAL_GIFTS = [
  { id: 'rose', name: 'Red Rose', icon: '🌹', coins: 10, prompt: '[Sent a Gift: 🌹 Red Rose]' },
  { id: 'coffee', name: 'Hot Coffee', icon: '☕', coins: 25, prompt: '[Sent a Gift: ☕ Hot Coffee]' },
  { id: 'chocolates', name: 'Chocolates', icon: '🍫', coins: 50, prompt: '[Sent a Gift: 🍫 Box of Belgian Chocolates]' },
  { id: 'teddy', name: 'Teddy Bear', icon: '🧸', coins: 100, prompt: '[Sent a Gift: 🧸 Fluffy Teddy Bear]' },
  { id: 'star', name: 'Cosmic Star', icon: '✨', coins: 200, prompt: '[Sent a Gift: ✨ Glowing Celestial Star]' },
  { id: 'ring', name: 'Diamond Ring', icon: '💍', coins: 500, prompt: '[Sent a Gift: 💍 Sparkling Diamond Ring]' },
];

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { characterId, conversationId: initialConversationId, initialPrompt } = route.params;

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId || null,
  );
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageItem[]>([]);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [isGiftModalVisible, setIsGiftModalVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const flatListRef = useRef<FlatList<any>>(null);

  const {
    isStreaming,
    streamingMessageId,
    accumulatedDelta,
    startStreaming,
    appendDelta,
    finishStreaming,
    cancelStreaming,
    setError: setStreamError,
    error: streamError,
  } = useChatStreamStore();

  // 1. Resolve or Create Conversation
  const { data: conversation, isLoading: isConvLoading } = useQuery({
    queryKey: ['conversation', activeConversationId || characterId],
    queryFn: async (): Promise<ConversationDetail> => {
      if (activeConversationId) {
        return ConversationApi.getConversation(activeConversationId);
      }
      const created = await ConversationApi.createConversation(characterId);
      setActiveConversationId(created.id);
      return created;
    },
  });

  const effectiveConvId = conversation?.id || activeConversationId;
  const companionFirstName = conversation?.character?.name?.split(' ')[0] || 'Companion';

  // 2. Fetch Messages with Infinite Cursor Pagination
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', effectiveConvId],
    queryFn: ({ pageParam }) =>
      ConversationApi.getMessages(effectiveConvId!, {
        cursor: pageParam,
        limit: 30,
        direction: 'before',
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(effectiveConvId),
  });

  const serverMessages = messagesData?.pages.flatMap((page) => page.items) || [];
  const serverMessageIds = new Set(serverMessages.map((m) => m.id));
  const pendingOptimistic = optimisticMessages.filter((m) => !serverMessageIds.has(m.id));
  const allMessages = [...pendingOptimistic, ...serverMessages];

  // 3. Scroll Management
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    setIsScrolledUp(offsetY > 100);
  };

  const scrollToBottom = useCallback(() => {
    if (!isScrolledUp && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isScrolledUp]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom();
    }
  }, [accumulatedDelta, isStreaming, scrollToBottom]);

  // 4. Send Message Handler
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || !effectiveConvId || isStreaming) return;

    if (!textToSend) {
      setInputText('');
    }

    const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tempUserMessage: ChatMessageItem = {
      id: `temp-${Date.now()}`,
      conversationId: effectiveConvId,
      senderType: 'USER',
      role: 'user',
      content,
      status: 'SENT',
      sequenceNumber: (allMessages[0]?.sequenceNumber || 0) + 1,
      retryCount: 0,
      parts: [],
      clientRequestId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [tempUserMessage, ...prev]);

    const abortController = new AbortController();
    const tempAssistantId = `gen-${Date.now()}`;
    startStreaming(effectiveConvId, tempAssistantId, abortController);

    await ChatStreamClient.streamMessage(
      effectiveConvId,
      content,
      clientRequestId,
      {
        onStarted: (payload) => {
          if (payload.messageId) {
            useChatStreamStore.setState({ streamingMessageId: payload.messageId });
          }
        },
        onDelta: (payload) => {
          appendDelta(payload.delta);
        },
        onCompleted: () => {
          finishStreaming();
          queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
        onFailed: (payload) => {
          setStreamError(payload.errorMessage);
          finishStreaming();
          queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
        },
        onCancelled: () => {
          finishStreaming();
          queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
        },
      },
      abortController.signal,
    );
  };

  const handleCancelGeneration = async () => {
    if (effectiveConvId && streamingMessageId) {
      cancelStreaming();
      try {
        await ConversationApi.cancelGeneration(effectiveConvId, streamingMessageId);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
    }
  };

  const handleRetry = (content: string) => {
    handleSendMessage(content);
  };

  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; score: 1 | -1 } | null>(null);
  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    if (!activeConversationId) return;
    if (rating === 'negative') {
      setFeedbackTarget({ messageId, score: -1 });
      return;
    }
    try {
      await feedbackApi.submitMessageFeedback(activeConversationId, messageId, { rating: 'THUMBS_UP' });
    } catch {
      ToastService.show({ message: 'Could not send feedback. Please try again.', type: 'error', duration: 2500 });
    }
  };

  const handleSendGift = (gift: typeof VIRTUAL_GIFTS[0]) => {
    setIsGiftModalVisible(false);
    handleSendMessage(gift.prompt);
    ToastService.show({ message: `Sent ${gift.name}!`, type: 'success', duration: 2000 });
  };

  const renderMessageItem = ({ item }: { item: ChatMessageItem }) => {
    return (
      <MessageBubble
        message={item}
        characterAvatarUrl={conversation?.character.avatarUrl}
        characterName={conversation?.character.name}
        onRetry={handleRetry}
        onFeedback={handleFeedback}
      />
    );
  };

  // Header "Today" pill at the top of the chat (ListFooterComponent in inverted list)
  const renderListHeader = () => {
    return (
      <View style={styles.todayPillContainer}>
        <View style={styles.todayPill}>
          <Text style={styles.todayPillText}>Today</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isConvLoading || allMessages.length > 0) return null;

    const starters = [
      'Hello! Kaise ho?',
      'Tell me something interesting about you!',
      'I had a long day, tell me a comforting thought.',
    ];

    return (
      <View style={styles.emptyContainer}>
        <Avatar
          uri={conversation?.character.avatarUrl}
          name={conversation?.character.name || 'AI'}
          size="xl"
          style={styles.emptyAvatar}
        />
        <Text style={styles.emptyTitle}>{conversation?.character.name}</Text>
        <Text style={styles.emptyBio}>
          {conversation?.character.tagline ||
            'Ready to converse. Choose a starter below or ask anything.'}
        </Text>

        <View style={styles.startersContainer}>
          <Text style={styles.startersHeader}>Suggested Starters</Text>
          {starters.map((starter, i) => (
            <TouchableOpacity
              key={i}
              style={styles.starterPill}
              onPress={() => handleSendMessage(starter)}
              activeOpacity={0.8}
            >
              <Text style={styles.starterText}>{starter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={{
        uri:
          conversation?.character.coverImageUrl ||
          conversation?.character.avatarUrl ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80',
      }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.backgroundScrim} />

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Top App Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={navigation.goBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerTitleContainer}
            activeOpacity={0.85}
            onPress={() => {
              if (conversation?.character) {
                navigation.navigate('CharacterDetail', {
                  characterId: conversation.character.id,
                });
              }
            }}
          >
            <View style={styles.avatarWrapper}>
              <Avatar
                uri={conversation?.character.avatarUrl}
                name={conversation?.character.name || 'AI'}
                size="sm"
              />
              <View style={styles.onlineBadge} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerName} numberOfLines={1}>
                {conversation?.character.name || 'AI Companion'}
              </Text>
              <View style={styles.statusRow}>
                <Text style={styles.headerStatus}>
                  {isStreaming ? 'Typing...' : 'Online'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Header Right Actions: Call + Menu */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                navigation.navigate('VoiceCall', {
                  characterId,
                  conversationId: activeConversationId || undefined,
                  characterName: conversation?.character.name,
                  characterAvatarUrl: conversation?.character.avatarUrl,
                });
              }}
              activeOpacity={0.7}
            >
              <Icon name="phone" size={20} color="#F43F5E" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setIsMenuVisible(true)}
              activeOpacity={0.7}
            >
              <Icon name="more-vertical" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Stream */}
        {isConvLoading ? (
          <View style={styles.loadingContainer}>
            <Skeleton.Card height={90} />
            <Skeleton.Card height={70} />
            <Skeleton.Card height={100} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={allMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            inverted
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.listContent}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              <>
                {isFetchingNextPage ? (
                  <ActivityIndicator
                    size="small"
                    color="#A78BFA"
                    style={{ marginVertical: 12 }}
                  />
                ) : null}
                {renderListHeader()}
              </>
            }
            ListEmptyComponent={renderEmptyState}
            ListHeaderComponent={
              isStreaming ? (
                <MessageBubble
                  message={{
                    id: streamingMessageId || 'streaming-temp',
                    conversationId: effectiveConvId || '',
                    senderType: 'CHARACTER',
                    role: 'assistant',
                    content: accumulatedDelta || '...',
                    status: 'STREAMING',
                    sequenceNumber: 0,
                    retryCount: 0,
                    parts: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }}
                  characterAvatarUrl={conversation?.character.avatarUrl}
                  characterName={conversation?.character.name}
                  isStreaming
                />
              ) : null
            }
          />
        )}

        {/* Floating Scroll to Bottom Button */}
        {isScrolledUp && (
          <TouchableOpacity
            style={styles.scrollToBottomBtn}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <Icon name="chevron-down-double" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Stream Error Banner */}
        {streamError && (
          <Banner
            type="error"
            message={streamError}
            actionLabel="Retry"
            onAction={() => {
              if (allMessages[0]?.role === 'user') {
                handleSendMessage(allMessages[0].content);
              }
            }}
            onDismiss={() => useChatStreamStore.setState({ error: null })}
          />
        )}

        {/* Bottom Composer Footer */}
        <View style={styles.composerContainer}>
          {isStreaming ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelGeneration}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>■ Stop Generating</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inputRow}>
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Send message to ${companionFirstName}`}
                  placeholderTextColor="#776C90"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={4000}
                  selectionColor="#A78BFA"
                />
              </View>

              {/* Action Button: Gift 🎁 or Send ➔ */}
              {inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.circleActionButton}
                  onPress={() => handleSendMessage()}
                  disabled={isStreaming}
                  activeOpacity={0.8}
                >
                  <Icon name="arrow-up" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.circleActionButton}
                  onPress={() => setIsGiftModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Icon name="gift" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Virtual Gifts Modal */}
        <Modal
          visible={isGiftModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsGiftModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsGiftModalVisible(false)}
          >
            <View style={styles.giftSheetContent}>
              <View style={styles.sheetHandle} />
              <Text style={styles.giftSheetTitle}>Send a Gift to {companionFirstName}</Text>
              <Text style={styles.giftSheetSubtitle}>Make their day special with a token of affection</Text>

              <View style={styles.giftGrid}>
                {VIRTUAL_GIFTS.map((gift) => (
                  <TouchableOpacity
                    key={gift.id}
                    style={styles.giftItem}
                    onPress={() => handleSendGift(gift)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.giftIcon}>{gift.icon}</Text>
                    <Text style={styles.giftName}>{gift.name}</Text>
                    <View style={styles.coinBadge}>
                      <Text style={styles.coinText}>{gift.coins} 🪙</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Options Menu Modal */}
        <Modal
          visible={isMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsMenuVisible(false)}
          >
            <View style={styles.menuSheetContent}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  if (conversation?.character) {
                    navigation.navigate('CharacterDetail', { characterId: conversation.character.id });
                  }
                }}
              >
                <Text style={styles.menuItemText}>View Profile & Lore</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  navigation.navigate('VoiceCall', {
                    characterId,
                    conversationId: activeConversationId || undefined,
                    characterName: conversation?.character.name,
                    characterAvatarUrl: conversation?.character.avatarUrl,
                  });
                }}
              >
                <Text style={styles.menuItemText}>Start Voice Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => setIsMenuVisible(false)}
              >
                <Text style={[styles.menuItemText, { color: '#9CA3AF' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {feedbackTarget && activeConversationId && (
          <MessageFeedbackModal
            visible
            conversationId={activeConversationId}
            messageId={feedbackTarget.messageId}
            initialScore={feedbackTarget.score}
            onClose={() => setFeedbackTarget(null)}
          />
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 18, 0.78)',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(14, 11, 24, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0E0B18',
  },
  headerTextCol: {
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  headerStatus: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callButton: {
    padding: 8,
  },
  menuButton: {
    padding: 6,
  },
  todayPillContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  todayPill: {
    backgroundColor: 'rgba(25, 20, 38, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  todayPillText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
    transform: [{ scaleY: -1 }],
  },
  emptyAvatar: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  emptyBio: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  startersContainer: {
    width: '100%',
    alignItems: 'center',
  },
  startersHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  starterPill: {
    backgroundColor: 'rgba(35, 27, 52, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    marginVertical: 4,
    width: '100%',
    maxWidth: 320,
  },
  starterText: {
    fontSize: 13,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 74,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(32, 25, 48, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  composerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(12, 10, 20, 0.85)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInputWrapper: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: '#1E192B',
    borderColor: '#382B4F',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 8,
  },
  circleActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C3DC7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C3DC7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  giftSheetContent: {
    backgroundColor: '#1C162B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#52436D',
    alignSelf: 'center',
    marginBottom: 16,
  },
  giftSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  giftSheetSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  giftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  giftItem: {
    width: (Dimensions.get('window').width - 64) / 3,
    backgroundColor: '#271F3B',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  giftIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  giftName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  coinBadge: {
    backgroundColor: 'rgba(108, 61, 199, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coinText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D8B4FE',
  },
  menuSheetContent: {
    backgroundColor: '#1E182E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
