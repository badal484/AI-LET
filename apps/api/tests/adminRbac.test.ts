import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { hashPassword } from '../src/security/password.js';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, DEFAULT_ROLE_PERMISSIONS } from '@ai-companion/config';

describe('Admin RBAC & Privilege Escalation Defense Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.adminSession.deleteMany();
    await prisma.adminRoleAssignment.deleteMany();
    await prisma.adminRolePermission.deleteMany();
    await prisma.adminRole.deleteMany();
    await prisma.adminPermission.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Setup RBAC Roles and Permissions
    for (const permName of Object.values(ADMIN_PERMISSIONS)) {
      await prisma.adminPermission.create({
        data: { name: permName, description: `Permission ${permName}` },
      });
    }

    for (const roleName of Object.values(ADMIN_ROLES)) {
      const role = await prisma.adminRole.create({
        data: { name: roleName, description: `Role ${roleName}` },
      });

      const allowedPermissions = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
      for (const permName of allowedPermissions) {
        const perm = await prisma.adminPermission.findUnique({ where: { name: permName } });
        if (perm) {
          await prisma.adminRolePermission.create({
            data: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
  });

  async function createAdminWithRole(email: string, password: string, roleName: string) {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.adminUser.create({
      data: {
        email,
        normalizedEmail: email.toLowerCase(),
        passwordHash,
        displayName: `${roleName} User`,
        isActive: true,
      },
    });

    const role = await prisma.adminRole.findUnique({ where: { name: roleName } });
    if (role) {
      await prisma.adminRoleAssignment.create({
        data: { adminId: admin.id, roleId: role.id },
      });
    }

    return admin;
  }

  describe('Admin Authentication & Session', () => {
    it('authenticates admin and returns roles, permissions and sets cookie', async () => {
      await createAdminWithRole('super@example.com', 'AdminPass123!', ADMIN_ROLES.SUPER_ADMIN);

      const res = await request(app).post('/api/v1/admin/login').send({
        email: 'super@example.com',
        password: 'AdminPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.roles).toContain(ADMIN_ROLES.SUPER_ADMIN);
      expect(res.body.data.admin.permissions.length).toBeGreaterThan(5);
      expect(res.headers['set-cookie']).toBeDefined(); // HttpOnly cookie set
    });

    it('rejects deactivated admin accounts', async () => {
      const admin = await createAdminWithRole('disabled@example.com', 'AdminPass123!', ADMIN_ROLES.ADMIN);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { isActive: false },
      });

      const res = await request(app).post('/api/v1/admin/login').send({
        email: 'disabled@example.com',
        password: 'AdminPass123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ADMIN_UNAUTHORIZED');
    });
  });

  describe('RBAC Permission Enforcement & Escalation Protection', () => {
    it('allows support admin to read users but forbids changing settings', async () => {
      await createAdminWithRole('support@example.com', 'SupportPass123!', ADMIN_ROLES.SUPPORT);

      const loginRes = await request(app).post('/api/v1/admin/login').send({
        email: 'support@example.com',
        password: 'SupportPass123!',
      });

      const supportToken = loginRes.body.data.token;

      // 1. Support admin CAN list users (users.read permission granted)
      const listRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(listRes.status).toBe(200);

      // 2. Support admin CANNOT assign roles (settings.write permission required)
      const roleAssignRes = await request(app)
        .post('/api/v1/admin/roles/assign')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ targetAdminId: '00000000-0000-0000-0000-000000000000', roleName: 'admin' });

      expect(roleAssignRes.status).toBe(403);
      expect(roleAssignRes.body.error.code).toBe('ADMIN_FORBIDDEN');
    });

    it('rejects regular consumer users from accessing admin routes', async () => {
      // Register regular consumer user
      const userReg = await request(app).post('/api/v1/auth/register').send({
        email: 'consumer@example.com',
        password: 'UserPassword123!',
        displayName: 'Consumer User',
      });

      const consumerAccessToken = userReg.body.data.tokens.accessToken;

      // Consumer user attempts to call admin endpoint
      const adminRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${consumerAccessToken}`);

      expect(adminRes.status).toBe(401);
      expect(adminRes.body.error.code).toBe('ADMIN_UNAUTHORIZED');
    });

    it('admin user suspension action immediately blocks consumer user from API', async () => {
      // 1. Create super admin and consumer user
      await createAdminWithRole('super@example.com', 'AdminPass123!', ADMIN_ROLES.SUPER_ADMIN);
      const adminLogin = await request(app).post('/api/v1/admin/login').send({
        email: 'super@example.com',
        password: 'AdminPass123!',
      });
      const adminToken = adminLogin.body.data.token;

      const userReg = await request(app).post('/api/v1/auth/register').send({
        email: 'badactor@example.com',
        password: 'UserPass123!',
        displayName: 'Bad Actor',
      });
      const userToken = userReg.body.data.tokens.accessToken;
      const targetUserId = userReg.body.data.user.id;

      // 2. Consumer user verifies they can access their profile
      const beforeSuspend = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(beforeSuspend.status).toBe(200);

      // 3. Admin suspends target user
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'TOS violation' });

      expect(suspendRes.status).toBe(200);

      // 4. Consumer user is immediately rejected with 403
      const afterSuspend = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(afterSuspend.status).toBe(403);
      expect(afterSuspend.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });

    it('creates append-only audit log entries for administrative actions', async () => {
      await createAdminWithRole('super@example.com', 'AdminPass123!', ADMIN_ROLES.SUPER_ADMIN);
      const adminLogin = await request(app).post('/api/v1/admin/login').send({
        email: 'super@example.com',
        password: 'AdminPass123!',
      });
      const adminToken = adminLogin.body.data.token;

      // View audit logs
      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThan(0);
      expect(auditRes.body.data[0].action).toBe('ADMIN_LOGIN_SUCCESS');
    });
  });
});
