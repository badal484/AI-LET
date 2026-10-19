import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { hasPremium } from '../../src/modules/billing/messageAllowance.js';
import { reportSale } from '../../src/modules/billing/razorpay/razorpay.service.js';
import { setSetting } from '../../src/modules/console/appSettings.js';
import { dobFromAge, forgetAge } from '../../src/modules/users/ageGate.js';
import { createCharacter, createUser } from '../fixtures.js';

/**
 * Razorpay (UPI Autopay / cards) through Google Play user choice billing. A fake Razorpay and a fake Google
 * stand in for the real ones; everything else (routes, database, Premium, coins) is real.
 * Money rules under test: nothing is granted without a valid signature AND Razorpay's own record, a payment
 * can't be claimed by another account, the server's price wins, and each sale is granted once.
 */

const KEY_SECRET = 'rzp_test_secret_for_tests';
const WEBHOOK_SECRET = 'whsec_for_tests';
const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

// ── Fake Razorpay + Google ──────────────────────────────────────────────────
const subs = new Map<string, Record<string, unknown>>();
const payments = new Map<string, Record<string, unknown>>();
const orders = new Map<string, Record<string, unknown>>();
const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
let seq = 0;
const RUN = Date.now().toString(36); // ids stay unique across test runs (the test database keeps old rows)
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? 'GET';
  let body: Record<string, unknown> | undefined;
  try {
    body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
  } catch {
    body = undefined; // a form body (Google's token request)
  }
  calls.push({ method, url, body });
  if (url.startsWith('https://oauth2.googleapis.com')) return Promise.resolve(json({ access_token: 'g-token', expires_in: 3600 }));
  if (url.startsWith('https://androidpublisher.googleapis.com')) return Promise.resolve(json({}));
  const path = url.replace('https://api.razorpay.com/v1', '');
  if (method === 'POST' && path === '/plans') return Promise.resolve(json({ id: 'plan_test' }));
  if (method === 'POST' && path === '/subscriptions') {
    const id = `sub_T${RUN}${++seq}`;
    subs.set(id, { id, status: 'created', start_at: body!['start_at'], charge_at: body!['start_at'], notes: body!['notes'] });
    return Promise.resolve(json(subs.get(id)));
  }
  if (method === 'POST' && path === '/orders') {
    const id = `order_T${RUN}${++seq}`;
    orders.set(id, { id, amount: body!['amount'], currency: 'INR', status: 'created', notes: body!['notes'] });
    return Promise.resolve(json(orders.get(id)));
  }
  const m = path.match(/^\/(payments|subscriptions|orders)\/([A-Za-z0-9_]+)(\/cancel|\/capture)?$/);
  if (m) {
    const store = m[1] === 'payments' ? payments : m[1] === 'subscriptions' ? subs : orders;
    const item = store.get(m[2]!);
    if (!item) return Promise.resolve(json({ error: { description: 'not found' } }, 404));
    if (m[3] === '/cancel') item['status'] = 'cancelled';
    if (m[3] === '/capture') item['status'] = 'captured';
    return Promise.resolve(json(item));
  }
  return Promise.resolve(json({ error: { description: `unexpected ${method} ${path}` } }, 400));
}

/** What Razorpay's checkout hands the app after the user pays. */
function payFirstDay(subscriptionId: string, amount = 100) {
  const id = `pay_T${RUN}${++seq}`;
  payments.set(id, { id, amount, currency: 'INR', status: 'captured', created_at: Math.floor(Date.now() / 1000) });
  subs.get(subscriptionId)!['status'] = 'authenticated';
  return { paymentId: id, signature: hmac(KEY_SECRET, `${id}|${subscriptionId}`) };
}
function payOrder(orderId: string, amount?: number) {
  const id = `pay_T${RUN}${++seq}`;
  payments.set(id, { id, amount: amount ?? orders.get(orderId)!['amount'], currency: 'INR', status: 'captured', order_id: orderId, created_at: 1 });
  return { paymentId: id, signature: hmac(KEY_SECRET, `${orderId}|${id}`) };
}

const app = createApp();
const ENV = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_PLAN_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_PLAY_PACKAGE_NAME'];

