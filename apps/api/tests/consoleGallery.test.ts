import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { adminToken, createCharacter, rid } from './fixtures.js';

/** The admin editor reads the stored gallery (not the 15-second list), so a remove/reorder always matches it. */
describe('admin console: character gallery', async () => {
  const app = createApp();
  const admin = await prisma.adminUser.create({
    data: { email: `gallery-${rid()}@test.local`, normalizedEmail: `gallery-${rid()}@test.local`, passwordHash: 'x', displayName: 'Gallery test', isActive: true },
  });
  // Permissions come from the admin's roles in the database.
  const role = await prisma.adminRole.create({ data: { name: `gallery_editor_${rid()}`, description: 'test' } });
  for (const name of [ADMIN_PERMISSIONS.CHARACTERS_READ, ADMIN_PERMISSIONS.CHARACTERS_UPDATE]) {
    const perm = await prisma.adminPermission.upsert({ where: { name }, create: { name, description: name }, update: {} });
    await prisma.adminRolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  await prisma.adminRoleAssignment.create({ data: { adminId: admin.id, roleId: role.id } });
  const token = await adminToken(admin, [role.name], [ADMIN_PERMISSIONS.CHARACTERS_READ, ADMIN_PERMISSIONS.CHARACTERS_UPDATE]);
  const auth = { Authorization: `Bearer ${token}` };
  const character = await createCharacter();
  const stored = ['https://cdn.test/a.webp', 'https://cdn.test/b.webp', 'https://cdn.test/c.webp'];
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: character.id },
    create: { characterId: character.id, localizedProfiles: { galleryImages: stored } },
    update: { localizedProfiles: { galleryImages: stored } },
  });
  const url = `/api/v1/admin/console/characters/${character.id}/gallery`;

  it('returns the gallery as stored', async () => {
    const res = await request(app).get(url).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.gallery).toEqual(stored);
  });

  it('refuses a list with photos that are not in this gallery (an out-of-date editor), and changes nothing', async () => {
    const res = await request(app).put(url).set(auth).send({ images: ['https://elsewhere.test/x.webp'] });
    expect(res.status).toBe(400);
    expect((await request(app).get(url).set(auth)).body.data.gallery).toEqual(stored);
  });

  it('removes a photo when the list matches what is stored', async () => {
    const res = await request(app).put(url).set(auth).send({ images: [stored[0], stored[2]] });
    expect(res.status).toBe(200);
    expect((await request(app).get(url).set(auth)).body.data.gallery).toEqual([stored[0], stored[2]]);
  });

  it('needs the characters permission', async () => {
    const plain = await prisma.adminUser.create({
      data: { email: `plain-${rid()}@test.local`, normalizedEmail: `plain-${rid()}@test.local`, passwordHash: 'x', displayName: 'No roles', isActive: true },
    });
    const nobody = await adminToken(plain, [], []);
    expect((await request(app).get(url).set({ Authorization: `Bearer ${nobody}` })).status).toBe(403);
  });
});
