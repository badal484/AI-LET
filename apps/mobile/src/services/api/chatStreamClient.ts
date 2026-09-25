import { API_BASE_URL } from './client.js';
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
   * Opens an SSE streaming generation request to the API.
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
    const url = `${API_BASE_URL}/conversations/${conversationId}/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'x-correlation-id': `mob-stream-${Date.now()}`,
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          clientRequestId,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        let errorMessage = `Stream request failed with HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errorMessage = errJson.error.message;
          }
        } catch {}

        callbacks.onFailed?.({
          conversationId,
          errorCode: 'HTTP_ERROR',
          errorMessage,
          retryable: response.status >= 500,
        });
        return;
      }

      // Read chunked response stream
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            if (!block.trim()) continue;

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

            if (!dataStr) continue;

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
          }
        }
      } else {
        // Fallback if reader is unavailable
        const fullText = await response.text();
        callbacks.onCompleted?.({
          messageId: `gen-${Date.now()}`,
          conversationId,
          finalContent: fullText,
          totalTokens: 0,
          status: 'SENT',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) {
        callbacks.onCancelled?.({
          messageId: '',
          conversationId,
          partialContent: '',
          reason: 'Generation cancelled',
        });
        return;
      }

      callbacks.onFailed?.({
        conversationId,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err.message || 'Network connection failed during streaming',
        retryable: true,
      });
    }
  }
}
