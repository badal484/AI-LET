import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Animated,
  Platform,
  Clipboard,
  PanResponder,
  Vibration,
} from 'react-native';
import { Avatar } from './Avatar.js';
import { ToastService } from './Toast.js';
import { Icon } from './Icon.js';
import { darkThemeColors, radius } from '../../theme/index.js';
import type { ChatMessageItem } from '@ai-companion/types';
import { messageTime } from '../../utils/chatDates.js';
import { withInlineCode } from '../../utils/inlineCode.js';
import { useReduceMotion } from '../../utils/motion.js';

/** A line that is clearly code (for code people paste without ``` fences). */
const CODE_LINE = /^\s*(import |from \S+ import |def |class |const |let |var |function |return |if \(|for \(|while \(|async |await |print\(|console\.log\()|[;{}]\s*$|\)\s*:\s*$|^\s*[\w.]+\s*=\s*[\w.]+\(|^\s*(Traceback|File ".+", line \d+|\w+Error:)/;

export interface MessageBubbleProps {
  message: ChatMessageItem;
  characterAvatarUrl?: string | null;
  characterName?: string;
  isStreaming?: boolean;
  revealedParagraphs?: string[];
  isTypingNext?: boolean;
  /** Second argument: the bubble's message, so a failed reply can be regenerated in place. */
  onRetry?: (content: string, message?: ChatMessageItem) => void;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => void;
  onSelectMedia?: (mediaUrl: string) => void;
  /** Swipe right / long-press "Reply": answer this specific message (WhatsApp-style). */
  onReply?: (message: ChatMessageItem) => void;
  /** Tap a quote to jump to the original message. */
  onQuotePress?: (messageId: string) => void;
  /** Briefly highlighted after jumping to it from a quote. */
  highlighted?: boolean;
  /**
   * Where it sits in a run of messages from the same person (like WhatsApp/iMessage): only the first gets
   * space above it; only the last shows the avatar, the time and the tail.
   */
  group?: { first: boolean; last: boolean };
}

/** Only messages that just arrived animate in — opening a chat doesn't replay the whole history. */
const FRESH_MS = 6_000;

const TypingDotsIndicator: React.FC = () => {
  const dot1 = React.useRef(new Animated.Value(0.3)).current;
  const dot2 = React.useRef(new Animated.Value(0.3)).current;
  const dot3 = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const createAnim = (dot: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          ]),
        ),
      ]);

    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 180);
    const a3 = createAnim(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot3, transform: [{ scale: dot3 }] }]} />
    </View>
  );
};

