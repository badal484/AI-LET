import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/redis/redis.js';
import { useMessage } from '../../src/modules/billing/messageAllowance.js';
import { resetSpendGuardForTests, spendCapReached, todaySpendInr } from '../../src/modules/ai/telemetry/spendGuard.js';
import { createCharacter, createConversation, createUser } from '../fixtures.js';

/**
 * Audit H-1: free AI use is never unlimited. Daily caps apply even while payment limits are off, accounts
 * without a verified email get a smaller cap (only when email can be sent), and a hard daily AI spending
 * cap pauses replies — crisis messages always go through.
 */

const ENV = ['BILLING_ENFORCE_LIMITS', 'OPEN_DAILY_MESSAGES', 'UNVERIFIED_DAILY_MESSAGES', 'RESEND_API_KEY', 'EMAIL_FROM', 'AI_DAILY_HARD_CAP_INR', 'INR_PER_USD'];
const users: string[] = [];
const clearCounters = async () => {
  for (const id of users) {
    const keys = await redis.keys(`msgs:${id}:*`);
    if (keys.length) await redis.del(...keys);
  }
};

afterEach(async () => {
  for (const k of ENV) delete process.env[k];
  vi.restoreAllMocks();
  await clearCounters();
});
afterAll(clearCounters);

describe('daily caps while payment limits are off', () => {
  beforeEach(() => {
    process.env['BILLING_ENFORCE_LIMITS'] = 'false';
  });

  it('a verified account stops at the open daily cap (reason daily_cap) — a crisis message still goes through', async () => {
    process.env['OPEN_DAILY_MESSAGES'] = '2';
    const user = await createUser({ verified: true });
    users.push(user.id);
    expect((await useMessage(user.id, 'hii')).allowed).toBe(true);
    expect((await useMessage(user.id, 'kya chal raha')).allowed).toBe(true);
    const third = await useMessage(user.id, 'aur batao');
    expect(third).toMatchObject({ allowed: false, reason: 'daily_cap', limit: 2 });
    expect((await useMessage(user.id, 'jeene ka mann nahi karta')).allowed).toBe(true);
  });

  it('an unverified account gets the smaller cap and is asked to verify — only when email can be sent', async () => {
    process.env['UNVERIFIED_DAILY_MESSAGES'] = '1';
    const unverified = await createUser({ verified: false });
    users.push(unverified.id);

    // Email not set up: asking to verify would be a dead end, so the open cap applies instead.
    expect((await useMessage(unverified.id, 'one')).allowed).toBe(true);
    expect((await useMessage(unverified.id, 'two')).allowed).toBe(true);
    await clearCounters();

    process.env['RESEND_API_KEY'] = 'test_key';
    process.env['EMAIL_FROM'] = 'Loveek <no-reply@example.com>';
    expect((await useMessage(unverified.id, 'one')).allowed).toBe(true);
    expect(await useMessage(unverified.id, 'two')).toMatchObject({ allowed: false, reason: 'verify_email', limit: 1 });

    const verified = await createUser({ verified: true });
    users.push(verified.id);
    expect((await useMessage(verified.id, 'one')).allowed).toBe(true);
    expect((await useMessage(verified.id, 'two')).allowed).toBe(true);
  });

  it('0 turns the open cap off', async () => {
    process.env['OPEN_DAILY_MESSAGES'] = '0';
    const user = await createUser({ verified: true });
    users.push(user.id);
    for (let i = 0; i < 5; i++) expect((await useMessage(user.id, `msg ${i}`)).allowed).toBe(true);
  });
});

describe('hard daily AI spending cap', () => {
  const tag = `spendcap_${Date.now()}`;
  beforeEach(() => resetSpendGuardForTests());
  afterAll(async () => {
    await prisma.aIUsageEvent.deleteMany({ where: { requestId: { startsWith: tag } } });
    resetSpendGuardForTests();
  });

  it('is reached once today’s ledger cost passes the cap; 0 turns it off', async () => {
    process.env['INR_PER_USD'] = '100';
    const before = await todaySpendInr();
    process.env['AI_DAILY_HARD_CAP_INR'] = String(Math.ceil(before) + 500);
    resetSpendGuardForTests();
    expect(await spendCapReached()).toBe(false);

    // ₹600 more today (6 USD at ₹100/USD).
    await prisma.aIUsageEvent.create({
      data: { requestId: `${tag}_1`, provider: 'google', model: 'gemini-test', task: 'chat', inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCost: 6, currency: 'USD', latencyMs: 1 },
    });
    resetSpendGuardForTests();
    expect(await spendCapReached()).toBe(true);

    process.env['AI_DAILY_HARD_CAP_INR'] = '0';
    expect(await spendCapReached()).toBe(false);
  });

  it('the chat answers "service_busy" instead of calling the AI — a crisis message is still answered', async () => {
    process.env['INR_PER_USD'] = '100';
    process.env['AI_DAILY_HARD_CAP_INR'] = '0.01'; // already passed by the row above
    process.env['BILLING_ENFORCE_LIMITS'] = 'false';
    resetSpendGuardForTests();
    const app = createApp();
    const user = await createUser({ verified: true });
    users.push(user.id);
    const character = await createCharacter();
    const { conversationId } = await createConversation(user.id, character.id, []);
    const auth = { Authorization: `Bearer ${user.token}` };

    const busy = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set(auth).send({ content: 'hii kaisi ho', clientRequestId: `req_${tag}_a` });
    expect(busy.text).toContain('limit.reached');
    expect(busy.text).toContain('service_busy');
    expect(await prisma.message.count({ where: { conversationId, content: 'hii kaisi ho' } })).toBe(0);

    const crisis = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set(auth).send({ content: 'jeene ka mann nahi karta', clientRequestId: `req_${tag}_b` });
    expect(crisis.text).not.toContain('service_busy');
  });
});
