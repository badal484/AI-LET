import { describe, expect, it } from 'vitest';
import { newIdempotencyKey } from '../src/features/social/api/socialApi.js';

describe('Mobile SocialApi Client Utilities', () => {
  it('generates unique valid idempotency keys with prefix', () => {
    const k1 = newIdempotencyKey();
    const k2 = newIdempotencyKey();

    expect(k1).toMatch(/^m-[a-z0-9]+-[a-z0-9]+$/);
    expect(k2).toMatch(/^m-[a-z0-9]+-[a-z0-9]+$/);
    expect(k1).not.toBe(k2);
  });
});
