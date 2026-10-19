import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { hasPremium } from '../../src/modules/billing/messageAllowance.js';
import { createPromo } from '../../src/modules/console/ops.service.js';
import { createUser } from '../fixtures.js';

/** Promo codes do what they say: free coins (never expire) or free Premium for N days — and nothing else. */
describe('promo codes', () => {
  const app = createApp();
  const tag = Date.now().toString(36).toUpperCase();
  const redeem = (token: string, promoCode: string) =>
    request(app).post('/api/v1/billing/promotions/redeem').set('Authorization', `Bearer ${token}`).send({ promoCode });

  beforeAll(async () => {
    const product = await prisma.billingProduct.upsert({ where: { slug: 'premium' }, create: { name: 'Premium', slug: 'premium' }, update: {} });
    await prisma.billingPlan.upsert({ where: { code: 'PREMIUM' }, create: { code: 'PREMIUM', name: 'Premium', productId: product.id }, update: {} });
    await prisma.adminUser.findFirst().catch(() => null);
  });

  it('free Premium days: Premium right away, until the chosen date, once per person', async () => {
    await createPromo(randomUUID(), { code: `VIP${tag}`, name: 'VIP', type: 'TRIAL_EXTENSION', value: 30 });
    const u = await createUser({ verified: true });
    expect(await hasPremium(u.id)).toBe(false);
    const res = await redeem(u.token, `vip${tag}`);
    expect(res.status).toBe(200);
    expect(await hasPremium(u.id)).toBe(true);
    const until = new Date(res.body.data.premiumUntil).getTime();
    expect(until - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    expect(until - Date.now()).toBeLessThan(30.1 * 86_400_000);
    expect(res.body.data.message).toMatch(/Premium is yours until/);
    expect((await redeem(u.token, `VIP${tag}`)).status).toBe(400); // already used
  });

  it('days are added after Premium they already have (never wasted)', async () => {
    await createPromo(randomUUID(), { code: `WEEK${tag}`, name: 'Week', type: 'TRIAL_EXTENSION', value: 7 });
    await createPromo(randomUUID(), { code: `MORE${tag}`, name: 'More', type: 'TRIAL_EXTENSION', value: 7 });
    const u = await createUser({ verified: true });
    await redeem(u.token, `WEEK${tag}`).expect(200);
    const second = await redeem(u.token, `MORE${tag}`).expect(200);
    expect(new Date(second.body.data.premiumUntil).getTime() - Date.now()).toBeGreaterThan(13.9 * 86_400_000);
  });

  it('free coins: added to the wallet with no expiry', async () => {
    await createPromo(randomUUID(), { code: `COINS${tag}`, name: 'Coins', type: 'FREE_CREDITS', value: 50 });
    const u = await createUser({ verified: true });
    const res = await redeem(u.token, `COINS${tag}`);
    expect(res.status).toBe(200);
    expect(res.body.data.grantedCredits).toBe(50);
    const grant = await prisma.creditTransaction.findFirst({ where: { wallet: { userId: u.id } }, orderBy: { createdAt: 'desc' } });
    expect(grant?.expiresAt ?? null).toBeNull();
  });

  it('only the two working kinds can be created, within sensible limits', async () => {
    await expect(createPromo(randomUUID(), { code: `PCT${tag}`, name: 'x', type: 'PERCENTAGE', value: 20 })).rejects.toThrow(/free coins or free Premium/);
    await expect(createPromo(randomUUID(), { code: `LONG${tag}`, name: 'x', type: 'TRIAL_EXTENSION', value: 400 })).rejects.toThrow(/365/);
  });
});
