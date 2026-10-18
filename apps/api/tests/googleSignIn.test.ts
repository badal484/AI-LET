import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { resetGoogleCertsForTests } from '../src/security/googleIdToken.js';
import { rid } from './fixtures.js';

/** "Continue with Google": only Google-signed tokens for our app; new accounts need 18+; same email links. */
describe('Google sign-in', () => {
  const app = createApp();
  const CLIENT_ID = 'test-web-client.apps.googleusercontent.com';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'g-kid', alg: 'RS256', use: 'sig' };

  const idToken = (claims: Record<string, unknown>, key = privateKey) =>
    jwt.sign(
      { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: `g-${rid()}`, email_verified: true, name: 'Asha Test', exp: Math.floor(Date.now() / 1000) + 300, ...claims },
      key,
      { algorithm: 'RS256', keyid: 'g-kid' },
    );
  const google = (body: Record<string, unknown>) => request(app).post('/api/v1/auth/google').send({ device: { platform: 'android', deviceName: 'Test' }, ...body });

  beforeEach(() => {
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', CLIENT_ID);
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) =>
      String(url) === 'https://www.googleapis.com/oauth2/v3/certs' ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }) : realFetch(url, init),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetGoogleCertsForTests();
  });

  it('a new Google user gets an account with the email already verified (age comes next, on the onboarding screen)', async () => {
    const email = `g_${rid()}@gmail.test`;
    const sub = `g-${rid()}`;
    const ok = await google({ idToken: idToken({ email, sub }) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tokens.accessToken).toBeTruthy();
    expect(ok.body.data.user.emailVerified).toBe(true);
    expect(ok.body.data.user.profile.displayName).toBe('Asha Test');

    // Next time: the same Google account signs straight in, same user.
    const again = await google({ idToken: idToken({ email, sub }) });
    expect(again.status).toBe(200);
    expect(again.body.data.user.id).toBe(ok.body.data.user.id);
  });

  it('an existing email account is linked to Google and signed in (no duplicate account)', async () => {
    const email = `link_${rid()}@gmail.test`;
    const reg = await request(app).post('/api/v1/auth/register').send({ ageConfirmed: true, email, password: 'Password123!', displayName: 'Linker' });
    expect(reg.status).toBe(201);
    const res = await google({ idToken: idToken({ email }) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(reg.body.data.user.id);
    expect(res.body.data.user.emailVerified).toBe(true);
    expect(await prisma.authIdentity.count({ where: { userId: reg.body.data.user.id, provider: 'google' } })).toBe(1);
  });

  it('refuses: a token for another app, a forged signature, an expired token, an unverified Google email', async () => {
    const email = `bad_${rid()}@gmail.test`;
    const base = { email, ageConfirmed: true };
    expect((await google({ idToken: idToken({ ...base, aud: 'someone-else.apps.googleusercontent.com' }), ageConfirmed: true })).status).toBe(401);
    expect((await google({ idToken: idToken(base, otherKey), ageConfirmed: true })).status).toBe(401);
    expect((await google({ idToken: idToken({ ...base, exp: Math.floor(Date.now() / 1000) - 60 }), ageConfirmed: true })).status).toBe(401);
    expect((await google({ idToken: idToken({ ...base, email_verified: false }), ageConfirmed: true })).status).toBe(401);
    expect(await prisma.user.count({ where: { normalizedEmail: email } })).toBe(0);
  });

  it('a suspended account stays locked out through Google too', async () => {
    const email = `sus_${rid()}@gmail.test`;
    const sub = `g-${rid()}`;
    const ok = await google({ idToken: idToken({ email, sub }), ageConfirmed: true });
    await prisma.user.update({ where: { id: ok.body.data.user.id }, data: { status: 'SUSPENDED' } });
    expect((await google({ idToken: idToken({ email, sub }) })).status).toBe(403);
  });

  it('says so when Google sign-in is not set up', async () => {
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', '');
    expect((await google({ idToken: idToken({ email: `x_${rid()}@gmail.test` }) })).status).toBe(503);
  });
});
