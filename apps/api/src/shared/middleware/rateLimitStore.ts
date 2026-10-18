import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { MemoryStore, type ClientRateLimitInfo, type Options, type Store } from 'express-rate-limit';
import { redis } from '../../infrastructure/redis/redis.js';
import { logger } from '../../config/logger.js';

/**
 * Rate-limit counters in Redis, so every API instance shares one count per user / IP (in memory, each of
 * N servers would allow N× the limit). Tests keep the in-memory default.
 *
 * If Redis can't be reached, counting continues in this server's memory instead of switching the limit off
 * (audit M-2: a Redis outage must not open sign-in to unlimited guessing). Back on Redis once it answers again.
 */
export class ResilientStore implements Store {
  private readonly fallback = new MemoryStore();
  private warnedAt = 0;
  prefix?: string;

  constructor(private readonly primary: Store) {
    this.prefix = primary.prefix;
  }

  init(options: Options): void {
    this.primary.init?.(options);
    this.fallback.init(options);
  }

  private warn(err: unknown): void {
    if (Date.now() - this.warnedAt < 60_000) return;
    this.warnedAt = Date.now();
    logger.warn(`Rate limit: Redis unavailable, counting in memory (${err instanceof Error ? err.message : 'unknown'})`);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    try {
      return await this.primary.increment(key);
    } catch (err) {
      this.warn(err);
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    await Promise.resolve(this.primary.decrement(key)).catch(() => undefined);
    await this.fallback.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    await Promise.resolve(this.primary.resetKey(key)).catch(() => undefined);
    await this.fallback.resetKey(key);
  }
}

export function rateLimitStore(prefix: string): Store | undefined {
  if (process.env['NODE_ENV'] === 'test') return undefined;
  return new ResilientStore(
    new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
    }),
  );
}
