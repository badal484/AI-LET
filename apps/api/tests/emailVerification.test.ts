import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { rid } from './fixtures.js';

/**
 * Email verification end to end (audit H-1): sign-up emails a link; opening it shows a button (email scanners
 * that open links can't use it up); pressing it verifies; "resend" makes older links stop working.
 */
describe('email verification', () => {
  const app = createApp();
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** Captures what would be sent through Resend. */
  function captureEmails() {
    vi.stubEnv('RESEND_API_KEY', 'test_key');
    vi.stubEnv('EMAIL_FROM', 'Loveek <no-reply@example.com>');
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.com');
    const sent: Array<{ to: string[]; subject: string; text: string }> = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 });
      }
      return realFetch(url, init);
    });
    return sent;
  }
  const linkToken = (text: string) => /verify-email\?token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';

  async function register(email: string) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ageConfirmed: true, email, password: 'Password123!', displayName: 'Verify Test', device: { platform: 'android', deviceName: 'Test' } });
    expect(res.status).toBe(201);
    return res.body.data.tokens.accessToken as string;
  }

  it('sign-up emails a link; opening it does not verify; pressing the button does, once', async () => {
    const sent = captureEmails();
    const email = `verify_${rid()}@test.local`;
    await register(email);
    await vi.waitFor(() => expect(sent.length).toBe(1));
    expect(sent[0]!.to).toEqual([email]);
    expect(sent[0]!.text).toContain('https://api.example.com/account/verify-email?token=');
    const token = linkToken(sent[0]!.text);

    const pageRes = await request(app).get(`/account/verify-email?token=${token}`);
    expect(pageRes.status).toBe(200);
    expect(pageRes.text).toContain('Verify my email');
    expect(pageRes.headers['cache-control']).toBe('no-store');
    expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).toBeNull();

    const done = await request(app).post('/account/verify-email').type('form').send({ token });
    expect(done.status).toBe(200);
    expect(done.text).toContain('your email is verified');
    expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();

    const again = await request(app).post('/account/verify-email').type('form').send({ token });
    expect(again.status).toBe(400);
  });

  it('resend makes the older link stop working; an already verified account gets nothing new', async () => {
    const sent = captureEmails();
    const email = `verify_${rid()}@test.local`;
    const access = await register(email);
    await vi.waitFor(() => expect(sent.length).toBe(1));
    const first = linkToken(sent[0]!.text);

    const resend = await request(app).post('/api/v1/auth/resend-verification').set('Authorization', `Bearer ${access}`);
    expect(resend.status).toBe(200);
    expect(resend.body.data).toEqual({ sent: true, alreadyVerified: false });
    const second = linkToken(sent[1]!.text);
    expect(second).not.toBe(first);

    expect((await request(app).post('/account/verify-email').type('form').send({ token: first })).status).toBe(400);
    expect((await request(app).post('/account/verify-email').type('form').send({ token: second })).status).toBe(200);

    const after = await request(app).post('/api/v1/auth/resend-verification').set('Authorization', `Bearer ${access}`);
    expect(after.body.data).toEqual({ sent: false, alreadyVerified: true });
  });

  it('resend needs a signed-in user', async () => {
    expect((await request(app).post('/api/v1/auth/resend-verification')).status).toBe(401);
  });
});
