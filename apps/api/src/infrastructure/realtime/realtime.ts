import type { IncomingMessage, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { WebSocketServer, type WebSocket } from 'ws';
import { redis } from '../redis/redis.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { verifyAccessToken } from '../../security/tokens.js';

/**
 * Live updates (WebSocket) for open apps and open admin tabs.
 *
 *   App:   /api/v1/realtime?token=<access token>
 *   Admin: /api/v1/admin/realtime?ticket=<1-minute ticket from GET /admin/console/realtime-ticket>
 *
 * Anything — this API, another API instance or the worker — publishes through Redis; every server
 * forwards to the connections it holds. Apps connect only while open, so "connected" = "the app is open"
 * (isOnline / onlineCount).
 */

export type UserEvent =
  | { type: 'typing'; conversationId: string; characterId: string; typing: boolean }
  | { type: 'conversation.updated'; conversationId: string; characterId: string }
  | { type: 'notification.new' }
  | { type: 'campaign.inapp' }
  | { type: 'billing.updated' }
  | { type: 'session.revoked' };

/** To every open app. */
export type BroadcastEvent = { type: 'settings.updated'; keys: string[] };

/** To every open admin tab. */
export type AdminEvent = {
  type: 'admin';
  kind: 'signup' | 'payment' | 'safety' | 'support' | 'campaign' | 'error' | 'online';
  text?: string;
  id?: string;
};

const USER = 'rt:user:';
const ALL = 'rt:all';
const ADMIN = 'rt:admin';
const ONLINE = 'rt:online:';
const ONLINE_USERS = 'rt:online-users';
const HEARTBEAT_MS = 25_000;
const ONLINE_TTL_MS = 70_000;

const users = new Map<string, Set<WebSocket>>(); // userId → this server's app sockets
const admins = new Set<WebSocket>();

async function markOnline(userId: string, connId: string) {
  const until = Date.now() + ONLINE_TTL_MS;
  await redis
    .multi()
    .zadd(`${ONLINE}${userId}`, until, connId)
    .pexpire(`${ONLINE}${userId}`, ONLINE_TTL_MS * 2)
    .zadd(ONLINE_USERS, until, userId)
    .exec()
    .catch(() => undefined);
}

const ticketSecret = () => `${env.JWT_ACCESS_SECRET}:realtime-admin`;

export const Realtime = {
  /** To every open app of this user. Never throws. */
  publish(userId: string, event: UserEvent): void {
    redis.publish(`${USER}${userId}`, JSON.stringify(event)).catch(() => undefined);
  },

  /** To every open app (e.g. maintenance switched on). */
  broadcast(event: BroadcastEvent): void {
    redis.publish(ALL, JSON.stringify(event)).catch(() => undefined);
  },

  /** To every open admin tab. */
  admin(event: Omit<AdminEvent, 'type'>): void {
    redis.publish(ADMIN, JSON.stringify({ type: 'admin', ...event })).catch(() => undefined);
  },

  async isOnline(userId: string): Promise<boolean> {
    try {
      return (await redis.zcount(`${ONLINE}${userId}`, Date.now(), '+inf')) > 0;
    } catch {
      return false;
    }
  },

  /** How many people have the app open right now. */
  async onlineCount(): Promise<number> {
    try {
      await redis.zremrangebyscore(ONLINE_USERS, '-inf', Date.now());
      return await redis.zcard(ONLINE_USERS);
    } catch {
      return 0;
    }
  },

  /** A 1-minute pass an admin tab exchanges for its live connection (its cookie may not reach the API's address). */
  adminTicket(adminId: string): string {
    return jwt.sign({ adminId, purpose: 'realtime' }, ticketSecret(), { expiresIn: 60 });
  },

  attach(server: Server): void {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

    const sub = redis.duplicate();
    sub.on('error', (err: Error) => logger.warn(`Realtime Redis: ${err.message}`));
    void sub.psubscribe(`${USER}*`).catch((err) => logger.warn('Realtime subscribe failed', { error: String(err) }));
    void sub.subscribe(ALL, ADMIN).catch((err) => logger.warn('Realtime subscribe failed', { error: String(err) }));
    const send = (ws: WebSocket, message: string) => ws.readyState === ws.OPEN && ws.send(message);
    sub.on('pmessage', (_p: string, channel: string, message: string) => {
      users.get(channel.slice(USER.length))?.forEach((ws) => send(ws, message));
    });
    sub.on('message', (channel: string, message: string) => {
      if (channel === ALL) users.forEach((set) => set.forEach((ws) => send(ws, message)));
      else if (channel === ADMIN) admins.forEach((ws) => send(ws, message));
    });

    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reject = () => {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      };
      if (url.pathname === '/api/v1/realtime') {
        void authenticateUser(url.searchParams.get('token'))
          .then((userId) => (userId ? wss.handleUpgrade(req, socket, head, (ws) => onUser(ws, userId)) : reject()))
          .catch(() => socket.destroy());
      } else if (url.pathname === '/api/v1/admin/realtime') {
        void authenticateAdmin(url.searchParams.get('ticket'))
          .then((ok) => (ok ? wss.handleUpgrade(req, socket, head, onAdmin) : reject()))
          .catch(() => socket.destroy());
      }
    });
  },
};

async function authenticateUser(token: string | null): Promise<string | null> {
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

async function authenticateAdmin(ticket: string | null): Promise<boolean> {
  if (!ticket) return false;
  try {
    const p = jwt.verify(ticket, ticketSecret()) as { adminId?: string; purpose?: string };
    if (p.purpose !== 'realtime' || !p.adminId) return false;
    const admin = await prisma.adminUser.findUnique({ where: { id: p.adminId }, select: { isActive: true } });
    return Boolean(admin?.isActive);
  } catch {
    return false;
  }
}

function keepAlive(ws: WebSocket, onBeat?: () => void): () => void {
  let alive = true;
  ws.on('pong', () => {
    alive = true;
    onBeat?.();
  });
  const beat = setInterval(() => {
    if (!alive) return ws.terminate(); // no answer to the last ping: gone
    alive = false;
    ws.ping();
  }, HEARTBEAT_MS);
  beat.unref();
  return () => clearInterval(beat);
}

function onUser(ws: WebSocket, userId: string) {
  const connId = randomUUID();
  const set = users.get(userId) ?? new Set<WebSocket>();
  set.add(ws);
  users.set(userId, set);
  void markOnline(userId, connId);
  if (set.size === 1) Realtime.admin({ kind: 'online' });
  const stop = keepAlive(ws, () => void markOnline(userId, connId));
  ws.on('message', () => undefined); // the app only listens
  ws.on('close', () => {
    stop();
    set.delete(ws);
    if (!set.size) users.delete(userId);
    redis.zrem(`${ONLINE}${userId}`, connId).catch(() => undefined);
    void Realtime.isOnline(userId).then((on) => {
      if (on) return;
      redis.zrem(ONLINE_USERS, userId).catch(() => undefined);
      Realtime.admin({ kind: 'online' });
    });
  });
  ws.on('error', () => ws.terminate());
  ws.send(JSON.stringify({ type: 'hello' }));
}

function onAdmin(ws: WebSocket) {
  admins.add(ws);
  const stop = keepAlive(ws);
  ws.on('message', () => undefined);
  ws.on('close', () => {
    stop();
    admins.delete(ws);
  });
  ws.on('error', () => ws.terminate());
  ws.send(JSON.stringify({ type: 'hello' }));
}
