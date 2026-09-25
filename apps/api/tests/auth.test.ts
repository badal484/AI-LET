import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { UserStatus } from '@prisma/client';

describe('Authentication & Identity Integration Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    // Clean up test users and auth state
    await prisma.auditLog.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.authIdentity.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a user, profile, device and returns tokens', async () => {
      const payload = {
        email: 'Test.User@Example.com',
        password: 'SecurePassword123!',
        displayName: 'Test User',
        device: {
          platform: 'ios',
          deviceName: 'iPhone 15 Pro',
        },
      };

      const res = await request(app).post('/api/v1/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('Test.User@Example.com');
      expect(res.body.data.user.profile.displayName).toBe('Test User');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();

      // Verify email was normalized in database
      const dbUser = await prisma.user.findFirst({
        where: { normalizedEmail: 'test.user@example.com' },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe('SecurePassword123!'); // Hashed with Argon2id
    });

    it('rejects duplicate registration with 409 conflict', async () => {
      const payload = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        displayName: 'Duplicate User',
      };

      await request(app).post('/api/v1/auth/register').send(payload);
      const secondRes = await request(app).post('/api/v1/auth/register').send({
        ...payload,
        email: 'DUPLICATE@EXAMPLE.COM', // Case insensitive collision
      });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const payload = {
        email: 'short@example.com',
        password: 'short',
        displayName: 'Short Password User',
      };

      const res = await request(app).post('/api/v1/auth/register').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('authenticates valid credentials and creates new session', async () => {
      // Register initial account
      await request(app).post('/api/v1/auth/register').send({
        email: 'login.test@example.com',
        password: 'Password123!',
        displayName: 'Login User',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'LOGIN.TEST@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('rejects invalid password with 401 without revealing account details', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'wrongpass@example.com',
        password: 'Password123!',
        displayName: 'Wrong Pass User',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'wrongpass@example.com',
        password: 'IncorrectPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('rejects suspended accounts with 403', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'suspended@example.com',
        password: 'Password123!',
        displayName: 'Suspended User',
      });

      const userId = regRes.body.data.user.id;
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'suspended@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });
  });

  describe('POST /api/v1/auth/refresh (Token Family Rotation & Reuse Detection)', () => {
    it('rotates refresh token on valid refresh request', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'rotate@example.com',
        password: 'Password123!',
        displayName: 'Rotate User',
      });

      const initialRefreshToken = regRes.body.data.tokens.refreshToken;

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).not.toBe(initialRefreshToken); // Token rotated
    });

    it('detects token reuse and immediately invalidates entire token family', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'reuse@example.com',
        password: 'Password123!',
        displayName: 'Reuse User',
      });

      const token1 = regRes.body.data.tokens.refreshToken;

      // Legitimate user refreshes token (token1 -> token2)
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token1 });
      expect(refresh1.status).toBe(200);
      const token2 = refresh1.body.data.tokens.refreshToken;

      // Attacker tries to replay compromised/old token1
      const attackRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token1 });

      expect(attackRes.status).toBe(401);
      expect(attackRes.body.error.code).toBe('AUTH_TOKEN_REUSED');

      // Now legitimate user's token2 should also be invalidated because the family was revoked!
      const victimRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: token2 });

      expect(victimRes.status).toBe(401);
      expect(victimRes.body.error.code).toBe('AUTH_TOKEN_REUSED');
    });
  });

  describe('Password Reset & Email Verification Flows', () => {
    it('completes password reset and invalidates all active sessions', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'resetme@example.com',
        password: 'OldPassword123!',
        displayName: 'Reset Me',
      });

      const oldAccessToken = regRes.body.data.tokens.accessToken;

      // Initiate reset
      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'resetme@example.com' });

      expect(forgotRes.status).toBe(200);
      const resetToken = forgotRes.body.data.resetToken;
      expect(resetToken).toBeDefined();

      // Complete reset
      const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewSecurePassword123!',
      });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Old access token should now be rejected because sessions were revoked
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldAccessToken}`);

      expect(meRes.status).toBe(401);

      // Login with new password succeeds
      const newLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'resetme@example.com',
        password: 'NewSecurePassword123!',
      });
      expect(newLogin.status).toBe(200);
    });

    it('verifies email address with valid single-use token', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'verify@example.com',
        password: 'Password123!',
        displayName: 'Verify User',
      });

      const verificationToken = regRes.body.data.verificationToken;
      expect(verificationToken).toBeDefined();

      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: verificationToken });

      expect(verifyRes.status).toBe(200);

      // Reusing the same verification token should fail
      const reuseRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: verificationToken });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error.code).toBe('AUTH_INVALID_TOKEN');
    });
  });

  describe('Session Management & Logout', () => {
    it('lists active sessions and revokes specific session', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'sessions@example.com',
        password: 'Password123!',
        displayName: 'Sessions User',
      });

      const accessToken = regRes.body.data.tokens.accessToken;

      const sessionsRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(sessionsRes.status).toBe(200);
      expect(sessionsRes.body.data.sessions.length).toBe(1);
      const sessionId = sessionsRes.body.data.sessions[0].id;

      // Revoke session
      const revokeRes = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(revokeRes.status).toBe(200);

      // Subsequent access with that token fails
      const afterRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(afterRes.status).toBe(401);
    });

    it('logout-all revokes all sessions across multiple devices', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        email: 'multidevice@example.com',
        password: 'Password123!',
        displayName: 'Multi Device User',
      });

      const tokenDevice1 = regRes.body.data.tokens.accessToken;

      // Login from Device 2
      const login2 = await request(app).post('/api/v1/auth/login').send({
        email: 'multidevice@example.com',
        password: 'Password123!',
        device: { platform: 'android', deviceName: 'Pixel 8' },
      });
      const tokenDevice2 = login2.body.data.tokens.accessToken;

      // Perform logout-all from Device 1
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${tokenDevice1}`);

      expect(logoutAllRes.status).toBe(200);

      // Both tokens are now invalid
      const check1 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice1}`);
      expect(check1.status).toBe(401);

      const check2 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice2}`);
      expect(check2.status).toBe(401);
    });
  });
});
