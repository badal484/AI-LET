import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetPubsubCertsForTests, verifyPubsubPush } from '../../src/modules/billing/webhooks/pubsubAuth.js';

/** Audit M-4: Google Play notifications are accepted only with Google's signed token for our push subscription. */
describe('Play notification authentication (Pub/Sub push)', () => {
  const ACCOUNT = 'play-push@loveek-test.iam.gserviceaccount.com';
  const AUDIENCE = 'https://api.example.com/api/v1/billing/webhooks/google';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };
  const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  const sign = (claims: Record<string, unknown>, key = privateKey, kid = 'test-kid') =>
    jwt.sign({ iss: 'https://accounts.google.com', aud: AUDIENCE, email: ACCOUNT, email_verified: true, exp: Math.floor(Date.now() / 1000) + 300, ...claims }, key, { algorithm: 'RS256', keyid: kid });

  beforeAll(() => {
    vi.stubEnv('PUBSUB_PUSH_SERVICE_ACCOUNT', ACCOUNT);
    vi.stubEnv('PUBSUB_PUSH_AUDIENCE', AUDIENCE);
  });
  afterEach(() => {
    resetPubsubCertsForTests();
    vi.unstubAllGlobals();
  });
  const googleCerts = () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) =>
      String(url) === 'https://www.googleapis.com/oauth2/v3/certs' ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }) : realFetch(url, init),
    );
  };

  it('accepts Google’s token for our account and audience', async () => {
    googleCerts();
    expect(await verifyPubsubPush(`Bearer ${sign({})}`)).toBe(true);
  });

  it('refuses: no token, another account, another audience, unverified email, a forged signature, an expired token', async () => {
    googleCerts();
    expect(await verifyPubsubPush(undefined)).toBe(false);
    expect(await verifyPubsubPush(`Bearer ${sign({ email: 'someone@else.iam.gserviceaccount.com' })}`)).toBe(false);
    expect(await verifyPubsubPush(`Bearer ${sign({ aud: 'https://evil.example.com/hook' })}`)).toBe(false);
    expect(await verifyPubsubPush(`Bearer ${sign({ email_verified: false })}`)).toBe(false);
    expect(await verifyPubsubPush(`Bearer ${sign({}, otherKey)}`)).toBe(false);
    expect(await verifyPubsubPush(`Bearer ${sign({ exp: Math.floor(Date.now() / 1000) - 60 })}`)).toBe(false);
  });

  it('the webhook answers 401 to an unsigned notification and passes a signed one on', async () => {
    googleCerts();
    const app = createApp();
    const body = { message: { messageId: 'm-auth-1', data: Buffer.from(JSON.stringify({ packageName: 'com.aicompanionmobile', testNotification: { version: '1.0' } })).toString('base64') } };
    const unsigned = await request(app).post('/api/v1/billing/webhooks/google').send(body);
    expect(unsigned.status).toBe(401);
    const signed = await request(app).post('/api/v1/billing/webhooks/google').set('Authorization', `Bearer ${sign({})}`).send(body);
    expect(signed.status).not.toBe(401);
  });
});
