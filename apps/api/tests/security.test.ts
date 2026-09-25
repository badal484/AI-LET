import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import jwt from 'jsonwebtoken';

describe('Security Controls & Boundary Enforcement Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('JWT Security & Token Tampering', () => {
    it('rejects requests with missing Authorization header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('rejects requests with malformed Bearer tokens', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('rejects tokens signed with invalid secret key', async () => {
      const forgedToken = jwt.sign(
        { userId: '00000000-0000-0000-0000-000000000000', email: 'forged@attacker.local' },
        'wrong_attacker_secret_key',
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('rejects expired JWT tokens with AUTH_TOKEN_EXPIRED error code', async () => {
      const expiredToken = jwt.sign(
        { userId: '00000000-0000-0000-0000-000000000000', email: 'expired@example.com' },
        process.env['JWT_ACCESS_SECRET'] || 'development_jwt_access_secret_min_16_chars',
        { expiresIn: '-10s' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
    });
  });

  describe('IDOR & Principal Ownership Enforcement', () => {
    it('prevents User A from revoking User B device', async () => {
      // 1. Create User A
      const userAReg = await request(app).post('/api/v1/auth/register').send({
        email: 'userA@example.com',
        password: 'PasswordA123!',
        displayName: 'User A',
      });
      const tokenA = userAReg.body.data.tokens.accessToken;

      // 2. Create User B with a device
      const userBReg = await request(app).post('/api/v1/auth/register').send({
        email: 'userB@example.com',
        password: 'PasswordB123!',
        displayName: 'User B',
        device: { platform: 'ios', deviceName: "User B's iPhone" },
      });
      const tokenB = userBReg.body.data.tokens.accessToken;

      // Fetch User B's device ID
      const userBDevices = await request(app)
        .get('/api/v1/users/devices')
        .set('Authorization', `Bearer ${tokenB}`);

      const userBDeviceId = userBDevices.body.data.devices[0].id;

      // 3. User A attempts to revoke User B's device
      const attackRes = await request(app)
        .delete(`/api/v1/users/devices/${userBDeviceId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(attackRes.status).toBe(404); // Not found for User A

      // Verify User B's device is still active
      const checkB = await request(app)
        .get('/api/v1/users/devices')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(checkB.body.data.devices.length).toBe(1);
    });

    it('derives user identity strictly from authenticated principal, ignoring spoofed body userId', async () => {
      const userReg = await request(app).post('/api/v1/auth/register').send({
        email: 'principal@example.com',
        password: 'Password123!',
        displayName: 'Legit User',
      });
      const token = userReg.body.data.tokens.accessToken;

      // Send update profile with attempt to spoof a different userId in body
      const updateRes = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Updated Name',
          userId: '00000000-0000-0000-0000-000000000000', // Malicious body property
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.userId).toBe(userReg.body.data.user.id);
    });
  });
});
