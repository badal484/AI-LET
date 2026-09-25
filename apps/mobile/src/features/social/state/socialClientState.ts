import { create } from 'zustand';
import type { SocialReactionType } from '@ai-companion/types';
import { SocialApi, newIdempotencyKey } from '../api/socialApi.js';

// ─── Draft persistence ────────────────────────────────────────────────────────
// Drafts are stored locally only (never uploaded until the user sends) and are scoped per account.
// A native engine (e.g. encrypted storage) is injected at app start, mirroring SecureAuthStorage;
// the in-memory fallback still survives navigation and network failures.

type StorageEngine = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();
let engine: StorageEngine | null = null;
let accountScope = 'anonymous';

export const SocialDraftStorage = {
  setStorageEngine(e: StorageEngine) {
    engine = e;
  },
  /** Called on login / account switch so drafts never leak across accounts. */
  setAccount(userId: string | null) {
    accountScope = userId ?? 'anonymous';
  },
  key(draftId: string) {
    return `social_draft:${accountScope}:${draftId}`;
  },
  async save(draftId: string, text: string) {
    const k = this.key(draftId);
    if (!text.trim()) return this.clear(draftId);
    memory.set(k, text);
    await engine?.setItem(k, text).catch(() => undefined);
  },
  async load(draftId: string): Promise<string> {
    const k = this.key(draftId);
    if (memory.has(k)) return memory.get(k)!;
    const v = (await engine?.getItem(k).catch(() => null)) ?? '';
    if (v) memory.set(k, v);
    return v;
  },
  async clear(draftId: string) {
    const k = this.key(draftId);
    memory.delete(k);
    await engine?.removeItem(k).catch(() => undefined);
  },
  /** Logout: sensitive drafts (DMs, comments) are wiped for the current account. */
  async clearAccount() {
    const prefix = `social_draft:${accountScope}:`;
    for (const k of [...memory.keys()]) {
      if (k.startsWith(prefix)) {
        memory.delete(k);
        await engine?.removeItem(k).catch(() => undefined);
      }
    }
  },
};

// ─── Ephemeral UI state (composer, sheets, filters) ──────────────────────────
// Server state (feeds, profiles, comments, messages) lives in TanStack Query, not here.

interface SocialUiState {
  composerOpenFor: string | null;
  replyTo: { commentId: string; authorName: string } | null;
  shareSelection: string[];
  openComposer: (contentId: string) => void;
  closeComposer: () => void;
  setReplyTo: (r: SocialUiState['replyTo']) => void;
  toggleShareMessage: (messageId: string) => void;
  resetShareSelection: () => void;
}

export const useSocialUiStore = create<SocialUiState>((set) => ({
  composerOpenFor: null,
  replyTo: null,
  shareSelection: [],
  openComposer: (contentId) => set({ composerOpenFor: contentId }),
  closeComposer: () => set({ composerOpenFor: null, replyTo: null }),
  setReplyTo: (replyTo) => set({ replyTo }),
  toggleShareMessage: (id) =>
    set((s) => ({ shareSelection: s.shareSelection.includes(id) ? s.shareSelection.filter((x) => x !== id) : [...s.shareSelection, id] })),
  resetShareSelection: () => set({ shareSelection: [] }),
}));

// ─── Offline queue (safe, idempotent actions only) ───────────────────────────
// Only follows and reactions are queued; each keeps its idempotency key across retries so a replay
// can never double-apply. Messages, comments, shares and reports are never queued blindly.

type QueuedAction =
  | { kind: 'follow' | 'unfollow'; target: string; key: string; queuedAt: number }
  | { kind: 'react' | 'unreact'; publicId: string; reaction: SocialReactionType; key: string; queuedAt: number };

type QueuedActionInput = QueuedAction extends infer A ? (A extends QueuedAction ? Omit<A, 'key' | 'queuedAt'> : never) : never;

const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;
const queue: QueuedAction[] = [];

async function run(a: QueuedAction) {
  switch (a.kind) {
    case 'follow':
      return SocialApi.follow(a.target, a.key);
    case 'unfollow':
      return SocialApi.unfollow(a.target, a.key);
    case 'react':
      return SocialApi.react(a.publicId, a.reaction, a.key);
    case 'unreact':
      return SocialApi.unreact(a.publicId, a.reaction, a.key);
  }
}

function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; code?: string };
  return !e?.response || e.code === 'ECONNABORTED';
}

export const SocialOfflineQueue = {
  /** Executes now; on a network failure the action is queued (with the SAME key) for a later flush. */
  async perform(action: QueuedActionInput): Promise<boolean> {
    const full = { ...action, key: newIdempotencyKey(), queuedAt: Date.now() } as QueuedAction;
    try {
      await run(full);
      return true;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Same target: an identical pending action is a no-op; an opposite one cancels out (follow → unfollow).
      const sameTarget = (q: QueuedAction) =>
        ('target' in q && 'target' in full && q.target === full.target) ||
        ('publicId' in q && 'publicId' in full && q.publicId === full.publicId && q.reaction === full.reaction);
      const idx = queue.findIndex(sameTarget);
      if (idx === -1) queue.push(full);
      else if (queue[idx]!.kind !== full.kind) queue.splice(idx, 1);
      return false;
    }
  },
  async flush(): Promise<void> {
    const now = Date.now();
    while (queue.length > 0) {
      const next = queue[0]!;
      if (now - next.queuedAt > MAX_QUEUE_AGE_MS) {
        queue.shift();
        continue;
      }
      try {
        await run(next);
        queue.shift();
      } catch (err) {
        if (isNetworkError(err)) return; // still offline; keep order
        queue.shift(); // server rejected (e.g. blocked meanwhile): drop, never force
      }
    }
  },
  size: () => queue.length,
};
