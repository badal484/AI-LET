import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { redis } from '../../src/infrastructure/redis/redis.js';
import { hashPassword } from '../../src/security/password.js';
import { base32Encode, totpCode, totpStep, verifyTotp } from '../../src/security/totp.js';
import { openSecret, sealSecret } from '../../src/security/secretBox.js';
import { rid } from '../fixtures.js';

/** Audit H-2: two-step sign-in for the admin console, and per-account lockout. */

describe('TOTP codes (RFC 6238)', () => {
  it('matches the RFC test vector and accepts one step of clock drift only', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totpCode(secret, totpStep(59_000))).toBe('287082'); // RFC 6238 T=59 → 94287082 (last 6 digits)
    const now = Date.now();
    const code = totpCode(secret, totpStep(now));
    expect(verifyTotp(secret, code, now)).toBe(totpStep(now));
    expect(verifyTotp(secret, code, now + 30_000)).not.toBeNull();
    expect(verifyTotp(secret, code, now + 90_000)).toBeNull();
    expect(verifyTotp(secret, '000000x', now)).toBeNull();
  });

  it('stored secrets are encrypted, and a changed one is refused', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed)).toBe('JBSWY3DPEHPK3PXP');
    const parts = sealed.split(':');
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith('A') ? 'BB' : 'AA');
    expect(() => openSecret(parts.join(':'))).toThrow();
  });
});

describe('admin console two-step sign-in', () => {
  const app = createApp();
  const email = `twostep_${rid()}@test.local`;
  const password = 'AdminPassword123!';
  let adminId = '';

  beforeAll(async () => {
    vi.stubEnv('ADMIN_REQUIRE_MFA', 'true');
    const admin = await prisma.adminUser.create({
      data: { email, normalizedEmail: email, passwordHash: await hashPassword(password), displayName: 'Two-step', isActive: true },
    });
    adminId = admin.id;
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    const keys = await redis.keys(`login:*:admin:${email}`);
    if (keys.length) await redis.del(...keys);
  });

  const login = (body: Record<string, string>) => request(app).post('/api/v1/admin/login').send({ email, password, ...body });
  const bearer = (res: request.Response) => ({ Authorization: `Bearer ${res.body.data.token as string}` });

  it('without two-step set up, only the setup screen is reachable', async () => {
    const res = await login({});
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/v1/admin/me').set(bearer(res));
    expect(me.body.data.admin).toMatchObject({ mfaSetupOnly: true, mfaEnabled: false });
    const blocked = await request(app).get('/api/v1/admin/console/overview').set(bearer(res));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('AUTH_MFA_REQUIRED');
  });

  it('setup → first code turns it on; then every sign-in needs a fresh code, and a code works once', async () => {
    const first = await login({});
    const setup = await request(app).post('/api/v1/admin/mfa/setup').set(bearer(first));
    expect(setup.status).toBe(200);
    expect(setup.body.data.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const secret: string = setup.body.data.secret;

    expect((await request(app).post('/api/v1/admin/mfa/enable').set(bearer(first)).send({ code: '123456' })).status).toBe(400);
    const enableCode = totpCode(secret, totpStep());
    expect((await request(app).post('/api/v1/admin/mfa/enable').set(bearer(first)).send({ code: enableCode })).status).toBe(200);
    const stored = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    expect(stored.isMfaEnabled).toBe(true);
    expect(stored.mfaSecret).not.toContain(secret);

    const noCode = await login({});
    expect(noCode.status).toBe(403);
    expect(noCode.body.error.code).toBe('AUTH_MFA_REQUIRED');

    const wrong = await login({ mfaCode: enableCode === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(401);

    // The code used to enable is already spent; the next step's code (allowed drift) signs in once.
    expect((await login({ mfaCode: enableCode })).status).toBe(401);
    const next = totpCode(secret, totpStep() + 1);
    const ok = await login({ mfaCode: next });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/v1/admin/me').set(bearer(ok))).body.data.admin).toMatchObject({ mfaEnabled: true, mfaSetupOnly: false });
    expect((await login({ mfaCode: next })).status).toBe(401);
  });
});

describe('per-account sign-in lockout', () => {
  const app = createApp();
  afterEach(() => vi.unstubAllEnvs());

  it('an admin account locks after 5 wrong tries — even the right password is refused for 15 minutes', async () => {
    vi.stubEnv('ADMIN_REQUIRE_MFA', 'false');
    const email = `lock_${rid()}@test.local`;
    await prisma.adminUser.create({ data: { email, normalizedEmail: email, passwordHash: await hashPassword('RightPassword123!'), displayName: 'Lock', isActive: true } });
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/api/v1/admin/login').send({ email, password: `Wrong${i}Password!` })).status).toBe(401);
    }
    const locked = await request(app).post('/api/v1/admin/login').send({ email, password: 'RightPassword123!' });
    expect(locked.status).toBe(429);
    await redis.del(`login:lock:admin:${email}`);
  });

  it('a user account locks after 10 wrong passwords', async () => {
    const email = `ulock_${rid()}@test.local`;
    const reg = await request(app).post('/api/v1/auth/register').send({ ageConfirmed: true, email, password: 'RightPassword123!', displayName: 'Lock', device: { platform: 'android', deviceName: 'Test' } });
    expect(reg.status).toBe(201);
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/v1/auth/login').send({ email, password: `Wrong${i}Password!` })).status).toBe(401);
    }
    const locked = await request(app).post('/api/v1/auth/login').send({ email, password: 'RightPassword123!' });
    expect(locked.status).toBe(429);
    await redis.del(`login:lock:user:${email}`);
  });
});
