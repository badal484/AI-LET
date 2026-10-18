import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { sendEmail } from '../src/infrastructure/email/email.js';
import { rid } from './fixtures.js';

/** "Forgot password" end to end: the email link opens a page on the API where the new password is set. */
describe('password reset by email link', () => {
  const app = createApp();
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function newUser() {
    const email = `reset_${rid()}@test.local`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'OldPassword123!', displayName: 'Reset Test', device: { platform: 'android', deviceName: 'Test' } });
    expect(res.status).toBe(201);
    return email;
  }

  it('sets a new password through the page, signs in with it, and the link works only once', async () => {
    const email = await newUser();
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const token: string = forgot.body.data.resetToken; // returned outside production for tests
    expect(token).toBeTruthy();

    const pageRes = await request(app).get(`/account/reset-password?token=${token}`);
    expect(pageRes.status).toBe(200);
    expect(pageRes.text).toContain('Set a new password');
    expect(pageRes.headers['cache-control']).toBe('no-store');
    expect(pageRes.headers['referrer-policy']).toBe('no-referrer');

    const mismatch = await request(app).post('/account/reset-password').type('form').send({ token, newPassword: 'NewPassword123!', confirm: 'Different123!' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.text).toContain("don't match");

    const ok = await request(app).post('/account/reset-password').type('form').send({ token, newPassword: 'NewPassword123!', confirm: 'NewPassword123!' });
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('your password is changed');

    const device = { platform: 'android', deviceName: 'Test' };
    expect((await request(app).post('/api/v1/auth/login').send({ email, password: 'OldPassword123!', device })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email, password: 'NewPassword123!', device })).status).toBe(200);

    const again = await request(app).post('/account/reset-password').type('form').send({ token, newPassword: 'Another123!xyz', confirm: 'Another123!xyz' });
    expect(again.status).toBe(400);
    expect(again.text).toContain('expired or was already used');
    await prisma.user.deleteMany({ where: { normalizedEmail: email } });
  });

  it('a link with no token says so, and a made-up token never changes anything', async () => {
    expect((await request(app).get('/account/reset-password')).status).toBe(400);
    const res = await request(app).post('/account/reset-password').type('form').send({ token: 'not-a-real-token', newPassword: 'NewPassword123!', confirm: 'NewPassword123!' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('expired or was already used');
  });

  it('escapes the token in the page (no HTML injection through the link)', async () => {
    const res = await request(app).get('/account/reset-password?token=%22%3E%3Cscript%3Ealert(1)%3C/script%3E');
    expect(res.text).not.toContain('<script>alert(1)</script>');
  });

  it('sends the email through Resend with the link, and reports false without a key', async () => {
    expect(await sendEmail({ to: 'a@test.local', subject: 's', text: 't', html: 'h' })).toBe(false);

    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Loveek <no-reply@example.com>');
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const email = await newUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email });
    // Sign-up also emails a verification link; pick the reset email.
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes('api.resend.com') && String((init as RequestInit | undefined)?.body).includes('reset-password'));
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call![1] as RequestInit).body)) as { to: string[]; text: string };
    expect(body.to).toEqual([email]);
    expect(body.text).toMatch(/https:\/\/api\.example\.com\/account\/reset-password\?token=[a-f0-9]{64}/);
    await prisma.user.deleteMany({ where: { normalizedEmail: email } });
  });
});
