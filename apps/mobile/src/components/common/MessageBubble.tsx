import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Animated,
} from 'react-native';
import { Avatar } from './Avatar.js';
import { ToastService } from './Toast.js';
import { Icon } from './Icon.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { ChatMessageItem } from '@ai-companion/types';

export interface MessageBubbleProps {
  message: ChatMessageItem;
  characterAvatarUrl?: string | null;
  characterName?: string;
  isStreaming?: boolean;
  onRetry?: (content: string) => void;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => void;
  onSelectMedia?: (mediaUrl: string) => void;
}

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  characterAvatarUrl,
  characterName,
  isStreaming = false,
  onRetry,
  onFeedback,
}) => {
  const [showActions, setShowActions] = useState(false);
  const isUser = message.role === 'user' || message.senderType === 'USER';
  const isFailed = message.status === 'FAILED';
  const isCancelled = message.status === 'CANCELLED';
  const isTyping = isStreaming && (!message.content || message.content.trim() === '...' || message.content.trim() === '');

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

  const formattedTime = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View
      style={[
        styles.messageRow,
        isUser ? styles.userRow : styles.assistantRow,
      ]}
    >
      {!isUser && (
        <Avatar
          uri={characterAvatarUrl}
          name={characterName || 'AI'}
          size="sm"
          style={styles.avatar}
        />
      )}

      <View style={styles.bubbleContainer}>
        {isTyping ? (
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
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => setShowActions((prev) => !prev)}
            style={[
              styles.bubble,
              isUser ? styles.userBubble : styles.assistantBubble,
              isFailed && styles.failedBubble,
              isStreaming && styles.streamingBubble,
            ]}
            accessibilityRole="text"
            accessibilityLabel={`${isUser ? 'You' : characterName || 'Companion'} said: ${message.content}`}
          >
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userText : styles.assistantText,
              ]}
              selectable
            >
              {message.content}
            </Text>

            {isCancelled && (
              <Text style={styles.cancelledLabel}>[Generation stopped]</Text>
            )}

            {isFailed && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => onRetry?.(message.content)}
                accessibilityLabel="Retry sending message"
              >
                <Text style={styles.retryText}>Retry Sending</Text>
              </TouchableOpacity>
            )}

            <View style={styles.bubbleFooter}>
              <Text
                style={[
                  styles.timestamp,
                  isUser ? styles.userTimestamp : styles.assistantTimestamp,
                ]}
              >
                {formattedTime}
              </Text>
              {isUser && !isFailed && !isStreaming && (
                <Icon name="check-double" size={13} color="#22C55E" style={{ marginLeft: 2 }} />
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Contextual Action Strip */}
        {showActions && (
          <View style={[styles.actionStrip, isUser ? styles.userActionStrip : styles.assistantActionStrip]}>
            <TouchableOpacity style={styles.actionItem} onPress={handleCopy}>
              <Icon name="share" size={13} color={darkThemeColors.textMuted} />
              <Text style={styles.actionLabel}>Share/Copy</Text>
            </TouchableOpacity>

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
                  onRetry(message.content);
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
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginVertical: 5,
    maxWidth: '84%',
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  avatar: {
    alignSelf: 'flex-end',
    marginBottom: 4,
    marginRight: spacing.xs,
  },
  bubbleContainer: {
    flexShrink: 1,
  },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#3B1F6E',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderBottomRightRadius: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  assistantBubble: {
    backgroundColor: '#1C152B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
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
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  assistantText: {
    color: '#F1F5F9',
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
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: '500',
  },
  userTimestamp: {
    color: '#D8B4FE',
    opacity: 0.75,
  },
  assistantTimestamp: {
    color: '#94A3B8',
    opacity: 0.75,
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
