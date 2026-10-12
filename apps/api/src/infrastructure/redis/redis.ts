import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Where Redis is: REDIS_URL when set (rediss:// or REDIS_TLS=true turns on TLS, which Upstash needs),
 * otherwise REDIS_HOST / REDIS_PORT / REDIS_PASSWORD. Shared by the app's client and the job queues.
 */
export function redisConnectionOptions(): Pick<RedisOptions, 'host' | 'port' | 'username' | 'password' | 'db' | 'tls'> {
  if (env.REDIS_URL) {
    const u = new URL(env.REDIS_URL);
    const tls = u.protocol === 'rediss:' || env.REDIS_TLS;
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : env.REDIS_DB,
      tls: tls ? { servername: u.hostname } : undefined,
    };
  }
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    tls: env.REDIS_TLS ? { servername: env.REDIS_HOST } : undefined,
  };
}

class RedisConnection {
  private static instance: Redis | null = null;

  public static getInstance(): Redis {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new Redis({
        ...redisConnectionOptions(),
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 200, 2000);
          return delay;
        },
      });

      RedisConnection.instance.on('error', (err: Error) => {
        logger.warn(`Redis Error: ${err.message}`);
      });
    }

    return RedisConnection.instance;
  }

  public static async checkHealth(): Promise<{
    isHealthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const client = RedisConnection.getInstance();
      if (client.status !== 'ready') {
        await client.connect().catch(() => {});
      }
      const response = await client.ping();
      const isHealthy = response === 'PONG';
      return { isHealthy, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Redis connection failed',
      };
    }
  }

  public static async disconnect(): Promise<void> {
    if (RedisConnection.instance) {
      await RedisConnection.instance.quit().catch(() => {});
      RedisConnection.instance = null;
      logger.info('Redis disconnected cleanly');
    }
  }
}

export const redis = RedisConnection.getInstance();
export const checkRedisHealth = RedisConnection.checkHealth;
export const disconnectRedis = RedisConnection.disconnect;
