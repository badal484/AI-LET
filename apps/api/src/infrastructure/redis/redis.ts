import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

class RedisConnection {
  private static instance: Redis | null = null;

  public static getInstance(): Redis {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
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
