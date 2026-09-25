import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
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
            {isStreaming ? (
              <ActivityIndicator
                size="small"
                color={darkThemeColors.accent}
                style={{ transform: [{ scale: 0.7 }] }}
              />
            ) : null}
            <Text
              style={[
                styles.timestamp,
                isUser ? styles.userTimestamp : styles.assistantTimestamp,
              ]}
            >
              {formattedTime}
            </Text>
          </View>
        </TouchableOpacity>

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
    marginVertical: 4,
    maxWidth: '86%',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: darkThemeColors.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  streamingBubble: {
    borderColor: darkThemeColors.borderGlass,
    borderWidth: 1,
  },
  failedBubble: {
    borderColor: darkThemeColors.danger,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: darkThemeColors.textPrimary,
  },
  cancelledLabel: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: darkThemeColors.danger,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
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
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  assistantTimestamp: {
    color: darkThemeColors.textMuted,
  },
  actionStrip: {
    flexDirection: 'row',
    backgroundColor: darkThemeColors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    gap: spacing.md,
    alignItems: 'center',
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
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 11,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
    marginLeft: 4,
  },
});
