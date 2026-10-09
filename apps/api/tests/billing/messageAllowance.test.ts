import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { useMessage } from '../../src/modules/billing/messageAllowance.js';
import { redis } from '../../src/infrastructure/redis/redis.js';

describe('Daily message allowance', () => {
  const userId = randomUUID();
  afterAll(async () => {
    const keys = await redis.keys(`msgs:${userId}:*`);
    if (keys.length) await redis.del(...keys);
    delete process.env['BILLING_ENFORCE_LIMITS'];
    delete process.env['FREE_DAILY_MESSAGES'];
  });

  it('is off until BILLING_ENFORCE_LIMITS=true', async () => {
    expect((await useMessage(userId, 'hi')).allowed).toBe(true);
  });

  it('free users get their daily messages, then a clear stop — crisis messages always go through', async () => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'true';
    process.env['FREE_DAILY_MESSAGES'] = '2';
    expect((await useMessage(userId, 'hii')).allowed).toBe(true);
    expect((await useMessage(userId, 'kya kar rahi ho')).allowed).toBe(true);
    const third = await useMessage(userId, 'aur batao');
    expect(third.allowed).toBe(false);
    expect(third.reason).toBe('free_limit');
    expect((await useMessage(userId, 'jeene ka mann nahi karta')).allowed).toBe(true);
    expect((await useMessage(userId, 'papa ko seene mein dard ho raha hai, paseena aa raha')).allowed).toBe(true);
  });
});
