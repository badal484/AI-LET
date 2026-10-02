import { ApiClient } from './client.js';
import { SecureAuthStorage } from '../auth/SecureAuthStorage.js';
import type {
  StreamEventType,
  StreamMessageStartedPayload,
  StreamMessageDeltaPayload,
  StreamMessageMetadataPayload,
  StreamMessageCompletedPayload,
  StreamMessageFailedPayload,
  StreamMessageCancelledPayload,
  StreamMessageSavedPayload,
  StreamMessageQueuedPayload,
  StreamMessageBubblePayload,
  StreamReplyStatusPayload,
  StreamCrisisSupportPayload,
} from '@ai-companion/types';

export interface ChatStreamCallbacks {
  onStarted?: (payload: StreamMessageStartedPayload) => void;
  onDelta?: (payload: StreamMessageDeltaPayload) => void;
  onMetadata?: (payload: StreamMessageMetadataPayload) => void;
  onCompleted?: (payload: StreamMessageCompletedPayload) => void;
  onFailed?: (payload: StreamMessageFailedPayload) => void;
  onCancelled?: (payload: StreamMessageCancelledPayload) => void;
  onHeartbeat?: () => void;
  /** Human-style turns: the user's message is stored (never lost after this). */
  onSaved?: (payload: StreamMessageSavedPayload) => void;
  /** Stored while she is already replying — the running turn answers it. */
  onQueued?: (payload: StreamMessageQueuedPayload) => void;
  /** She is typing (before her first message and between messages). */
  onTyping?: () => void;
  /** One short, already-stored message of her reply. */
  onBubble?: (payload: StreamMessageBubblePayload) => void;
  onReplyDelayed?: (payload: StreamReplyStatusPayload) => void;
  onReplyFailed?: (payload: StreamReplyStatusPayload) => void;
  onTurnCompleted?: () => void;
  /** They said they feel like ending their life: fixed caring words + helplines (shown as her messages). */
  onCrisisSupport?: (payload: StreamCrisisSupportPayload) => void;
}

export class ChatStreamClient {
  public static readonly REQUEST_TIMEOUT_MS = 120_000;

  /**
   * Opens an SSE streaming generation request to the API using XMLHttpRequest
   * which natively supports progressive chunk streaming in React Native (Hermes).
   */
  public static async streamMessage(
    conversationId: string,
    content: string,
    clientRequestId: string,
    callbacks: ChatStreamCallbacks,
    abortSignal?: AbortSignal,
    /** Regenerate the reply for this (failed) message instead of sending new text. */
    retryMessageId?: string,
  ): Promise<void> {
    let accessToken: string | null = null;
    try {
      accessToken = (await SecureAuthStorage.getSession())?.accessToken || null;
    } catch {
      accessToken = null;
    }
    const baseUrl = ApiClient.getBaseUrl();
    const url = retryMessageId
      ? `${baseUrl}/conversations/${conversationId}/messages/${retryMessageId}/retry`
      : `${baseUrl}/conversations/${conversationId}/messages`;

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('x-correlation-id', `mob-stream-${Date.now()}`);
      // The server gives up on a silent model within ~25s; never leave the composer locked longer.
      xhr.timeout = ChatStreamClient.REQUEST_TIMEOUT_MS;

      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      }

