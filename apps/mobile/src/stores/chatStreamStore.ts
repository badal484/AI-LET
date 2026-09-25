import { create } from 'zustand';

interface ChatStreamState {
  activeConversationId: string | null;
  streamingMessageId: string | null;
  accumulatedDelta: string;
  isStreaming: boolean;
  abortController: AbortController | null;
  error: string | null;

  startStreaming: (conversationId: string, messageId: string, abortController: AbortController) => void;
  appendDelta: (delta: string) => void;
  finishStreaming: () => void;
  cancelStreaming: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

let pendingBuffer = '';
let flushTimer: any = null;

export const useChatStreamStore = create<ChatStreamState>((set, get) => ({
  activeConversationId: null,
  streamingMessageId: null,
  accumulatedDelta: '',
  isStreaming: false,
  abortController: null,
  error: null,

  startStreaming: (conversationId, messageId, abortController) => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingBuffer = '';

    set({
      activeConversationId: conversationId,
      streamingMessageId: messageId,
      accumulatedDelta: '',
      isStreaming: true,
      abortController,
      error: null,
    });
  },

  appendDelta: (delta) => {
    pendingBuffer += delta;

    if (!flushTimer) {
      // Batch updates in ~32ms windows (approx 30fps update cadence for text streaming)
      // to maintain perceived real-time responsiveness while eliminating JS frame drops
      flushTimer = setTimeout(() => {
        const buffered = pendingBuffer;
        pendingBuffer = '';
        flushTimer = null;

        set((state) => ({
          accumulatedDelta: state.accumulatedDelta + buffered,
        }));
      }, 32);
    }
  },

  finishStreaming: () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const finalBuffered = pendingBuffer;
    pendingBuffer = '';

    set((state) => ({
      accumulatedDelta: state.accumulatedDelta + finalBuffered,
      isStreaming: false,
      abortController: null,
    }));
  },

  cancelStreaming: () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingBuffer = '';

    const { abortController } = get();
    if (abortController && !abortController.signal.aborted) {
      abortController.abort('User cancelled');
    }
    set({
      isStreaming: false,
      abortController: null,
    });
  },

  setError: (error) => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingBuffer = '';
    set({ error, isStreaming: false });
  },

  reset: () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingBuffer = '';

    set({
      activeConversationId: null,
      streamingMessageId: null,
      accumulatedDelta: '',
      isStreaming: false,
      abortController: null,
      error: null,
    });
  },
}));
