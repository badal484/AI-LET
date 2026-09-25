import { useAuthStore } from '../../../stores/authStore.js';
import { SocialDraftStorage, SocialOfflineQueue, useSocialUiStore } from './socialClientState.js';

let bound = false;

/**
 * Keeps social client state tied to the signed-in account:
 *  - drafts are scoped per user (account switch never exposes another account's drafts)
 *  - on sign-out, the account's sensitive drafts (DMs, comments) are wiped and UI state reset
 *  - on sign-in, pending idempotent offline actions are flushed
 */
export function bindSocialStateToAuth(): void {
  if (bound) return;
  bound = true;
  SocialDraftStorage.setAccount(useAuthStore.getState().user?.id ?? null);
  useAuthStore.subscribe((state, prev) => {
    const nextId = state.user?.id ?? null;
    const prevId = prev.user?.id ?? null;
    if (nextId === prevId) return;
    if (prevId) {
      void SocialDraftStorage.clearAccount();
      useSocialUiStore.setState({ composerOpenFor: null, replyTo: null, shareSelection: [] });
    }
    SocialDraftStorage.setAccount(nextId);
    if (nextId) void SocialOfflineQueue.flush();
  });
}
