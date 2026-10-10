import type { NextFunction, Request, Response } from 'express';
import { redis } from '../../infrastructure/redis/redis.js';

/**
 * What the System screen needs that isn't in the database: the last server errors (5xx) and when each
 * background job last ran. Both live in Redis so the API and the worker process share them.
 */

const ERRORS_KEY = 'console:errors';
const JOBS_KEY = 'console:jobs';

export interface RecentError { at: string; status: number; method: string; path: string; message: string; code?: string }

/** Express error middleware: notes 5xx errors (no bodies, no user data), then passes the error on. */
export function recordServerError(err: unknown, req: Request, _res: Response, next: NextFunction): void {
  const e = err as { statusCode?: number; status?: number; message?: string; code?: string };
  const status = e?.statusCode ?? e?.status ?? 500;
  if (status >= 500) {
    const entry: RecentError = {
      at: new Date().toISOString(),
      status,
      method: req.method,
      // ids in the path are noise: /users/1b2c… → /users/:id
      path: req.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').slice(0, 200),
      message: String(e?.message ?? 'Unknown error').slice(0, 300),
      ...(e?.code && { code: String(e.code) }),
    };
    void redis
      .multi()
      .lpush(ERRORS_KEY, JSON.stringify(entry))
      .ltrim(ERRORS_KEY, 0, 99)
      .exec()
      .catch(() => undefined);
  }
  next(err);
}

export async function recentErrors(limit = 20): Promise<{ items: RecentError[]; lastHour: number }> {
  const raw = await redis.lrange(ERRORS_KEY, 0, 99).catch(() => [] as string[]);
  const items = raw.flatMap((r) => {
    try {
      return [JSON.parse(r) as RecentError];
    } catch {
      return [];
    }
  });
  const hourAgo = Date.now() - 3_600_000;
  return { items: items.slice(0, limit), lastHour: items.filter((i) => Date.parse(i.at) >= hourAgo).length };
}

/** Called by the worker after every run of a periodic job. */
export async function recordJobRun(name: string, everyMs: number, ok: boolean, error?: string): Promise<void> {
  const prev = await redis.hget(JOBS_KEY, name).catch(() => null);
  const before = prev ? (JSON.parse(prev) as { lastOk?: string }) : {};
  const now = new Date().toISOString();
  const entry = { everyMs, lastRun: now, lastOk: ok ? now : before.lastOk ?? null, ok, error: error?.slice(0, 300) ?? null };
  await redis.hset(JOBS_KEY, name, JSON.stringify(entry)).catch(() => undefined);
}

export async function jobStatus(): Promise<Array<{ name: string; everyMs: number; lastRun: string; lastOk: string | null; ok: boolean; error: string | null; late: boolean }>> {
  const all = await redis.hgetall(JOBS_KEY).catch(() => ({}) as Record<string, string>);
  return Object.entries(all ?? {}).map(([name, v]) => {
    const j = JSON.parse(v) as { everyMs: number; lastRun: string; lastOk: string | null; ok: boolean; error: string | null };
    return { name, ...j, late: Date.now() - Date.parse(j.lastRun) > j.everyMs * 3 + 60_000 };
  });
}