      let seenIndex = 0;
      let buffer = '';
      let isCompleted = false;
      let accumulatedDelta = '';
      let currentAssistantMessageId = '';

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          try {
            xhr.abort();
          } catch {}
          callbacks.onCancelled?.({
            messageId: currentAssistantMessageId,
            conversationId,
            partialContent: accumulatedDelta,
            reason: 'Generation cancelled',
          });
          resolve();
        });
      }

      const processBlock = (block: string) => {
        if (!block.trim()) return;
        const blockLines = block.split('\n');
        let currentEvent: StreamEventType = 'message.delta';
        let dataStr = '';

        for (const line of blockLines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim() as StreamEventType;
          } else if (line.startsWith('data: ')) {
            dataStr = line.substring(6).trim();
          }
        }

        if (!dataStr) return;

        try {
          const parsed = JSON.parse(dataStr);
          switch (currentEvent) {
            case 'message.started':
              if (parsed?.messageId) {
                currentAssistantMessageId = parsed.messageId;
              }
              callbacks.onStarted?.(parsed);
              break;
            case 'message.delta':
              if (parsed?.delta) {
                accumulatedDelta += parsed.delta;
              }
              callbacks.onDelta?.(parsed);
              break;
            case 'message.metadata':
              callbacks.onMetadata?.(parsed);
              break;
            case 'message.completed':
              isCompleted = true;
              callbacks.onCompleted?.(parsed);
              break;
            case 'message.failed':
              isCompleted = true;
              callbacks.onFailed?.(parsed);
              break;
            case 'message.cancelled':
              callbacks.onCancelled?.(parsed);
              break;
            case 'heartbeat':
              callbacks.onHeartbeat?.();
              break;
            case 'message.saved':
              callbacks.onSaved?.(parsed);
              break;
            case 'message.queued':
              isCompleted = true;
              callbacks.onQueued?.(parsed);
              break;
            case 'typing':
              callbacks.onTyping?.();
              break;
            case 'message.bubble':
              callbacks.onBubble?.(parsed);
              break;
            case 'reply.delayed':
              callbacks.onReplyDelayed?.(parsed);
              break;
            case 'reply.failed':
              isCompleted = true;
              callbacks.onReplyFailed?.(parsed);
              break;
            case 'turn.completed':
              isCompleted = true;
              callbacks.onTurnCompleted?.();
              break;
            case 'crisis.support':
              callbacks.onCrisisSupport?.(parsed);
              break;
          }
        } catch (jsonErr) {
          console.warn('Failed to parse SSE data block:', dataStr, jsonErr);
        }
      };

      const flushRemainingBuffer = () => {
        const text = xhr.responseText || '';
        if (text.length > seenIndex) {
          const chunk = text.slice(seenIndex);
          seenIndex = text.length;
          buffer += chunk;
        }

        if (buffer.trim()) {
          const parts = buffer.split('\n\n');
          for (const part of parts) {
            processBlock(part);
          }
          buffer = '';
        }
      };

      xhr.onprogress = () => {
        const text = xhr.responseText || '';
        const chunk = text.slice(seenIndex);
        seenIndex = text.length;

        buffer += chunk;
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          processBlock(part);
        }
      };

      xhr.onload = () => {
        flushRemainingBuffer();

        if (isCompleted) {
          resolve();
          return;
        }

        if (accumulatedDelta.trim().length > 0) {
          isCompleted = true;
          callbacks.onCompleted?.({
            messageId: currentAssistantMessageId,
            conversationId,
            finalContent: accumulatedDelta,
            totalTokens: Math.ceil(accumulatedDelta.length / 4),
            status: 'SENT',
            timestamp: new Date().toISOString(),
          });
          resolve();
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          // A stream that ends with neither text nor a terminal event must still end the send
          // (otherwise the UI stays in "sending" and the send button freezes).
          callbacks.onFailed?.({
            conversationId,
            errorCode: 'EMPTY_RESPONSE',
            errorMessage: 'No reply was received. Please try again.',
            retryable: true,
          });
          resolve();
          return;
        }

        let errorMessage = `Stream request failed with HTTP ${xhr.status}`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson?.error?.message) {
            errorMessage = errJson.error.message;
          }
        } catch {}

        callbacks.onFailed?.({
          conversationId,
          errorCode: 'HTTP_ERROR',
          errorMessage,
          retryable: xhr.status >= 500,
        });
        resolve();
      };

      xhr.ontimeout = () => {
        flushRemainingBuffer();
        if (isCompleted) {
          resolve();
          return;
        }
        if (accumulatedDelta.trim().length > 0) {
          isCompleted = true;
          callbacks.onCompleted?.({
            messageId: currentAssistantMessageId,
            conversationId,
            finalContent: accumulatedDelta,
            totalTokens: Math.ceil(accumulatedDelta.length / 4),
            status: 'SENT',
            timestamp: new Date().toISOString(),
          });
        } else {
          callbacks.onFailed?.({
            conversationId,
            errorCode: 'TIMEOUT',
            errorMessage: 'The reply is taking too long. Please try again.',
            retryable: true,
          });
        }
        resolve();
      };

      xhr.onerror = () => {
        flushRemainingBuffer();

        if (isCompleted) {
          resolve();
          return;
        }

        // If content was already received from model, treat socket closure as a successful completion
        if (accumulatedDelta.trim().length > 0) {
          isCompleted = true;
          callbacks.onCompleted?.({
            messageId: currentAssistantMessageId,
            conversationId,
            finalContent: accumulatedDelta,
            totalTokens: Math.ceil(accumulatedDelta.length / 4),
            status: 'SENT',
            timestamp: new Date().toISOString(),
          });
          resolve();
          return;
        }

        callbacks.onFailed?.({
          conversationId,
          errorCode: 'NETWORK_ERROR',
          errorMessage: 'Network connection failed during streaming',
          retryable: true,
        });
        resolve();
      };

      try {
        xhr.send(
          JSON.stringify({
            content,
            clientRequestId,
          }),
        );
      } catch (err: any) {
        callbacks.onFailed?.({
          conversationId,
          errorCode: 'NETWORK_ERROR',
          errorMessage: err?.message || 'Network request send failed',
          retryable: true,
        });
        resolve();
      }
    });
  }
}
