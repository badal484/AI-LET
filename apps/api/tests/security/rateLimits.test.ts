import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { ResilientStore } from '../../src/shared/middleware/rateLimitStore.js';

/** Audit M-2 / L-7: rate limits really answer 429, and a Redis outage doesn't switch them off. */

describe('rate-limit store when Redis is down', () => {
  const broken: Store = {
    init: () => undefined,
    increment: async (): Promise<ClientRateLimitInfo> => {
      throw new Error('ECONNREFUSED');
    },
    decrement: async () => {
      throw new Error('ECONNREFUSED');
    },
    resetKey: async () => {
      throw new Error('ECONNREFUSED');
    },
  };

  it('keeps counting in memory instead of failing (or letting everything through)', async () => {
    const store = new ResilientStore(broken);
    store.init({ windowMs: 60_000 } as Options);
    // (the memory store hands back its live counter, so read each value right away)
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);
    await expect(store.decrement('1.2.3.4')).resolves.toBeUndefined();
  });
});

describe('sign-in rate limit', () => {
  beforeAll(() => {
    process.env['RATE_LIMIT_IN_TESTS'] = 'true';
  });
  afterAll(() => {
    delete process.env['RATE_LIMIT_IN_TESTS'];
  });

  it('answers 429 after 10 sign-in attempts from one address in 15 minutes', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '203.0.113.77').send({ email: `nobody${i}@test.local`, password: 'Whatever123!' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