beforeAll(async () => {
  const product = await prisma.billingProduct.upsert({ where: { slug: 'premium' }, create: { name: 'Premium', slug: 'premium' }, update: {} });
  await prisma.billingPlan.upsert({ where: { code: 'PREMIUM' }, create: { code: 'PREMIUM', name: 'Premium', productId: product.id }, update: {} });
});
beforeEach(() => {
  process.env['RAZORPAY_KEY_ID'] = 'rzp_test_key';
  process.env['RAZORPAY_KEY_SECRET'] = KEY_SECRET;
  process.env['RAZORPAY_WEBHOOK_SECRET'] = WEBHOOK_SECRET;
  process.env['RAZORPAY_PLAN_ID'] = 'plan_test';
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV) delete process.env[k];
});
afterAll(async () => {
  await prisma.billingWebhookEvent.deleteMany({ where: { provider: 'RAZORPAY' } });
});

const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
async function startPremium(u: { token: string }, googleToken?: string) {
  const res = await request(app).post('/api/v1/billing/razorpay/premium').set(auth(u)).send(googleToken ? { googleToken } : {});
  expect(res.status).toBe(200);
  return res.body.data as { subscriptionId: string; firstDayMinorUnits: number; monthlyMinorUnits: number; chargesFrom: string };
}
function webhook(event: string, payload: Record<string, unknown>, eventId = `evt_${++seq}`, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify({ event, payload });
  return request(app)
    .post('/api/v1/billing/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', hmac(secret, raw))
    .set('X-Razorpay-Event-Id', eventId)
    .send(raw);
}

describe('Premium through UPI Autopay: ₹1 today, ₹499 a month from tomorrow', () => {
  it('starts with ₹1 now and the first ₹499 a day later', async () => {
    const u = await createUser({ verified: true });
    const s = await startPremium(u);
    expect(s).toMatchObject({ firstDayMinorUnits: 100, monthlyMinorUnits: 49900 });
    const created = calls.find((c) => c.url.endsWith('/subscriptions'))!.body!;
    expect(created['plan_id']).toBe('plan_test');
    expect((created['addons'] as Array<{ item: { amount: number } }>)[0]!.item.amount).toBe(100);
    expect(Number(created['start_at']) * 1000 - Date.now()).toBeGreaterThan(86_000_000);
    expect((created['notes'] as Record<string, string>)['userId']).toBe(u.id);
    expect(await hasPremium(u.id)).toBe(false); // nothing until it's paid
  });

  it('a valid payment turns Premium on until the first ₹499 is due — once, however often it is confirmed', async () => {
    const u = await createUser({ verified: true });
    const s = await startPremium(u);
    const paid = payFirstDay(s.subscriptionId);
    const body = { kind: 'premium', subscriptionId: s.subscriptionId, ...paid };
    const first = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send(body);
    expect(first.status).toBe(200);
    expect(first.body.data.premium).toBe(true);
    await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send(body).expect(200);
    expect(await prisma.purchaseTransaction.count({ where: { userId: u.id, provider: 'RAZORPAY' } })).toBe(1);
    const sub = await prisma.billingSubscription.findUniqueOrThrow({ where: { providerSubscriptionId: s.subscriptionId } });
    expect(sub.status).toBe('TRIALING');
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 86_000_000);
  });

  it('a forged signature grants nothing', async () => {
    const u = await createUser({ verified: true });
    const s = await startPremium(u);
    const { paymentId } = payFirstDay(s.subscriptionId);
    const res = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'premium', subscriptionId: s.subscriptionId, paymentId, signature: 'a'.repeat(64) });
    expect(res.status).toBe(400);
    expect(await hasPremium(u.id)).toBe(false);
  });

  it("someone else can't claim another account's payment", async () => {
    const owner = await createUser({ verified: true });
    const other = await createUser({ verified: true });
    const s = await startPremium(owner);
    const paid = payFirstDay(s.subscriptionId);
    const res = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(other)).send({ kind: 'premium', subscriptionId: s.subscriptionId, ...paid });
    expect(res.status).toBe(400);
    expect(await hasPremium(other.id)).toBe(false);
  });

  it('cancelling on the first day stops the ₹499 now and keeps Premium until the day ends', async () => {
    const u = await createUser({ verified: true });
    const s = await startPremium(u);
    await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'premium', subscriptionId: s.subscriptionId, ...payFirstDay(s.subscriptionId) }).expect(200);
    const res = await request(app).post('/api/v1/billing/razorpay/cancel').set(auth(u)).send({});
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.url.endsWith(`/subscriptions/${s.subscriptionId}/cancel`))!.body).toEqual({ cancel_at_cycle_end: 0 });
    expect(await hasPremium(u.id)).toBe(true);
    expect(new Date(res.body.data.premiumUntil).getTime()).toBeLessThan(Date.now() + 86_500_000);
  });
});