const MessageBubbleBase: React.FC<MessageBubbleProps> = ({
  message,
  characterAvatarUrl,
  characterName,
  isStreaming = false,
  revealedParagraphs,
  isTypingNext = false,
  onRetry,
  onFeedback,
  onReply,
  onQuotePress,
  highlighted,
  group = { first: true, last: true },
}) => {
  const [showActions, setShowActions] = useState(false);
  const reduceMotion = useReduceMotion();
  const isUser = message.role === 'user' || message.senderType === 'USER';
  const isFailed = message.status === 'FAILED';
  const isCancelled = message.status === 'CANCELLED';

  // The server stores each of her short messages separately, so one message = one bubble; line breaks
  // inside a message (e.g. a plan's lines) stay together in that bubble.
  const paragraphsToRender = revealedParagraphs && revealedParagraphs.length > 0
    ? revealedParagraphs
    : [message.content].filter(Boolean);

  const isInitialTyping = isStreaming && paragraphsToRender.length === 0;

  const looksLikePastedCode = (text: string) => {
    const lines = text.split('\n');
    return lines.length >= 3 && lines.filter((l) => CODE_LINE.test(l)).length >= 2;
  };

  // Code arrives as its own message ("```python\n…\n```"): shown exactly as written, with a Copy button.
  const copyCode = (code: string) => {
    Clipboard.setString(code);
    ToastService.show({ message: 'Code copied', type: 'info', duration: 1500 });
  };

  const handleCopy = async () => {
    try {
      await Share.share({
        message: message.content,
      });
      ToastService.show({ message: 'Message copied', type: 'info', duration: 1500 });
    } catch {
      // Ignored
    }
    setShowActions(false);
  };

  const formattedTime = message.createdAt ? messageTime(message.createdAt) : '';

  // Swipe right to reply (like WhatsApp). Only real, stored messages can be quoted.
  const canReply = Boolean(onReply) && !isStreaming && !isFailed && !/^(temp-|crisis-)/.test(message.id);
  const replyRef = React.useRef<(() => void) | null>(null);
  replyRef.current = canReply ? () => onReply?.(message) : null;
  const swipeX = React.useRef(new Animated.Value(0)).current;
  const swipe = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_e, g) => swipeX.setValue(Math.max(0, Math.min(g.dx, 72))),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 52 && replyRef.current) {
          try {
            Vibration.vibrate(10);
          } catch {
            // Ignore haptic error
          }
          replyRef.current();
        }
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  const replyTo = message.replyTo;

  // Entry: a soft rise + fade + scale for messages that just arrived (yours springs in from the right).
  const fresh = React.useRef(
    !reduceMotion && (isStreaming || (message.createdAt ? Date.now() - new Date(message.createdAt).getTime() < FRESH_MS : false)),
  ).current;
  const enter = React.useRef(new Animated.Value(fresh ? 0 : 1)).current;
  React.useEffect(() => {
    if (!fresh) return;
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: isUser ? 7 : 4 }).start();
  }, [enter, fresh, isUser]);

  const showAvatar = !isUser && group.last;

  return (
    <Animated.View
      {...(canReply ? swipe.panHandlers : {})}
      style={[
        {
          opacity: enter,
          transform: [
            { translateX: swipeX },
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [isUser ? 18 : -8, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
        styles.messageRow,
        { marginTop: group.first ? 10 : 2, marginBottom: group.last ? 2 : 0 },
        isUser ? styles.userRow : styles.assistantRow,
      ]}
    >
      {!isUser &&
        (showAvatar ? (
          <Avatar uri={characterAvatarUrl} name={characterName || '?'} size="sm" style={styles.avatar} />
        ) : (
          <View style={styles.avatarSpacer} />
        ))}

      <View style={styles.bubbleContainer}>
        {isInitialTyping ? (
          <View
            style={[
              styles.bubble,
              styles.assistantBubble,
              styles.streamingBubble,
              styles.typingBubble,
            ]}
          >
            <TypingDotsIndicator />
          </View>
        ) : (
          <View style={styles.bubblesStack}>
            {paragraphsToRender.map((paragraph, pIdx, arr) => (
              <TouchableOpacity
                key={pIdx}
                activeOpacity={0.9}
                onLongPress={() => setShowActions((prev) => !prev)}
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.assistantBubble,
                  // Grouped shape: the side facing the sender is tight between bubbles; the tail is on the last.
                  isUser
                    ? { borderTopRightRadius: group.first && pIdx === 0 ? 20 : 6, borderBottomRightRadius: group.last && pIdx === arr.length - 1 ? 4 : 6 }
                    : { borderTopLeftRadius: group.first && pIdx === 0 ? 20 : 6, borderBottomLeftRadius: group.last && pIdx === arr.length - 1 ? 4 : 6 },
                  isFailed && styles.failedBubble,
                  isStreaming && styles.streamingBubble,
                  highlighted && styles.highlightBubble,
                  ((arr.length > 1 && pIdx < arr.length - 1) || isTypingNext) && { marginBottom: 6 },
                ]}
                accessibilityRole="text"
                accessibilityLabel={`${isUser ? 'You' : characterName || 'They'} said: ${paragraph}`}
              >
                {pIdx === 0 && replyTo && (
                  <TouchableOpacity
                    style={[styles.quote, isUser ? styles.quoteOnUser : styles.quoteOnAssistant]}
                    activeOpacity={0.8}
                    disabled={!replyTo.available}
                    onPress={() => onQuotePress?.(replyTo.id)}
                    accessibilityLabel="Go to the quoted message"
                  >
                    <Text style={styles.quoteName}>{replyTo.role === 'user' ? 'You' : characterName || 'Them'}</Text>
                    <Text style={styles.quoteText} numberOfLines={2}>
                      {replyTo.available ? replyTo.snippet : 'Message unavailable'}
                    </Text>
                  </TouchableOpacity>
                )}
                {(() => {
                  // A gift ("[Sent a Gift: 🌹 Red Rose]") shows as a gift, not as its raw text.
                  const gift = /^\[Sent a Gift: (\S+)\s+(.+)\]$/u.exec(paragraph.trim());
                  if (gift) {
                    return (
                      <View style={styles.giftCard} accessibilityLabel={`${isUser ? 'You sent' : 'Sent you'} a ${gift[2]}`}>
                        <Text style={styles.giftCardEmoji}>{gift[1]}</Text>
                        <Text style={styles.giftCardText}>
                          {isUser ? `You sent ${characterName?.split(' ')[0] || 'them'} a ${gift[2]}` : `${gift[2]} for you`}
                        </Text>
                      </View>
                    );
                  }
                  const fenced = /^```([\w+#.-]*)\n([\s\S]*?)\n?```$/.exec(paragraph);
                  // Code they paste (no fences) is shown as a code box too.
                  const code = fenced ?? (isUser && looksLikePastedCode(paragraph) ? ['', '', paragraph] : null);
                  if (!code) {
                    return (
                      <Text
                        style={[
                          styles.messageText,
                          isUser ? styles.userText : styles.assistantText,
                        ]}
                      >
                        {/* Not selectable: a long press opens this message's actions (Copy, Reply…). Selectable
                            text started Android's text selection and its magnifier instead. */}
                        {withInlineCode(paragraph, styles.inlineCode)}
                      </Text>
                    );
                  }
                  return (
                    <View style={styles.codeCard}>
                      <View style={styles.codeHeader}>
                        <View style={styles.codeHeaderLeft}>
                          <View style={styles.codeDotRed} />
                          <View style={styles.codeDotYellow} />
                          <View style={styles.codeDotGreen} />
                          <Text style={styles.codeLang}>{code[1] || 'code'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.codeCopyPill}
                          onPress={() => copyCode(code[2] ?? '')}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Copy code"
                        >
                          <Icon name="copy" size={12} color="#CBD5E1" />
                          <Text style={styles.codeCopyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Long lines wrap: a sideways scroller with no visible bar looked like cut-off code on phones. */}
                      <View style={styles.codeScrollContent}>
                        <Text style={styles.codeText} selectable>
                          {code[2]}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {isCancelled && pIdx === arr.length - 1 && (
                  <Text style={styles.cancelledLabel}>[Generation stopped]</Text>
                )}

                {isFailed && pIdx === arr.length - 1 && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => onRetry?.(message.content, message)}
                    accessibilityLabel="Retry sending message"
                  >
                    <Text style={styles.retryText}>Retry Sending</Text>
                  </TouchableOpacity>
                )}

                {(group.last || isFailed) && pIdx === arr.length - 1 && (
                <View style={styles.bubbleFooter}>
                  <Text
                    style={[
                      styles.timestamp,
                      isUser ? styles.userTimestamp : styles.assistantTimestamp,
                    ]}
                  >
                    {formattedTime}
                  </Text>
                  {isUser && !isFailed && !isStreaming && pIdx === arr.length - 1 && (
                    <Icon name="check-double" size={13} color="#22C55E" style={{ marginLeft: 2 }} />
                  )}
                </View>
                )}
              </TouchableOpacity>
            ))}

            {isTypingNext && (
              <View
                style={[
                  styles.bubble,
                  styles.assistantBubble,
                  styles.streamingBubble,
                  styles.typingBubble,
                  { marginTop: 4 },
                ]}
              >
                <TypingDotsIndicator />
              </View>
            )}
          </View>
        )}

        {/* Contextual Action Strip */}
        {showActions && (
          <View style={[styles.actionStrip, isUser ? styles.userActionStrip : styles.assistantActionStrip]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                Clipboard.setString(message.content);
                setShowActions(false);
                ToastService.show({ message: 'Copied', type: 'info', duration: 1500 });
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
            >
              <Icon name="copy" size={13} color={darkThemeColors.textMuted} />
              <Text style={styles.actionLabel}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Share message">
              <Icon name="share" size={13} color={darkThemeColors.textMuted} />
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
            {canReply && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setShowActions(false);
                  onReply?.(message);
                }}
              >
                <Icon name="arrow-left" size={13} color={darkThemeColors.textMuted} />
                <Text style={styles.actionLabel}>Reply</Text>
              </TouchableOpacity>
            )}

            {!isUser && onFeedback && (
              <>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onFeedback(message.id, 'positive');
                    setShowActions(false);
                    ToastService.show({ message: 'Feedback sent', type: 'success', duration: 1500 });
                  }}
                >
                  <Icon name="sparkles" size={13} color={darkThemeColors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onFeedback(message.id, 'negative');
                    setShowActions(false);
                    ToastService.show({ message: 'Feedback sent', type: 'info', duration: 1500 });
                  }}
                >
                  <Icon name="flag" size={13} color={darkThemeColors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            {isFailed && onRetry && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onRetry(message.content, message);
                  setShowActions(false);
                }}
              >
                <Icon name="zap" size={13} color={darkThemeColors.textMuted} />
                <Text style={styles.actionLabel}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

/**
 * Redraws only when this message changes (text, status, highlight…), not on every keystroke or when
 * another message arrives. Handlers are expected to be stable (ChatScreen passes stable ones).
 */
export const MessageBubble = React.memo(
  MessageBubbleBase,
  (a, b) =>
    (a.message === b.message ||
      (a.message.id === b.message.id &&
        a.message.content === b.message.content &&
        a.message.status === b.message.status &&
        a.message.updatedAt === b.message.updatedAt &&
        a.message.replyTo === b.message.replyTo)) &&
    // (Before: the same message object returned "unchanged" right away, so a highlight never redrew.)
    a.isStreaming === b.isStreaming &&
    a.highlighted === b.highlighted &&
    a.characterAvatarUrl === b.characterAvatarUrl &&
    a.characterName === b.characterName &&
    a.isTypingNext === b.isTypingNext &&
    a.revealedParagraphs === b.revealedParagraphs &&
    a.group?.first === b.group?.first &&
    a.group?.last === b.group?.last,
);

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    maxWidth: '82%',
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  // The avatar sits at the bottom of the group, next to the last bubble (like Messenger/iMessage).
  avatar: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  avatarSpacer: {
    width: 36,
    marginRight: 8,
  },
  bubbleContainer: {
    flexShrink: 1,
  },
  bubblesStack: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#5B21A0',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
    borderBottomRightRadius: 4,
    shadowColor: '#5B21A0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  assistantBubble: {
    backgroundColor: '#241938',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 2,
  },
  streamingBubble: {
    borderColor: '#A855F7',
    borderWidth: 1,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  failedBubble: {
    borderColor: darkThemeColors.danger,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  quoteOnUser: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderLeftColor: '#F0ABFC',
  },
  quoteOnAssistant: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftColor: '#A78BFA',
  },
  quoteName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E9D5FF',
    marginBottom: 1,
  },
  quoteText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  highlightBubble: {
    borderWidth: 2,
    borderColor: '#F0ABFC',
  },
  codeCard: {
    borderRadius: 12,
    backgroundColor: '#0A0614',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
    width: '100%',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#140C24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5F56',
  },
  codeDotYellow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFBD2E',
  },
  codeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27C93F',
  },
  codeLang: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  codeCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeCopyText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  codeScrollContent: {
    padding: 12,
  },
  codeText: {
    color: '#E2E8F0',
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 14,
    color: '#F0ABFC',
    backgroundColor: 'rgba(10, 6, 20, 0.6)',
  },
  messageText: {
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  assistantText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  cancelledLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: darkThemeColors.danger,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  giftCard: { alignItems: 'center', paddingHorizontal: 6, paddingTop: 2, gap: 2 },
  giftCardEmoji: { fontSize: 46, lineHeight: 56 },
  giftCardText: { color: '#F5E9FF', fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 1,
    marginBottom: -3,
    gap: 4,
  },
  timestamp: {
    fontSize: 10.5,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  userTimestamp: {
    color: '#D8B4FE',
    opacity: 0.85,
  },
  assistantTimestamp: {
    color: '#9E9AA9',
    opacity: 0.85,
  },
  actionStrip: {
    flexDirection: 'row',
    backgroundColor: '#171224',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  userActionStrip: {
    alignSelf: 'flex-end',
  },
  assistantActionStrip: {
    alignSelf: 'flex-start',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
    marginLeft: 4,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 14,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C084FC',
  },
});
