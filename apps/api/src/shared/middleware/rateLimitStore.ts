import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Store } from 'express-rate-limit';
import { redis } from '../../infrastructure/redis/redis.js';

/**
 * Rate-limit counters in Redis, so every API instance shares one count per user / IP (in memory, each of
 * N servers would allow N× the limit). Tests keep the in-memory default.
 */
export function rateLimitStore(prefix: string): Store | undefined {
  if (process.env['NODE_ENV'] === 'test') return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
  });
}
