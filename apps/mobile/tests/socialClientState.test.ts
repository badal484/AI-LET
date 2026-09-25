import { describe, expect, it, beforeEach } from 'vitest';
import { SocialDraftStorage, useSocialUiStore, SocialOfflineQueue } from '../src/features/social/state/socialClientState.js';

describe('Mobile SocialDraftStorage', () => {
  const mockEngine = {
    store: new Map<string, string>(),
    async getItem(k: string) { return this.store.get(k) ?? null; },
    async setItem(k: string, v: string) { this.store.set(k, v); },
    async removeItem(k: string) { this.store.delete(k); },
  };

  beforeEach(async () => {
    mockEngine.store.clear();
    SocialDraftStorage.setStorageEngine(mockEngine);
    SocialDraftStorage.setAccount('user-1');
    await SocialDraftStorage.clearAccount();
  });

  it('saves, loads, and clears draft text for an account', async () => {
    await SocialDraftStorage.save('comment-post-1', 'Hello Maya!');
    const loaded = await SocialDraftStorage.load('comment-post-1');
    expect(loaded).toBe('Hello Maya!');

    await SocialDraftStorage.clear('comment-post-1');
    const empty = await SocialDraftStorage.load('comment-post-1');
    expect(empty).toBe('');
  });

  it('isolates drafts across different accounts', async () => {
    SocialDraftStorage.setAccount('user-1');
    await SocialDraftStorage.save('dm-thread-a', 'Secret draft from user 1');

    SocialDraftStorage.setAccount('user-2');
    const user2Draft = await SocialDraftStorage.load('dm-thread-a');
    expect(user2Draft).toBe('');

    SocialDraftStorage.setAccount('user-1');
    const user1Draft = await SocialDraftStorage.load('dm-thread-a');
    expect(user1Draft).toBe('Secret draft from user 1');
  });

  it('wipes account drafts on logout (clearAccount)', async () => {
    SocialDraftStorage.setAccount('user-1');
    await SocialDraftStorage.save('d1', 'Draft 1');
    await SocialDraftStorage.save('d2', 'Draft 2');

    await SocialDraftStorage.clearAccount();
    expect(await SocialDraftStorage.load('d1')).toBe('');
    expect(await SocialDraftStorage.load('d2')).toBe('');
  });
});

describe('Mobile useSocialUiStore', () => {
  beforeEach(() => {
    const store = useSocialUiStore.getState();
    store.closeComposer();
    store.resetShareSelection();
  });

  it('manages composer state and reply target', () => {
    const store = useSocialUiStore.getState();
    expect(store.composerOpenFor).toBeNull();

    store.openComposer('content-123');
    expect(useSocialUiStore.getState().composerOpenFor).toBe('content-123');

    store.setReplyTo({ commentId: 'comm-1', authorName: 'Maya' });
    expect(useSocialUiStore.getState().replyTo).toEqual({ commentId: 'comm-1', authorName: 'Maya' });

    store.closeComposer();
    expect(useSocialUiStore.getState().composerOpenFor).toBeNull();
    expect(useSocialUiStore.getState().replyTo).toBeNull();
  });

  it('toggles message selection for sharing', () => {
    const store = useSocialUiStore.getState();
    store.toggleShareMessage('msg-1');
    expect(useSocialUiStore.getState().shareSelection).toEqual(['msg-1']);

    store.toggleShareMessage('msg-2');
    expect(useSocialUiStore.getState().shareSelection).toEqual(['msg-1', 'msg-2']);

    store.toggleShareMessage('msg-1');
    expect(useSocialUiStore.getState().shareSelection).toEqual(['msg-2']);

    store.resetShareSelection();
    expect(useSocialUiStore.getState().shareSelection).toEqual([]);
  });
});

describe('Mobile SocialOfflineQueue', () => {
  it('exposes queue size and handles queue state', () => {
    expect(SocialOfflineQueue.size()).toBe(0);
  });
});
