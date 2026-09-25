import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';
import { hashPassword } from '../src/security/password.js';
import { signAdminToken } from '../src/security/tokens.js';
import { AdminCharacterService } from '../src/modules/characters/services/adminCharacter.service.js';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, DEFAULT_ROLE_PERMISSIONS } from '@ai-companion/config';

describe('Public Character API & Admin RBAC Endpoints', () => {
  const app = createApp();
  let superAdminToken: string;
  let supportAdminToken: string;
  let contentManagerToken: string;
  let superAdminId: string;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.characterVersion.deleteMany();
    await prisma.character.deleteMany();
    await prisma.adminSession.deleteMany();
    await prisma.adminRoleAssignment.deleteMany();
    await prisma.adminRolePermission.deleteMany();
    await prisma.adminRole.deleteMany();
    await prisma.adminPermission.deleteMany();
    await prisma.adminUser.deleteMany();

    // Clear test redis keys
    try {
      const keys = await redis.keys('char:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {}

    // Seed permissions & roles
    for (const permName of Object.values(ADMIN_PERMISSIONS)) {
      await prisma.adminPermission.create({
        data: { name: permName, description: permName },
      });
    }

    for (const roleName of Object.values(ADMIN_ROLES)) {
      const role = await prisma.adminRole.create({
        data: { name: roleName, description: roleName },
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

    // Create Super Admin
    const passHash = await hashPassword('AdminPass123!');
    const superAdmin = await prisma.adminUser.create({
      data: {
        email: 'super@ai-companion.local',
        normalizedEmail: 'super@ai-companion.local',
        passwordHash: passHash,
        displayName: 'Super Admin',
        isActive: true,
      },
    });
    superAdminId = superAdmin.id;

    const superRole = await prisma.adminRole.findUnique({ where: { name: ADMIN_ROLES.SUPER_ADMIN } });
    await prisma.adminRoleAssignment.create({
      data: { adminId: superAdmin.id, roleId: superRole!.id },
    });

    superAdminToken = signAdminToken({
      adminId: superAdmin.id,
      email: superAdmin.email,
      roles: [ADMIN_ROLES.SUPER_ADMIN],
      permissions: Object.values(ADMIN_PERMISSIONS),
    });

    // Create Content Manager Admin
    const contentManager = await prisma.adminUser.create({
      data: {
        email: 'content@ai-companion.local',
        normalizedEmail: 'content@ai-companion.local',
        passwordHash: passHash,
        displayName: 'Content Manager',
        isActive: true,
      },
    });

    const contentRole = await prisma.adminRole.findUnique({ where: { name: ADMIN_ROLES.CONTENT_MANAGER } });
    await prisma.adminRoleAssignment.create({
      data: { adminId: contentManager.id, roleId: contentRole!.id },
    });

    contentManagerToken = signAdminToken({
      adminId: contentManager.id,
      email: contentManager.email,
      roles: [ADMIN_ROLES.CONTENT_MANAGER],
      permissions: DEFAULT_ROLE_PERMISSIONS.content_manager as string[],
    });

    // Create Support Admin (Support role has users.read, but NO characters.read/characters.create)
    const supportAdmin = await prisma.adminUser.create({
      data: {
        email: 'support@ai-companion.local',
        normalizedEmail: 'support@ai-companion.local',
        passwordHash: passHash,
        displayName: 'Support Admin',
        isActive: true,
      },
    });

    const supportRole = await prisma.adminRole.findUnique({ where: { name: ADMIN_ROLES.SUPPORT } });
    await prisma.adminRoleAssignment.create({
      data: { adminId: supportAdmin.id, roleId: supportRole!.id },
    });

    supportAdminToken = signAdminToken({
      adminId: supportAdmin.id,
      email: supportAdmin.email,
      roles: [ADMIN_ROLES.SUPPORT],
      permissions: DEFAULT_ROLE_PERMISSIONS.support as string[],
    });
  });

  it('GET /api/v1/characters only returns published characters and excludes drafts', async () => {
    // Create 1 published character and 1 draft character
    const publishedChar = await AdminCharacterService.createCharacter(superAdminId, {
      internalKey: 'char_published_public',
      slug: 'published-char',
      name: 'Published Character',
      tagline: 'Visible to public',
      shortDescription: 'Short description for public',
      longDescription: 'Long description backstory.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'General',
      archetype: 'Companion',
      age: 24,
      gender: 'Female',
      occupation: 'Companion',
    });
    await AdminCharacterService.publishVersion(superAdminId, publishedChar.id, publishedChar.versions[0].id);

    // Create draft character (never published)
    await AdminCharacterService.createCharacter(superAdminId, {
      internalKey: 'char_draft_hidden',
      slug: 'draft-char',
      name: 'Draft Character',
      tagline: 'Hidden from public',
      shortDescription: 'Short description draft',
      longDescription: 'Long description draft.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'General',
      archetype: 'Companion',
      age: 24,
      gender: 'Female',
      occupation: 'Companion',
    });

    const res = await request(app).get('/api/v1/characters');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].slug).toBe('published-char');
  });

  it('GET /api/v1/characters/:idOrSlug returns sanitized profile without internal prompt secrets', async () => {
    const publishedChar = await AdminCharacterService.createCharacter(superAdminId, {
      internalKey: 'char_sanitized_test',
      slug: 'sanitized-luna',
      name: 'Sanitized Luna',
      tagline: 'Testing public data sanitization',
      shortDescription: 'Public description',
      longDescription: 'Long backstory description.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'Astrology',
      archetype: 'Mystic',
      age: 23,
      gender: 'Female',
      occupation: 'Astrologer',
    });
    await AdminCharacterService.publishVersion(superAdminId, publishedChar.id, publishedChar.versions[0].id);

    const res = await request(app).get('/api/v1/characters/sanitized-luna');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.name).toBe('Sanitized Luna');
    expect(data.slug).toBe('sanitized-luna');
    expect(data.traits).toBeDefined();

    // STRICT PRIVACY CHECK: ensure no internal system prompts, hidden rules, or internal keys are leaked
    expect(data.compiledSystemPrompt).toBeUndefined();
    expect(data.systemPromptSnapshot).toBeUndefined();
    expect(data.internalKey).toBeUndefined();
    expect(data.behaviorRulesData).toBeUndefined();
    expect(data.aiConfigData).toBeUndefined();
  });

  it('enforces RBAC permissions on Admin Character Studio routes', async () => {
    // 1. Content Manager has characters.read so CAN list characters
    const listRes = await request(app)
      .get('/api/v1/admin/characters')
      .set('Authorization', `Bearer ${contentManagerToken}`);
    expect(listRes.status).toBe(200);

    // 2. Support Admin LACKS characters.read, so GET /admin/characters must return 403 Forbidden
    const supportListRes = await request(app)
      .get('/api/v1/admin/characters')
      .set('Authorization', `Bearer ${supportAdminToken}`);
    expect(supportListRes.status).toBe(403);
    expect(supportListRes.body.error.code).toBe('ADMIN_FORBIDDEN');

    // 3. Super Admin HAS characters.create and can successfully create characters
    const superCreateRes = await request(app)
      .post('/api/v1/admin/characters')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        internalKey: 'char_allowed',
        slug: 'allowed-char',
        name: 'Allowed Character',
        tagline: 'Allowed Tagline',
        shortDescription: 'Allowed description',
        longDescription: 'Allowed long description backstory.',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      });
    expect(superCreateRes.status).toBe(201);
    expect(superCreateRes.body.data.slug).toBe('allowed-char');
  });
});
