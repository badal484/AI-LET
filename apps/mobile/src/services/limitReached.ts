import type { StreamLimitReachedPayload } from '@ai-companion/types';

/**
 * Today's messages are used up (the server didn't send the message). The chat stream reports it here
 * and App opens the paywall — so no screen has to wire it up itself.
 */
type Listener = (payload: StreamLimitReachedPayload) => void;
const listeners = new Set<Listener>();

export const LimitReached = {
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(payload: StreamLimitReachedPayload): void {
    listeners.forEach((l) => l(payload));
  },
};
