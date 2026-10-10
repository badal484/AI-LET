import { AppState } from 'react-native';
import { ApiClient } from '../api/client.js';
import { SecureAuthStorage } from '../auth/SecureAuthStorage.js';

/**
 * The app's live connection (server: apps/api/src/infrastructure/realtime/realtime.ts).
 * Open only while the app is on screen and signed in — that's also how the server knows not to send a
 * phone notification. Reconnects by itself; after a reconnect, screens refresh what they may have missed.
 */

export type RealtimeEvent =
  | { type: 'hello' }
  | { type: 'typing'; conversationId: string; characterId: string; typing: boolean }
  | { type: 'conversation.updated'; conversationId: string; characterId: string }
  | { type: 'notification.new' }
  | { type: 'campaign.inapp' }
  | { type: 'billing.updated' }
  | { type: 'session.revoked' }
  | { type: 'settings.updated'; keys: string[] };

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let signedIn = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function emit(event: RealtimeEvent) {
  listeners.forEach((l) => l(event));
}

async function open() {
  if (socket || !signedIn || AppState.currentState !== 'active') return;
  const token = (await SecureAuthStorage.getSession().catch(() => null))?.accessToken;
  if (!token || !signedIn) return;
  const url = `${ApiClient.getBaseUrl().replace(/^http/, 'ws').replace(/\/$/, '')}/realtime?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    retry = 0;
  };
  ws.onmessage = (m) => {
    try {
      emit(JSON.parse(String(m.data)) as RealtimeEvent);
    } catch {
      /* ignore */
    }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    schedule();
  };
  ws.onerror = () => ws.close();
}

function close() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const ws = socket;
  socket = null;
  ws?.close();
}

/** Back-off 1 s → 15 s while the app is open and signed in (an expired token is refreshed by the API client meanwhile). */
function schedule() {
  if (!signedIn || AppState.currentState !== 'active' || retryTimer) return;
  const wait = Math.min(15_000, 1000 * 2 ** retry++);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void open();
  }, wait);
}

export const Realtime = {
  start() {
    if (started) return;
    started = true;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retry = 0;
        void open();
      } else close(); // in the background, notifications take over
    });
  },

  setSignedIn(value: boolean) {
    signedIn = value;
    if (value) void open();
    else close();
  },

  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
