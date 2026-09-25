import { redis } from './redis.js';

export const redisClient = {
  get isOpen(): boolean {
    return redis.status === 'ready' || redis.status === 'connect';
  },

  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<'OK' | null> {
    try {
      return await redis.set(key, value);
    } catch {
      return null;
    }
  },

  async setEx(key: string, seconds: number, value: string): Promise<'OK' | null> {
    try {
      return await redis.set(key, value, 'EX', seconds);
    } catch {
      return null;
    }
  },

  async del(key: string): Promise<number> {
    try {
      return await redis.del(key);
    } catch {
      return 0;
    }
  },

  async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch {
      return 1;
    }
  },

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await redis.expire(key, seconds);
    } catch {
      return 0;
    }
  },
};
