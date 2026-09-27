import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Keyboard,
  Platform,
  ActivityIndicator,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageBackground,
  Modal,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import { ChatStreamClient } from '../../services/api/chatStreamClient.js';
import { feedbackApi } from '../../services/api/feedbackApi.js';
import { RelationshipApi } from '../../services/api/relationshipApi.js';
import { billingApi } from '../../services/api/billingApi.js';
import { ModerationApi } from '../../services/api/moderationApi.js';
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
import type { CharacterReportCreateInput } from '@ai-companion/validation';

type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

const getStageDetails = (stage?: string) => {
  switch (stage) {
    case 'STRANGER':
      return {
        label: 'First Spark',
        icon: '🌱',
        level: 'Lvl 1',
        description: 'You are just getting to know each other. Keep chatting to build comfort and familiarity.',
      };
    case 'ACQUAINTANCE':
      return {
        label: 'Casual Friends',
        icon: '💬',
        level: 'Lvl 2',
        description: 'A friendly rapport is developing. You communicate easily with mutual comfort.',
      };
    case 'FRIEND':
      return {
        label: 'Close Friends',
        icon: '🌟',
        level: 'Lvl 3',
        description: 'Strong trust and warm affinity. Conversations are relaxed, open, and authentic.',
      };
    case 'CLOSE_FRIEND':
      return {
        label: 'Deep Companions',
        icon: '✨',
        level: 'Lvl 4',
        description: 'A deep emotional connection with high comfort, care, and mutual vulnerability.',
      };
    case 'CONFIDANT':
      return {
        label: 'Trusted Confidant',
        icon: '💫',
        level: 'Lvl 5',
        description: 'Profound mutual understanding and unconditional emotional support.',
      };
    case 'ROMANTIC_PARTNER':
      return {
        label: 'Romantic Partner',
        icon: '💖',
        level: 'Lvl 6',
        description: 'A devoted romantic bond with heartfelt closeness and tender affection.',
      };
    default:
      return {
        label: 'First Spark',
        icon: '🌱',
        level: 'Lvl 1',
        description: 'Enjoying meaningful conversations and getting to know each other.',
      };
  }
};

const VIRTUAL_GIFTS = [
  { id: 'rose', name: 'Red Rose', icon: '🌹', coins: 10, prompt: '[Sent a Gift: 🌹 Red Rose]' },
  {
    id: 'coffee',
    name: 'Hot Coffee',
    icon: '☕',
    coins: 25,
    prompt: '[Sent a Gift: ☕ Hot Coffee]',
  },
  {
    id: 'chocolates',
    name: 'Chocolates',
    icon: '🍫',
    coins: 50,
    prompt: '[Sent a Gift: 🍫 Box of Belgian Chocolates]',
  },
  {
    id: 'teddy',
    name: 'Teddy Bear',
    icon: '🧸',
    coins: 100,
    prompt: '[Sent a Gift: 🧸 Fluffy Teddy Bear]',
  },
  {
    id: 'star',
    name: 'Cosmic Star',
    icon: '✨',
    coins: 200,
    prompt: '[Sent a Gift: ✨ Glowing Celestial Star]',
  },
  {
    id: 'ring',
    name: 'Diamond Ring',
    icon: '💍',
    coins: 500,
    prompt: '[Sent a Gift: 💍 Sparkling Diamond Ring]',
  },
];

