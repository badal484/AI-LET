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
  IconButton,
  Avatar,
  MessageBubble,
  Banner,
  Skeleton,
  ToastService,
} from '../../components/common/index.js';
import { MessageFeedbackModal } from '../../components/chat/MessageFeedbackModal.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { ChatMessageItem, ConversationDetail } from '@ai-companion/types';

type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

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

  // Flatten server messages (reverse order for inverted list)
  const serverMessages = messagesData?.pages.flatMap((page) => page.items) || [];

  // Combine optimistic messages with server messages (filtering out reconciled messages)
  const serverMessageIds = new Set(serverMessages.map((m) => m.id));
  const pendingOptimistic = optimisticMessages.filter((m) => !serverMessageIds.has(m.id));
  const allMessages = [...pendingOptimistic, ...serverMessages];

  // 3. Scroll Management
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    // In inverted FlatList, offsetY > 100 means user scrolled up away from latest messages
    setIsScrolledUp(offsetY > 100);
  };

  const scrollToBottom = useCallback(() => {
    if (!isScrolledUp && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isScrolledUp]);

  // Auto-scroll when new streaming chunks arrive
  useEffect(() => {
    if (isStreaming) {
      scrollToBottom();
    }
  }, [accumulatedDelta, isStreaming, scrollToBottom]);

  // 4. Send Message Handler
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || !effectiveConvId || isStreaming) return;

    setInputText('');
    const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create Optimistic User Message
    const tempUserMsg: ChatMessageItem = {
      id: `opt-${Date.now()}`,
      conversationId: effectiveConvId,
      senderType: 'USER',
      role: 'user',
      content,
      status: 'SENT',
      clientRequestId,
      sequenceNumber: (allMessages[0]?.sequenceNumber || 0) + 1,
      retryCount: 0,
      parts: [{ id: `part-${Date.now()}`, partType: 'text', content, orderIndex: 0 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [tempUserMsg, ...prev]);

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

  // 5. Cancel Stream
  const handleCancelGeneration = async () => {
    if (effectiveConvId && streamingMessageId) {
      cancelStreaming();
      try {
        await ConversationApi.cancelGeneration(effectiveConvId, streamingMessageId);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
    }
  };

  // 6. Retry Failed Message
  const handleRetry = (content: string) => {
    handleSendMessage(content);
  };

  // 7. Feedback: thumbs-up is saved immediately; thumbs-down opens the modal to capture why.
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

  // 8. Render Individual Message Bubble
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

  // 9. Empty Conversation State with Starter Prompts
  const renderEmptyState = () => {
    if (isConvLoading || allMessages.length > 0) return null;

    const starters = [
      'Tell me something fascinating about your world.',
      'How are you feeling today?',
      'Let’s explore a creative idea together.',
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      {/* Chat Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={navigation.goBack}
          accessibilityLabel="Back to previous screen"
        />

        <TouchableOpacity
          style={styles.headerTitleContainer}
          activeOpacity={0.8}
          onPress={() => {
            if (conversation?.character) {
              navigation.navigate('CharacterDetail', {
                characterId: conversation.character.id,
              });
            }
          }}
          accessibilityLabel={`View ${conversation?.character.name || 'companion'} details`}
        >
          <Avatar
            uri={conversation?.character.avatarUrl}
            name={conversation?.character.name || 'AI'}
            size="sm"
            presence={isStreaming ? 'speaking' : 'online'}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerName}>
              {conversation?.character.name || 'AI Companion'}
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerStatus}>
                {isStreaming ? 'Thinking...' : 'Active'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Voice Call Action */}
        <IconButton
          icon="phone"
          size="sm"
          variant="surface"
          onPress={() => {
            navigation.navigate('VoiceCall', {
              characterId,
              conversationId: activeConversationId || undefined,
              characterName: conversation?.character.name,
              characterAvatarUrl: conversation?.character.avatarUrl,
            });
          }}
          accessibilityLabel="Start voice call"
        />
      </View>

      {/* Main Message Stream */}
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
            isFetchingNextPage ? (
              <ActivityIndicator
                size="small"
                color={darkThemeColors.accent}
                style={{ marginVertical: 12 }}
              />
            ) : null
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

      {/* Message Composer Footer */}
      <View style={styles.composerContainer}>
        {isStreaming ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelGeneration}
            accessibilityRole="button"
            accessibilityLabel="Stop generating response"
          >
            <Text style={styles.cancelButtonText}>■ Stop Generating</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Message your companion..."
              placeholderTextColor={darkThemeColors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={4000}
              selectionColor={darkThemeColors.accent}
            />
            <IconButton
              icon="send"
              size="md"
              variant="accent"
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isStreaming}
              accessibilityLabel="Send message"
            />
          </View>
        )}
      </View>

      {feedbackTarget && activeConversationId && (
        <MessageFeedbackModal
          visible
          conversationId={activeConversationId}
          messageId={feedbackTarget.messageId}
          initialScore={feedbackTarget.score}
          onClose={() => setFeedbackTarget(null)}
          onSuccess={() => ToastService.show({ message: 'Thanks for the feedback.', type: 'success', duration: 2000 })}
        />
      )}
    </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
    backgroundColor: darkThemeColors.backgroundSecondary,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: spacing.xs,
  },
  headerAvatar: {
    marginRight: spacing.sm,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: darkThemeColors.success,
    marginRight: 4,
  },
  headerStatus: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
    transform: [{ scaleY: -1 }], // Counteracts inverted FlatList
  },
  emptyAvatar: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  emptyBio: {
    fontSize: 13,
    color: darkThemeColors.textMuted,
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
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  starterPill: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderColor: darkThemeColors.borderSubtle,
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
    color: darkThemeColors.textSecondary,
    textAlign: 'center',
  },
  composerContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: darkThemeColors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: darkThemeColors.surface,
    borderColor: darkThemeColors.borderSubtle,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: darkThemeColors.textPrimary,
    fontSize: 15,
    marginRight: spacing.xs,
  },
  cancelButton: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderColor: darkThemeColors.danger,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: darkThemeColors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
});
