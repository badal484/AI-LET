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
} from '@ai-companion/types';

export interface ChatStreamCallbacks {
  onStarted?: (payload: StreamMessageStartedPayload) => void;
  onDelta?: (payload: StreamMessageDeltaPayload) => void;
  onMetadata?: (payload: StreamMessageMetadataPayload) => void;
  onCompleted?: (payload: StreamMessageCompletedPayload) => void;
  onFailed?: (payload: StreamMessageFailedPayload) => void;
  onCancelled?: (payload: StreamMessageCancelledPayload) => void;
  onHeartbeat?: () => void;
}

export class ChatStreamClient {
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
  ): Promise<void> {
    const session = await SecureAuthStorage.getSession();
    const accessToken = session?.accessToken || null;
    const baseUrl = ApiClient.getBaseUrl();
    const url = `${baseUrl}/conversations/${conversationId}/messages`;

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('x-correlation-id', `mob-stream-${Date.now()}`);

      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          xhr.abort();
          callbacks.onCancelled?.({
            messageId: '',
            conversationId,
            partialContent: '',
            reason: 'Generation cancelled',
          });
          resolve();
        });
      }

      let seenIndex = 0;
      let buffer = '';

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
              callbacks.onStarted?.(parsed);
              break;
            case 'message.delta':
              callbacks.onDelta?.(parsed);
              break;
            case 'message.metadata':
              callbacks.onMetadata?.(parsed);
              break;
            case 'message.completed':
              callbacks.onCompleted?.(parsed);
              break;
            case 'message.failed':
              callbacks.onFailed?.(parsed);
              break;
            case 'message.cancelled':
              callbacks.onCancelled?.(parsed);
              break;
            case 'heartbeat':
              callbacks.onHeartbeat?.();
              break;
          }
        } catch (jsonErr) {
          console.warn('Failed to parse SSE data block:', dataStr, jsonErr);
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
        if (xhr.status >= 200 && xhr.status < 300) {
          if (buffer.trim()) {
            processBlock(buffer);
          }
          resolve();
        } else {
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
        }
      };

      xhr.onerror = () => {
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
