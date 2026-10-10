import type { IncomingMessage, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { redis } from '../redis/redis.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../../config/logger.js';
import { verifyAccessToken } from '../../security/tokens.js';

/**
 * Live updates for open apps (WebSocket at /api/v1/realtime?token=<access token>).
 *
 * Anything — this API, another API instance or the worker — calls Realtime.publish(userId, event); the
 * event goes through Redis and every server holding that user's connection forwards it. The app connects
 * only while it is open, so "connected" also means "the app is open": Realtime.isOnline(userId) lets the
 * server skip a phone notification and show the message in the app instead.
 *
 * Events (server → app):
 *   { type: 'typing', conversationId, characterId, typing: boolean }
 *   { type: 'conversation.updated', conversationId, characterId }   — a new message / unread changed
 */

export type RealtimeEvent =
  | { type: 'typing'; conversationId: string; characterId: string; typing: boolean }
  | { type: 'conversation.updated'; conversationId: string; characterId: string };

const CHANNEL = 'rt:user:';
const ONLINE = 'rt:online:';
const HEARTBEAT_MS = 25_000;
const ONLINE_TTL_MS = 70_000;

const local = new Map<string, Set<WebSocket>>(); // userId → this server's sockets

function onlineKey(userId: string) {
  return `${ONLINE}${userId}`;
}

async function markOnline(userId: string, connId: string) {
  const key = onlineKey(userId);
  await redis.multi().zadd(key, Date.now() + ONLINE_TTL_MS, connId).pexpire(key, ONLINE_TTL_MS * 2).exec().catch(() => undefined);
}

export const Realtime = {
  /** Sends an event to every open app of this user (any server). Never throws. */
  publish(userId: string, event: RealtimeEvent): void {
    redis.publish(`${CHANNEL}${userId}`, JSON.stringify(event)).catch(() => undefined);
  },

  /** Whether the user has the app open right now (on any server). */
  async isOnline(userId: string): Promise<boolean> {
    try {
      return (await redis.zcount(onlineKey(userId), Date.now(), '+inf')) > 0;
    } catch {
      return false;
    }
  },

  /** Attaches the WebSocket endpoint to the API's HTTP server. */
  attach(server: Server): void {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

    // One Redis subscriber per server forwards every user's events to the sockets it holds.
    const sub = redis.duplicate();
    sub.on('error', (err: Error) => logger.warn(`Realtime Redis: ${err.message}`));
    void sub.psubscribe(`${CHANNEL}*`).catch((err) => logger.warn('Realtime subscribe failed', { error: String(err) }));
    sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const sockets = local.get(channel.slice(CHANNEL.length));
      sockets?.forEach((ws) => ws.readyState === ws.OPEN && ws.send(message));
    });

    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/api/v1/realtime') return; // not ours
      void authenticate(url.searchParams.get('token'))
        .then((userId) => {
          if (!userId) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          wss.handleUpgrade(req, socket, head, (ws) => onConnect(ws, userId));
        })
        .catch(() => socket.destroy());
    });
  },
};

async function authenticate(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { status: true, deletedAt: true } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') return null;
    if (payload.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: payload.sessionId }, select: { revokedAt: true } });
      if (!session || session.revokedAt) return null;
    }
    return payload.userId;
  } catch {
    return null;
  }
}

function onConnect(ws: WebSocket, userId: string) {
  const connId = randomUUID();
  let alive = true;
  const set = local.get(userId) ?? new Set<WebSocket>();
  set.add(ws);
  local.set(userId, set);
  void markOnline(userId, connId);

  ws.on('pong', () => {
    alive = true;
    void markOnline(userId, connId);
  });
  const beat = setInterval(() => {
    if (!alive) return ws.terminate(); // no answer to the last ping: the phone went away
    alive = false;
    ws.ping();
  }, HEARTBEAT_MS);
  beat.unref();

  // The app only listens; anything it sends is ignored.
  ws.on('message', () => undefined);
  ws.on('close', () => {
    clearInterval(beat);
    set.delete(ws);
    if (!set.size) local.delete(userId);
    redis.zrem(onlineKey(userId), connId).catch(() => undefined);
  });
  ws.on('error', () => ws.terminate());
  ws.send(JSON.stringify({ type: 'hello' }));
}