const REPORT_REASONS: Array<{ key: CharacterReportCreateInput['reasonCode']; label: string }> = [
  { key: 'HARASSMENT', label: 'Harassment or Inappropriate Tone' },
  { key: 'SEXUAL_CONTENT', label: 'Explicit Content Violation' },
  { key: 'UNSAFE', label: 'Unsafe / Distress Emergency' },
  { key: 'IMPERSONATION', label: 'Impersonation or Deception' },
  { key: 'OTHER', label: 'Other Safety Concern' },
];

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    characterId,
    conversationId: initialConversationId,
    initialPrompt,
    characterName: routeCharacterName,
    characterAvatarUrl: routeCharacterAvatarUrl,
    characterSlug: routeCharacterSlug,
  } = route.params;

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId || null,
  );
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageItem[]>([]);
  // Failed reply currently being regenerated (hidden while its replacement streams in).
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [isGiftModalVisible, setIsGiftModalVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isBondModalVisible, setIsBondModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] =
    useState<CharacterReportCreateInput['reasonCode']>('HARASSMENT');
  const [reportNotes, setReportNotes] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 60);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const {
    isStreaming,
    accumulatedDelta,
    startStreaming,
    appendDelta,
    finishStreaming,
    setError: setStreamError,
    error: streamError,
  } = useChatStreamStore();

  const [deliveringMap, setDeliveringMap] = useState<
    Record<string, { revealedParagraphs: string[]; isTypingNext: boolean }>
  >({});

  const deliveryTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearDeliveryTimers = () => {
    deliveryTimersRef.current.forEach(t => clearTimeout(t));
    deliveryTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearDeliveryTimers();
      // Leaving mid-reply must not leave the shared "streaming" flag set, or every chat's send
      // button stays frozen. The server keeps generating and saves the reply for when we return.
      if (useChatStreamStore.getState().isStreaming) {
        useChatStreamStore.getState().finishStreaming();
      }
    };
  }, []);

  // 0. Fetch Character Profile (fallback for instant header rendering)
  const { data: characterProfile } = useQuery({
    queryKey: ['discovery', 'character', characterId],
    queryFn: () => DiscoveryApi.getCharacterProfile(characterId),
    enabled: Boolean(characterId),
    staleTime: 1000 * 60 * 10,
  });

  // 1. Resolve or Create Conversation
  const {
    data: conversation,
    isLoading: isConvLoading,
    isError: isConvError,
    refetch: refetchConversation,
  } = useQuery({
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

  const characterName =
    conversation?.character?.name ||
    routeCharacterName ||
    characterProfile?.name ||
    'Ritika Sharma';

  const characterAvatarUrl =
    conversation?.character?.avatarUrl || routeCharacterAvatarUrl || characterProfile?.avatarUrl;

  const characterCoverUrl =
    conversation?.character?.coverImageUrl || characterProfile?.coverImageUrl || characterAvatarUrl;

  const characterTagline =
    conversation?.character?.tagline ||
    characterProfile?.tagline ||
    'Ready to converse. Choose a starter below or ask anything.';

  const characterEffectiveId: string =
    characterId || conversation?.character?.id || characterProfile?.id || '';

  const characterEffectiveSlug =
    routeCharacterSlug || conversation?.character?.slug || characterProfile?.slug;

  const companionFirstName = characterName.split(' ')[0] || 'Companion';

  // 2. Fetch Live Relationship State
  const { data: relationshipData, refetch: refetchRelationship } = useQuery({
    queryKey: ['relationship', characterId],
    queryFn: () => RelationshipApi.getRelationship(characterId),
    enabled: Boolean(characterId),
  });

  // 3. Fetch User Coin Wallet
  const { data: billingState, refetch: refetchBilling } = useQuery({
    queryKey: ['billing-state'],
    queryFn: () => billingApi.getMyBillingState(),
  });

  const walletCoins = billingState?.creditWallet?.availableBalance ?? 500;

  // 4. Fetch Messages with Infinite Cursor Pagination
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isMessagesPending,
    isError: isMessagesError,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ['messages', effectiveConvId],
    queryFn: ({ pageParam }) =>
      ConversationApi.getMessages(effectiveConvId!, {
        cursor: pageParam,
        limit: 30,
        direction: 'before',
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor || undefined,
    enabled: Boolean(effectiveConvId),
  });

  const serverMessages = messagesData?.pages.flatMap(page => page.items) || [];
  const serverMessageIds = new Set(serverMessages.map(m => m.id));
  const serverClientRequestIds = new Set(
    serverMessages.map(m => m.clientRequestId).filter(Boolean),
  );
  const pendingOptimistic = optimisticMessages.filter(
    m => !serverMessageIds.has(m.id) && !serverClientRequestIds.has(m.clientRequestId),
  );
  const allMessages = [
    ...pendingOptimistic,
    ...serverMessages.filter(m => m.id !== retryingMessageId),
  ];

  // 5. Scroll Management
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    setIsScrolledUp(offsetY > 100);
  };

  const scrollToBottom = useCallback(() => {
    if (!isScrolledUp && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isScrolledUp]);

  // The stream store is app-wide: only a stream for *this* conversation may lock this composer.
  const streamingConversationId = useChatStreamStore(st => st.activeConversationId);
  const isStreamingHere =
    isStreaming && (!streamingConversationId || streamingConversationId === effectiveConvId);
  const isAnyDelivering = isStreamingHere || Object.keys(deliveringMap).length > 0;

  useEffect(() => {
    if (isAnyDelivering) {
      scrollToBottom();
    }
  }, [accumulatedDelta, isAnyDelivering, scrollToBottom]);

  // Watchdog: a reply that never resolves (dropped connection, app backgrounded, server restart)
  // must not lock the chat. After 75s, drop the local "typing" state and show the server's truth.
  useEffect(() => {
    if (!isAnyDelivering) return;
    const t = setTimeout(() => {
      clearDeliveryTimers();
      setDeliveringMap({});
      setOptimisticMessages([]);
      setRetryingMessageId(null);
      if (useChatStreamStore.getState().isStreaming) finishStreaming();
      queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
    }, 75_000);
    return () => clearTimeout(t);
  }, [isAnyDelivering, effectiveConvId]);

  // 6. Send Message Handler
  const handleSendMessage = async (textToSend?: string, retryMessageId?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || !effectiveConvId) return;

    if (isAnyDelivering) {
      if (isStreamingHere) {
        // The server is still writing the previous reply (it accepts one at a time): say so,
        // keep the typed text, instead of silently ignoring the tap.
        ToastService.show({ message: `${characterName} is still replying… one moment`, type: 'info', duration: 1800 });
        return;
      }
      // Only the bubble reveal animation is running: finish it instantly and send.
      clearDeliveryTimers();
      setDeliveringMap({});
      setOptimisticMessages([]);
      setRetryingMessageId(null);
      queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
    }

    if (!textToSend) {
      setInputText('');
    }

    const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tempUserMessage: ChatMessageItem = {
      id: `temp-user-${Date.now()}`,
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

    const tempAssistantId = `temp-assist-${Date.now()}`;
    const tempAssistantMessage: ChatMessageItem = {
      id: tempAssistantId,
      conversationId: effectiveConvId,
      senderType: 'CHARACTER',
      role: 'assistant',
      content: '',
      status: 'STREAMING',
      sequenceNumber: (allMessages[0]?.sequenceNumber || 0) + 2,
      retryCount: 0,
      parts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Inverted list: index 0 is assistant (bottom), index 1 is user (above assistant)
    setOptimisticMessages(retryMessageId ? [tempAssistantMessage] : [tempAssistantMessage, tempUserMessage]);
    setRetryingMessageId(retryMessageId ?? null);
    setDeliveringMap({
      [tempAssistantId]: { revealedParagraphs: [], isTypingNext: true },
    });

    clearDeliveryTimers();
    setStreamError(null);

    const abortController = new AbortController();
    startStreaming(effectiveConvId, tempAssistantId, abortController);

    let accumulatedText = '';
    // The server emits message.started only after it has stored the user's message.
    let serverStoredMessage = false;

    const failSend = (message: string) => {
      if (!accumulatedText.trim()) {
        setStreamError(message);
      }
      // Rejected before it was stored (blocked, rate-limited, offline): give the text back so the
      // message is never silently lost.
      if (!serverStoredMessage && !textToSend) {
        setInputText(prev => (prev.trim() ? prev : content));
      }
      clearDeliveryTimers();
      setDeliveringMap({});
      finishStreaming();
      setOptimisticMessages([]);
      setRetryingMessageId(null);
      queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
    };

    try {
      await ChatStreamClient.streamMessage(
        effectiveConvId,
        content,
        clientRequestId,
        {
          onStarted: payload => {
            serverStoredMessage = true;
            setStreamError(null);
            if (payload.messageId) {
              useChatStreamStore.setState({ streamingMessageId: payload.messageId });
            }
          },
          onDelta: payload => {
            setStreamError(null);
            accumulatedText += payload.delta;
            appendDelta(payload.delta);
          },
          onCompleted: payload => {
            setStreamError(null);
            const finalContent =
              payload?.finalContent ||
              accumulatedText ||
              useChatStreamStore.getState().accumulatedDelta ||
              '';
            const paragraphs = finalContent
              .split(/\n\s*\n|\n/)
              .map((s: string) => s.trim())
              .filter(Boolean);

            const safeParagraphs =
              paragraphs.length > 0 ? paragraphs : [finalContent.trim() || '...'];

            const finalizeDelivery = async () => {
              finishStreaming();
              setStreamError(null);
              refetchRelationship();
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              try {
                await queryClient.refetchQueries({ queryKey: ['messages', effectiveConvId] });
              } catch (err) {
                console.warn('Failed to refetch messages after generation:', err);
              }
              setDeliveringMap({});
              setOptimisticMessages([]);
      setRetryingMessageId(null);
            };

            if (safeParagraphs.length === 1) {
              // Single bubble: reveal it immediately
              setDeliveringMap({
                [tempAssistantId]: { revealedParagraphs: safeParagraphs, isTypingNext: false },
              });
              setOptimisticMessages(prev =>
                prev.map(m =>
                  m.id === tempAssistantId
                    ? { ...m, content: safeParagraphs[0], status: 'SENT' }
                    : m,
                ),
              );
              scrollToBottom();

              const t = setTimeout(() => {
                finalizeDelivery();
              }, 300);
              deliveryTimersRef.current.push(t);
            } else if (safeParagraphs.length === 2) {
              // Bubble 1 -> typing dots below -> Bubble 2
              setDeliveringMap({
                [tempAssistantId]: { revealedParagraphs: [safeParagraphs[0]], isTypingNext: true },
              });
              setOptimisticMessages(prev =>
                prev.map(m =>
                  m.id === tempAssistantId ? { ...m, content: safeParagraphs[0] } : m,
                ),
              );
              scrollToBottom();

              const t1 = setTimeout(() => {
                setDeliveringMap({
                  [tempAssistantId]: { revealedParagraphs: safeParagraphs, isTypingNext: false },
                });
                setOptimisticMessages(prev =>
                  prev.map(m =>
                    m.id === tempAssistantId
                      ? { ...m, content: safeParagraphs.join('\n'), status: 'SENT' }
                      : m,
                  ),
                );
                scrollToBottom();

                const t2 = setTimeout(() => {
                  finalizeDelivery();
                }, 300);
                deliveryTimersRef.current.push(t2);
              }, 1200);
              deliveryTimersRef.current.push(t1);
            } else {
              // 3 Bubbles: Bubble 1 -> typing dots -> Bubble 2 -> typing dots -> Bubble 3
              setDeliveringMap({
                [tempAssistantId]: { revealedParagraphs: [safeParagraphs[0]], isTypingNext: true },
              });
              setOptimisticMessages(prev =>
                prev.map(m =>
                  m.id === tempAssistantId ? { ...m, content: safeParagraphs[0] } : m,
                ),
              );
              scrollToBottom();

              const t1 = setTimeout(() => {
                setDeliveringMap({
                  [tempAssistantId]: {
                    revealedParagraphs: [safeParagraphs[0], safeParagraphs[1]],
                    isTypingNext: true,
                  },
                });
                setOptimisticMessages(prev =>
                  prev.map(m =>
                    m.id === tempAssistantId
                      ? { ...m, content: `${safeParagraphs[0]}\n${safeParagraphs[1]}` }
                      : m,
                  ),
                );
                scrollToBottom();

                const t2 = setTimeout(() => {
                  setDeliveringMap({
                    [tempAssistantId]: { revealedParagraphs: safeParagraphs, isTypingNext: false },
                  });
                  setOptimisticMessages(prev =>
                    prev.map(m =>
                      m.id === tempAssistantId
                        ? { ...m, content: safeParagraphs.join('\n'), status: 'SENT' }
                        : m,
                    ),
                  );
                  scrollToBottom();

                  const t3 = setTimeout(() => {
                    finalizeDelivery();
                  }, 300);
                  deliveryTimersRef.current.push(t3);
                }, 1200);
                deliveryTimersRef.current.push(t2);
              }, 1200);
              deliveryTimersRef.current.push(t1);
            }
          },
          onFailed: payload => {
            failSend(payload.errorMessage);
          },
          onCancelled: () => {
            clearDeliveryTimers();
            setDeliveringMap({});
            finishStreaming();
            setOptimisticMessages([]);
      setRetryingMessageId(null);
            queryClient.invalidateQueries({ queryKey: ['messages', effectiveConvId] });
          },
        },
        abortController.signal,
        retryMessageId,
      );
    } catch (err: any) {
      failSend(err?.message || 'Message could not be sent. Please try again.');
    }
  };

  const handleRetry = (content: string, message?: ChatMessageItem) => {
    // A failed *reply* is regenerated in place; only a user's own unsent message is re-sent.
    if (message && message.role === 'assistant') {
      handleSendMessage(content, message.id);
      return;
    }
    handleSendMessage(content);
  };

  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; score: 1 | -1 } | null>(
    null,
  );
  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    if (!activeConversationId) return;
    if (rating === 'negative') {
      setFeedbackTarget({ messageId, score: -1 });
      return;
    }
    try {
      await feedbackApi.submitMessageFeedback(activeConversationId, messageId, {
        rating: 'THUMBS_UP',
      });
      ToastService.show({
        message: 'Thank you for your feedback!',
        type: 'success',
        duration: 2000,
      });
    } catch {
      ToastService.show({
        message: 'Could not send feedback. Please try again.',
        type: 'error',
        duration: 2500,
      });
    }
  };

  const handleSendGift = (gift: (typeof VIRTUAL_GIFTS)[0]) => {
    setIsGiftModalVisible(false);
    handleSendMessage(gift.prompt);
    ToastService.show({
      message: `Sent ${gift.name}! +${Math.round(gift.coins / 5)} Intimacy points`,
      type: 'success',
      duration: 2500,
    });
    refetchBilling();
    refetchRelationship();
  };

  const handleResetRelationship = () => {
    setIsMenuVisible(false);
    Alert.alert(
      'Reset Relationship',
      `Are you sure you want to reset your relationship history with ${characterName} back to baseline?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await RelationshipApi.resetRelationship(characterEffectiveId);
              refetchRelationship();
              ToastService.show({
                message: 'Relationship reset to baseline.',
                type: 'info',
                duration: 2500,
              });
            } catch {
              ToastService.show({
                message: 'Failed to reset relationship.',
                type: 'error',
                duration: 2500,
              });
            }
          },
        },
      ],
    );
  };

  const handleReportCharacter = async () => {
    setIsReportModalVisible(false);
    try {
      await ModerationApi.submitReport({
        characterId,
        reasonCode: reportReason,
        details:
          reportNotes.trim().length >= 10
            ? reportNotes.trim()
            : `User reported character for ${reportReason} from chat screen`,
      });
      ToastService.show({
        message: 'Report submitted. Our safety team will review it.',
        type: 'success',
        duration: 3000,
      });
    } catch {
      ToastService.show({ message: 'Could not submit report.', type: 'error', duration: 2500 });
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessageItem }) => {
    const delivery = deliveringMap[item.id];
    const isStreamingItem = item.status === 'STREAMING' || Boolean(delivery?.isTypingNext);

    return (
      <MessageBubble
        message={item}
        characterAvatarUrl={characterAvatarUrl}
        characterName={characterName}
        isStreaming={isStreamingItem}
        revealedParagraphs={delivery?.revealedParagraphs}
        isTypingNext={delivery?.isTypingNext}
        onRetry={handleRetry}
        onFeedback={handleFeedback}
      />
    );
  };

  // Header "Today" pill at the top of the chat (ListFooterComponent in inverted list)
  const renderListHeader = () => {
    // Inverted list: the last item is the oldest loaded message, which this pill sits above.
    const oldest = allMessages[allMessages.length - 1];
    if (!oldest?.createdAt) return null;
    const d = new Date(oldest.createdAt);
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
    const label =
      days <= 0
        ? 'Today'
        : days === 1
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
    return (
      <View style={styles.todayPillContainer}>
        <View style={styles.todayPill}>
          <Text style={styles.todayPillText}>{label}</Text>
        </View>
      </View>
    );
  };

  // Distinct screen states: never show the "new chat" screen while history is still loading or
  // failed to load (that looked like the conversation had vanished).
  const hasHistoryLoaded = Boolean(messagesData);
  const isHistoryLoading = isConvLoading || (Boolean(effectiveConvId) && isMessagesPending && !hasHistoryLoaded);
  const isHistoryError = (isConvError && !conversation) || (Boolean(effectiveConvId) && isMessagesError && !hasHistoryLoaded);

  const renderEmptyState = () => {
    if (isHistoryLoading || allMessages.length > 0) return null;

    const starters = [
      'Hello! Kaise ho?',
      'Tell me something interesting about you!',
      'I had a long day, tell me a comforting thought.',
    ];

    return (
      <View style={styles.emptyContainer}>
        <Avatar
          uri={characterAvatarUrl}
          name={characterName}
          size="xl"
          style={styles.emptyAvatar}
        />
        <Text style={styles.emptyTitle}>{characterName}</Text>
        <Text style={styles.emptyBio}>{characterTagline}</Text>

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

  const relationshipStage = relationshipData?.stage || 'STRANGER';
  const stageInfo = getStageDetails(relationshipStage);
  const intimacyPercent = relationshipData
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (relationshipData.familiarity +
              relationshipData.trust +
              relationshipData.comfort +
              relationshipData.affection +
              relationshipData.engagement) /
              5,
          ),
        ),
      )
    : 20;

  return (
    <ImageBackground
      source={{
        uri:
          characterCoverUrl ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80',
      }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.backgroundScrim} />

      <View
        style={[
          styles.container,
          {
            paddingBottom:
              Platform.OS === 'ios'
                ? keyboardHeight > 0
                  ? keyboardHeight
                  : Math.max(insets.bottom, 8)
                : keyboardHeight > 0
                  ? 4
                  : Math.max(insets.bottom, 8),
          },
        ]}
      >
        {/* Top App Bar with safe area paddingTop */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 4 : 12 }]}>
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
              if (characterEffectiveId) {
                navigation.navigate('CharacterDetail', {
                  characterId: characterEffectiveId,
                  characterSlug: characterEffectiveSlug,
                });
              }
            }}
          >
            <View style={styles.avatarWrapper}>
              <Avatar uri={characterAvatarUrl} name={characterName} size="sm" />
              <View style={styles.onlineBadge} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerName} numberOfLines={1}>
                {characterName}
              </Text>
              <Text style={styles.headerStatus}>{isAnyDelivering ? 'Typing...' : 'Online'}</Text>
            </View>
          </TouchableOpacity>

          {/* Header Right Actions: Call + Menu */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                navigation.navigate('VoiceCall', {
                  characterId: characterEffectiveId,
                  conversationId: activeConversationId || undefined,
                  characterName: characterName,
                  characterAvatarUrl: characterAvatarUrl,
                });
              }}
              activeOpacity={0.7}
            >
              <Icon name="phone" size={20} color="#C084FC" />
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

        {/* Top Disclaimer & Floating Action Pill */}
        <View style={styles.topNoticeContainer}>
          <Text style={styles.aiDisclaimerText}>
            ⓘ Messages are generated by AI. Some may be inaccurate
          </Text>

          <View style={styles.askPhotosPill}>
            <View style={styles.photosIconRow}>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </View>
            <View style={styles.askPhotosTextCol}>
              <Text style={styles.askPhotosTitle}>Ask for photos anytime.</Text>
              <Text style={styles.askPhotosSubtitle}>Your AI friend can send them. Try now!</Text>
            </View>
          </View>
        </View>

        {/* Message Stream */}
        {isHistoryLoading ? (
          <View style={styles.loadingContainer}>
            <Skeleton.Card height={90} />
            <Skeleton.Card height={70} />
            <Skeleton.Card height={100} />
          </View>
        ) : isHistoryError ? (
          <View style={styles.historyErrorContainer}>
            <Text style={styles.historyErrorTitle}>Couldn't load this chat</Text>
            <Text style={styles.historyErrorText}>Check your connection and try again.</Text>
            <TouchableOpacity
              style={styles.historyErrorButton}
              onPress={() => {
                if (!conversation) refetchConversation();
                else refetchMessages();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.historyErrorButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : allMessages.length === 0 ? (
          // Rendered outside the inverted list: an inverted FlatList flips its empty component,
          // which is why the welcome text appeared mirrored.
          <ScrollView contentContainerStyle={styles.emptyScrollContent} keyboardShouldPersistTaps="handled">
            {renderEmptyState()}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={allMessages}
            keyExtractor={item => item.id}
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
                  <ActivityIndicator size="small" color="#A78BFA" style={{ marginVertical: 12 }} />
                ) : null}
                {renderListHeader()}
              </>
            }
            ListHeaderComponent={null}
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
        {streamError &&
          (!allMessages[0] ||
            allMessages[0].role !== 'assistant' ||
            allMessages[0].status === 'FAILED') && (
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
        <View
          style={[
            styles.composerContainer,
            {
              paddingBottom:
                Platform.OS === 'ios'
                  ? keyboardHeight > 0
                    ? keyboardHeight
                    : Math.max(insets.bottom, 12)
                  : keyboardHeight > 0
                    ? 8
                    : Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.inputRow}>
            {/* Pill Container */}
            <View style={styles.pillInputContainer}>
              <TouchableOpacity
                style={styles.pillLeadingBtn}
                onPress={() => {
                  setInputText(prev => (prev ? `${prev} 😊` : '😊 '));
                }}
                activeOpacity={0.7}
                accessibilityLabel="Emoji"
              >
                <Text style={styles.pillEmojiIcon}>😊</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder={`Message ${companionFirstName}...`}
                placeholderTextColor="#8E85A8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={4000}
                selectionColor="#A78BFA"
              />

              <TouchableOpacity
                style={styles.pillTrailingBtn}
                onPress={() => setIsGiftModalVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Send gift or spark"
              >
                <Icon name="sparkles" size={18} color="#C084FC" />
              </TouchableOpacity>
            </View>

            {/* Circular Action Button */}
            {inputText.trim().length > 0 ? (
              <TouchableOpacity
                style={[styles.circleActionButton, isStreamingHere && { opacity: 0.45 }]}
                onPress={() => handleSendMessage()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ busy: isStreamingHere }}
                accessibilityLabel={isStreamingHere ? `${characterName} is replying` : 'Send message'}
              >
                <Icon name="arrow-up" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.circleActionButton, styles.giftCircleButton]}
                onPress={() => setIsGiftModalVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send gift"
              >
                <Text style={styles.giftActionEmoji}>🎁</Text>
              </TouchableOpacity>
            )}
          </View>
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
              <Text style={styles.giftSheetSubtitle}>
                🪙 {walletCoins.toLocaleString()} Coins Available
              </Text>

              <View style={styles.giftGrid}>
                {VIRTUAL_GIFTS.map(gift => (
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
                  setTimeout(() => setIsBondModalVisible(true), 150);
                }}
              >
                <Text style={styles.menuItemText}>
                  {stageInfo.icon} Chemistry & Bond ({intimacyPercent}%)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  if (characterEffectiveId) {
                    navigation.navigate('CharacterDetail', {
                      characterId: characterEffectiveId,
                      characterSlug: characterEffectiveSlug,
                    });
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
                    characterId: characterEffectiveId,
                    conversationId: activeConversationId || undefined,
                    characterName: characterName,
                    characterAvatarUrl: characterAvatarUrl,
                  });
                }}
              >
                <Text style={styles.menuItemText}>Start Voice Call</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleResetRelationship}>
                <Text style={[styles.menuItemText, { color: '#F87171' }]}>
                  Reset Relationship to Baseline
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  setTimeout(() => setIsReportModalVisible(true), 150);
                }}
              >
                <Text style={[styles.menuItemText, { color: '#FBBF24' }]}>
                  Report Character Behavior
                </Text>
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

        {/* Bond & Chemistry Modal */}
        <Modal
          visible={isBondModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsBondModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsBondModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.bondSheetContent}
              onPress={e => e.stopPropagation()}
            >
              {/* Header */}
              <View style={styles.bondHeader}>
                <Avatar uri={characterAvatarUrl} name={characterName} size="md" />
                <View style={styles.bondHeaderTextCol}>
                  <Text style={styles.bondTitle}>{characterName}</Text>
                  <View style={styles.bondStageBadge}>
                    <Text style={styles.bondStageBadgeText}>
                      {stageInfo.icon} {stageInfo.level} · {stageInfo.label}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.bondDescription}>{stageInfo.description}</Text>

              {/* Main Intimacy Meter */}
              <View style={styles.bondMeterCard}>
                <View style={styles.bondMeterHeader}>
                  <Text style={styles.bondMeterLabel}>Connection Level</Text>
                  <Text style={styles.bondMeterValue}>{intimacyPercent}%</Text>
                </View>
                <View style={styles.bondProgressBarBg}>
                  <View style={[styles.bondProgressBarFill, { width: `${intimacyPercent}%` }]} />
                </View>
              </View>

              {/* Dimensions Breakdown */}
              <View style={styles.bondDimensionsContainer}>
                <View style={styles.bondDimensionRow}>
                  <Text style={styles.bondDimensionName}>🧠 Familiarity</Text>
                  <View style={styles.bondMiniBarBg}>
                    <View
                      style={[
                        styles.bondMiniBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, relationshipData?.familiarity || 0))}%`,
                          backgroundColor: '#818CF8',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bondDimensionVal}>{relationshipData?.familiarity || 0}%</Text>
                </View>

                <View style={styles.bondDimensionRow}>
                  <Text style={styles.bondDimensionName}>🤝 Trust</Text>
                  <View style={styles.bondMiniBarBg}>
                    <View
                      style={[
                        styles.bondMiniBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, relationshipData?.trust || 20))}%`,
                          backgroundColor: '#34D399',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bondDimensionVal}>{relationshipData?.trust || 20}%</Text>
                </View>

                <View style={styles.bondDimensionRow}>
                  <Text style={styles.bondDimensionName}>🛋️ Comfort</Text>
                  <View style={styles.bondMiniBarBg}>
                    <View
                      style={[
                        styles.bondMiniBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, relationshipData?.comfort || 20))}%`,
                          backgroundColor: '#38BDF8',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bondDimensionVal}>{relationshipData?.comfort || 20}%</Text>
                </View>

                <View style={styles.bondDimensionRow}>
                  <Text style={styles.bondDimensionName}>❤️ Affection</Text>
                  <View style={styles.bondMiniBarBg}>
                    <View
                      style={[
                        styles.bondMiniBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, relationshipData?.affection || 10))}%`,
                          backgroundColor: '#F472B6',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bondDimensionVal}>{relationshipData?.affection || 10}%</Text>
                </View>

                <View style={styles.bondDimensionRow}>
                  <Text style={styles.bondDimensionName}>⚡ Engagement</Text>
                  <View style={styles.bondMiniBarBg}>
                    <View
                      style={[
                        styles.bondMiniBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, relationshipData?.engagement || 50))}%`,
                          backgroundColor: '#FBBF24',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bondDimensionVal}>{relationshipData?.engagement || 50}%</Text>
                </View>
              </View>

              {/* Tip box */}
              <View style={styles.bondTipBox}>
                <Text style={styles.bondTipText}>
                  💡 Chat daily and share stories to level up your bond and unlock deeper responses.
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.bondActionsRow}>
                <TouchableOpacity
                  style={styles.bondResetBtn}
                  onPress={() => {
                    setIsBondModalVisible(false);
                    handleResetRelationship();
                  }}
                >
                  <Text style={styles.bondResetBtnText}>Reset Baseline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bondCloseBtn}
                  onPress={() => setIsBondModalVisible(false)}
                >
                  <Text style={styles.bondCloseBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Moderation Report Modal */}
        <Modal
          visible={isReportModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsReportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.reportSheetContent}>
              <Text style={styles.reportTitle}>Report Inappropriate Content</Text>
              <Text style={styles.reportSubtitle}>
                Help us keep our community safe and compliant.
              </Text>

              <View style={styles.reportReasonList}>
                {REPORT_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason.key}
                    style={[
                      styles.reportReasonItem,
                      reportReason === reason.key && styles.reportReasonItemSelected,
                    ]}
                    onPress={() => setReportReason(reason.key)}
                  >
                    <Text
                      style={[
                        styles.reportReasonText,
                        reportReason === reason.key && styles.reportReasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.reportInput}
                placeholder="Optional details for moderation team..."
                placeholderTextColor="#6B7280"
                value={reportNotes}
                onChangeText={setReportNotes}
                multiline
              />

              <View style={styles.reportActionRow}>
                <TouchableOpacity
                  style={styles.reportCancelBtn}
                  onPress={() => setIsReportModalVisible(false)}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportSubmitBtn} onPress={handleReportCharacter}>
                  <Text style={styles.reportSubmitText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {feedbackTarget && activeConversationId && (
          <MessageFeedbackModal
            visible={Boolean(feedbackTarget)}
            conversationId={activeConversationId}
            messageId={feedbackTarget.messageId}
            initialScore={feedbackTarget.score}
            onClose={() => setFeedbackTarget(null)}
            onSuccess={() => {
              setFeedbackTarget(null);
              ToastService.show({
                message: 'Thank you for your detailed feedback!',
                type: 'success',
                duration: 2500,
              });
            }}
          />
        )}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  historyErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  historyErrorTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  historyErrorText: { color: '#A1A1AA', fontSize: 14, textAlign: 'center' },
  historyErrorButton: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
  },
  historyErrorButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  emptyScrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  backgroundImage: {
    flex: 1,
    backgroundColor: '#07050E',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 5, 14, 0.72)',
  },
  topNoticeContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  aiDisclaimerText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    marginBottom: 8,
  },
  askPhotosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 16, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.28)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  photosIconRow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askPhotosTextCol: {
    flex: 1,
  },
  askPhotosTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  askPhotosSubtitle: {
    fontSize: 10.5,
    color: '#C084FC',
    marginTop: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 11, 24, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 12,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F0B18',
  },
  headerTextCol: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  headerStatus: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
  relationshipBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  relationshipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E9D5FF',
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  todayPill: {
    backgroundColor: 'rgba(30, 23, 46, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  todayPillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  emptyBio: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.lg,
    maxWidth: 290,
  },
  startersContainer: {
    width: '100%',
    alignItems: 'center',
  },
  startersHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  starterPill: {
    backgroundColor: 'rgba(28, 22, 43, 0.85)',
    borderColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.xl,
    marginVertical: 4,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  starterText: {
    fontSize: 13,
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '500',
  },
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1730',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  composerContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(11, 8, 18, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  pillInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#191328',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 10,
  },
  pillLeadingBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillEmojiIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  pillTrailingBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 0,
  },
  giftCircleButton: {
    backgroundColor: '#2D1B4E',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
    shadowColor: '#7C3AED',
  },
  giftActionEmoji: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  giftSheetContent: {
    backgroundColor: '#140E24',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#4C3B6B',
    alignSelf: 'center',
    marginBottom: 18,
  },
  giftSheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  giftSheetSubtitle: {
    fontSize: 13,
    color: '#D8B4FE',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 22,
  },
  giftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  giftItem: {
    width: (Dimensions.get('window').width - 64) / 3,
    backgroundColor: '#201736',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  giftIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  giftName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  coinBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  coinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  menuSheetContent: {
    backgroundColor: '#161026',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportSheetContent: {
    backgroundColor: '#161026',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  reportTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 18,
  },
  reportReasonList: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  reportReasonItem: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#201736',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reportReasonItemSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
  },
  reportReasonText: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  reportReasonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reportInput: {
    backgroundColor: '#0F0B1A',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 65,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  reportCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  reportCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  reportSubmitBtn: {
    backgroundColor: '#9333EA',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  reportSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bondSheetContent: {
    backgroundColor: '#161026',
    borderRadius: 24,
    padding: 22,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: 420,
    width: '90%',
    alignSelf: 'center',
  },
  bondHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  bondHeaderTextCol: {
    flex: 1,
    gap: 4,
  },
  bondTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bondStageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  bondStageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  bondDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  bondMeterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bondMeterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bondMeterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  bondMeterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C084FC',
  },
  bondProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  bondProgressBarFill: {
    height: '100%',
    backgroundColor: '#9333EA',
    borderRadius: 4,
  },
  bondDimensionsContainer: {
    gap: 9,
    marginBottom: 14,
  },
  bondDimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bondDimensionName: {
    fontSize: 12,
    color: '#CBD5E1',
    width: 105,
    fontWeight: '500',
  },
  bondMiniBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  bondMiniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bondDimensionVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    width: 32,
    textAlign: 'right',
  },
  bondTipBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  bondTipText: {
    fontSize: 11,
    color: '#D8B4FE',
    lineHeight: 16,
  },
  bondActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bondResetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  bondResetBtnText: {
    fontSize: 12,
    color: '#F87171',
    fontWeight: '600',
  },
  bondCloseBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  bondCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