describe('webhooks keep Premium in step with the bank', () => {
  async function premiumUser() {
    const u = await createUser({ verified: true });
    const s = await startPremium(u);
    await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'premium', subscriptionId: s.subscriptionId, ...payFirstDay(s.subscriptionId) }).expect(200);
    return { u, subId: s.subscriptionId };
  }

  it('only Razorpay can send them (signed with the webhook secret)', async () => {
    const res = await webhook('subscription.halted', { subscription: { entity: { id: 'sub_x' } } }, 'evt_forged', 'not-the-secret');
    expect(res.status).toBe(401);
  });

  it('a monthly ₹499 renews Premium for the new month, counted once even if Razorpay sends it twice', async () => {
    const { u, subId } = await premiumUser();
    const now = Math.floor(Date.now() / 1000);
    const charged = {
      subscription: { entity: { id: subId, status: 'active', current_start: now, current_end: now + 30 * 86_400 } },
      payment: { entity: { id: `pay_R${RUN}${++seq}`, amount: 49900, currency: 'INR', status: 'captured', created_at: now } },
    };
    await webhook('subscription.charged', charged, 'evt_renew_1').expect(200);
    await webhook('subscription.charged', charged, 'evt_renew_1').expect(200);
    const sub = await prisma.billingSubscription.findUniqueOrThrow({ where: { providerSubscriptionId: subId } });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(await prisma.purchaseTransaction.count({ where: { userId: u.id, amountMinorUnits: 49900 } })).toBe(1);
  });

  it('when every retry of a debit fails, Premium stops', async () => {
    const { u, subId } = await premiumUser();
    await webhook('subscription.halted', { subscription: { entity: { id: subId, status: 'halted' } } }).expect(200);
    expect(await hasPremium(u.id)).toBe(false);
  });
});

describe('coin packs (one-time UPI payments)', () => {
  it('charge the server price and add the coins once', async () => {
    const u = await createUser({ verified: true });
    const start = await request(app).post('/api/v1/billing/razorpay/coins').set(auth(u)).send({ packId: 'coins_330' });
    expect(start.status).toBe(200);
    expect(start.body.data).toMatchObject({ amountMinorUnits: 14900, coins: 330 });
    const orderId = start.body.data.orderId as string;
    const body = { kind: 'coins', orderId, ...payOrder(orderId) };
    const res = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.coins).toBeGreaterThanOrEqual(330);
    const before = res.body.data.coins as number;
    const again = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send(body);
    expect(again.body.data.coins).toBe(before);
  });

  it('refuse an unknown pack and a payment for less than the price', async () => {
    const u = await createUser({ verified: true });
    await request(app).post('/api/v1/billing/razorpay/coins').set(auth(u)).send({ packId: 'coins_free_million' }).expect(400);
    const start = await request(app).post('/api/v1/billing/razorpay/coins').set(auth(u)).send({ packId: 'coins_1000' });
    const orderId = start.body.data.orderId as string;
    const res = await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'coins', orderId, ...payOrder(orderId, 100) });
    expect(res.status).toBe(400);
  });
});

