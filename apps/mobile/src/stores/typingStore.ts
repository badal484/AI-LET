import { create } from 'zustand';

/** Which chats have a character typing right now (from the live connection), for the Chats list. */

const SAFETY_MS = 45_000; // if the "stopped typing" event is lost, don't show typing forever
const timers = new Map<string, ReturnType<typeof setTimeout>>();

interface TypingState {
  typing: Record<string, true>;
  set: (conversationId: string, typing: boolean) => void;
  clear: () => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  typing: {},
  set: (conversationId, typing) => {
    const old = timers.get(conversationId);
    if (old) clearTimeout(old);
    timers.delete(conversationId);
    if (typing) {
      timers.set(conversationId, setTimeout(() => useTypingStore.getState().set(conversationId, false), SAFETY_MS));
    }
    set((s) => {
      const next = { ...s.typing };
      if (typing) next[conversationId] = true;
      else delete next[conversationId];
      return { typing: next };
    });
  },
  clear: () => set({ typing: {} }),
}));