describe('each UPI sale is reported to Google (user choice billing)', () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] = JSON.stringify({
      type: 'service_account',
      client_email: 'play@test.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      token_uri: 'https://oauth2.googleapis.com/token',
    });
    process.env['GOOGLE_PLAY_PACKAGE_NAME'] = 'com.aicompanionmobile';
  });

  it('a sale bought after Google’s choice screen is reported with its token; its renewals point back to it', async () => {
    const u = await createUser({ verified: true });
    const s = await startPremium(u, 'choice-token-123');
    await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'premium', subscriptionId: s.subscriptionId, ...payFirstDay(s.subscriptionId) }).expect(200);
    const first = calls.find((c) => c.url.includes('/externalTransactions?externalTransactionId='));
    expect(first).toBeDefined();
    expect(first!.body).toMatchObject({
      originalPreTaxAmount: { priceMicros: '1000000', currency: 'INR' },
      userTaxAddress: { regionCode: 'IN' },
      recurringTransaction: { externalTransactionToken: 'choice-token-123', externalSubscription: { subscriptionType: 'RECURRING' } },
    });
    const firstTx = await prisma.purchaseTransaction.findFirstOrThrow({ where: { userId: u.id, provider: 'RAZORPAY' } });
    expect((firstTx.metadata as { google: { status: string } }).google.status).toBe('reported');

    const now = Math.floor(Date.now() / 1000);
    await webhook('subscription.charged', {
      subscription: { entity: { id: s.subscriptionId, status: 'active', current_start: now, current_end: now + 30 * 86_400 } },
      payment: { entity: { id: `pay_R${RUN}${++seq}`, amount: 49900, currency: 'INR', status: 'captured', created_at: now } },
    }).expect(200);
    const renewal = calls.filter((c) => c.url.includes('/externalTransactions?externalTransactionId=')).at(-1)!;
    expect(renewal.body).toMatchObject({
      originalPreTaxAmount: { priceMicros: '499000000' },
      recurringTransaction: { initialExternalTransactionId: firstTx.id },
    });
  });

  it('a report that fails is kept and retried — it is not lost', async () => {
    const u = await createUser({ verified: true });
    const start = await request(app).post('/api/v1/billing/razorpay/coins').set(auth(u)).send({ packId: 'coins_100', googleToken: 'tok-coins' });
    const orderId = start.body.data.orderId as string;
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) =>
      String(input).includes('androidpublisher') ? Promise.resolve(json({ error: 'down' }, 503)) : fakeFetch(input, init),
    ));
    await request(app).post('/api/v1/billing/razorpay/confirm').set(auth(u)).send({ kind: 'coins', orderId, ...payOrder(orderId) }).expect(200);
    const tx = await prisma.purchaseTransaction.findFirstOrThrow({ where: { userId: u.id, provider: 'RAZORPAY' } });
    expect((tx.metadata as { google: { status: string } }).google.status).toBe('failed');
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
    expect(await reportSale(tx.id)).toBe('reported');
  });
});

describe('the Premium screen face', () => {
  afterAll(async () => {
    await prisma.appSetting.deleteMany({ where: { key: 'paywall.character' } }).catch(() => undefined);
  });

  it('is the character chosen in Settings, with their photo as it is now — and never a romance one for an under-18', async () => {
    const c = await createCharacter();
    await prisma.character.update({ where: { id: c.id }, data: { status: 'PUBLISHED', avatarUrl: 'https://ik.imagekit.io/x/old.webp', category: 'coaching' } });
    const slug = (await prisma.character.findUniqueOrThrow({ where: { id: c.id }, select: { slug: true } })).slug;
    await setSetting(randomUUID(), 'paywall.character', slug);
    const u = await createUser({ verified: true });
    const face = async (who = u) => (await request(app).get('/api/v1/billing/razorpay/config').set(auth(who))).body.data.face;

    expect((await face())?.avatarUrl).toBe('https://ik.imagekit.io/x/old.webp');
    await prisma.character.update({ where: { id: c.id }, data: { avatarUrl: 'https://ik.imagekit.io/x/new.webp' } });
    expect((await face())?.avatarUrl).toBe('https://ik.imagekit.io/x/new.webp'); // a new photo shows by itself

    await prisma.character.update({ where: { id: c.id }, data: { category: 'love' } });
    const teen = await createUser({ verified: true });
    await prisma.userProfile.upsert({ where: { userId: teen.id }, create: { userId: teen.id, displayName: 'T', dateOfBirth: dobFromAge(15) }, update: { dateOfBirth: dobFromAge(15) } });
    forgetAge(teen.id);
    expect(await face(teen)).toBeNull();
  });
});
