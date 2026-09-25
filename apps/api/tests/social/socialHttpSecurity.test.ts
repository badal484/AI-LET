import crypto from 'crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAdminToken } from '../../src/security/tokens.js';
import { SocialPolicyService } from '../../src/modules/social/policy/SocialPolicyService.js';
import { PrivacyPolicyService } from '../../src/modules/social/identity/PrivacyPolicyService.js';
import { SocialGraphService } from '../../src/modules/social/graph/SocialGraphService.js';
import { SocialContentService } from '../../src/modules/social/content/SocialContentService.js';
import { makeCreator, createCharacter, createSocialUser, enableAllSocialFeatures, flushEvents, rid } from './fixtures.js';

const app = createApp();
const idem = () => `idem-${crypto.randomUUID()}`;

async function adminWith(permissions: string[]) {
  const tag = rid(4);
  const admin = await prisma.adminUser.create({ data: { email: `admin_${tag}@test.local`, normalizedEmail: `admin_${tag}@test.local`, passwordHash: 'x', displayName: 'Test Admin' } });
  const role = await prisma.adminRole.create({ data: { name: `social_test_${tag}`, description: 'test' } });
  for (const name of permissions) {
    const perm = await prisma.adminPermission.upsert({ where: { name }, create: { name, description: name }, update: {} });
    await prisma.adminRolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  await prisma.adminRoleAssignment.create({ data: { adminId: admin.id, roleId: role.id } });
  return signAdminToken({ adminId: admin.id, email: admin.email, roles: [role.name], permissions });
}

describe('Social HTTP security', () => {
  beforeAll(enableAllSocialFeatures);

  it('every mutation requires an Idempotency-Key', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    const res = await request(app).post('/api/v1/social/follows').set('Authorization', `Bearer ${a.token}`).send({ target: b.publicId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SOCIAL_IDEMPOTENCY_KEY_REQUIRED');
    const ok = await request(app).post('/api/v1/social/follows').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ target: b.publicId });
    expect(ok.status).toBe(200);
  });

  it('never accepts internal user ids as targets (public ids / usernames only)', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    const res = await request(app).post('/api/v1/social/follows').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ target: b.id });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.userFollow.count({ where: { followerUserId: a.id } })).toBe(0);
  });

  it('anonymous profile reads are minimized and contain no internal identifiers', async () => {
    const u = await createSocialUser();
    const res = await request(app).get(`/api/v1/social/users/${u.username}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isFullView).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(u.id);
    expect(JSON.stringify(res.body)).not.toMatch(/@test\.local/);
  });

  it('blocked users get 404 at the HTTP layer (indistinguishable from nonexistent)', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await PrivacyPolicyService.update(a.id, { profileVisibility: 'PUBLIC' });
    await SocialGraphService.block(a.id, b.publicId);
    const res = await request(app).get(`/api/v1/social/users/${a.publicId}`).set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
    const missing = await request(app).get(`/api/v1/social/users/nobody${rid(3)}`).set('Authorization', `Bearer ${b.token}`);
    expect(missing.status).toBe(404);
    expect(res.body.error.message).toBe(missing.body.error.message);
  });

  it('kill switch returns 403 SOCIAL_FEATURE_DISABLED without affecting blocking/reporting', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    const adminId = crypto.randomUUID();
    await SocialPolicyService.setKillSwitch('user_following', true, 'incident: follow spam wave', adminId);
    try {
      const res = await request(app).post('/api/v1/social/follows').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ target: b.publicId });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SOCIAL_FEATURE_DISABLED');
      const block = await request(app).post('/api/v1/social/blocks').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ target: b.publicId });
      expect(block.status).toBe(200);
    } finally {
      await SocialPolicyService.setKillSwitch('user_following', false, 'incident: follow spam wave resolved', adminId);
    }
  });

  it('SCRAPING: profile reads are rate limited per caller', async () => {
    const target = await createSocialUser();
    const scraper = await createSocialUser();
    await SocialPolicyService.applyPatch({ patch: { rateLimits: { profile_read: { limit: 3, windowSeconds: 3600 } } }, changeReason: 'test: low scrape limit', adminId: crypto.randomUUID() });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await request(app).get(`/api/v1/social/users/${target.publicId}`).set('Authorization', `Bearer ${scraper.token}`)).status);
      expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
      expect(codes[4]).toBe(429);
    } finally {
      await enableAllSocialFeatures();
    }
  });

  it('STALE CACHE: after a block, the cached ranked feed never serves the blocked author', async () => {
    const reader = await createSocialUser();
    const creatorUser = await createSocialUser();
    const creator = await makeCreator(creatorUser.id);
    await createCharacter({ creatorProfileId: creator.id });
    await PrivacyPolicyService.update(creatorUser.id, { profileVisibility: 'PUBLIC' });
    await SocialGraphService.follow(reader.id, creatorUser.publicId);
    for (let i = 0; i < 4; i++) await SocialContentService.createPost(creatorUser.id, { kind: 'CREATOR_POST', body: `Lore drop number ${i} about the northern lights`, visibility: 'PUBLIC', topics: [] });

    const p1 = await request(app).get('/api/v1/social/feed?tab=FOR_YOU&limit=2').set('Authorization', `Bearer ${reader.token}`);
    expect(p1.status).toBe(200);
    expect(p1.body.data.items.length).toBeGreaterThan(0);
    expect(p1.body.data.nextCursor).toBeTruthy();

    await SocialGraphService.block(reader.id, creatorUser.publicId);
    // Even an old cursor pointing into the cached ranking must not return the blocked author.
    const p2 = await request(app).get(`/api/v1/social/feed?tab=FOR_YOU&limit=2&cursor=${encodeURIComponent(p1.body.data.nextCursor)}`).set('Authorization', `Bearer ${reader.token}`);
    expect(p2.status).toBe(200);
    expect(p2.body.data.items.every((i: { content: { author: { publicId: string } | null } }) => i.content.author?.publicId !== creatorUser.publicId)).toBe(true);
    const fresh = await request(app).get('/api/v1/social/feed?tab=FOLLOWING').set('Authorization', `Bearer ${reader.token}`);
    expect(fresh.body.data.items).toHaveLength(0);
    await flushEvents();
  });

  it('admin: moderation needs SOCIAL_MODERATE; private DM content needs a separate break-glass permission', async () => {
    const reader = await adminWith([ADMIN_PERMISSIONS.SOCIAL_READ]);
    const moderator = await adminWith([ADMIN_PERMISSIONS.SOCIAL_READ, ADMIN_PERMISSIONS.SOCIAL_MODERATE]);
    expect((await request(app).get('/api/v1/admin/social/overview')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/social/overview').set('Authorization', `Bearer ${reader}`)).status).toBe(200);
    expect((await request(app).get('/api/v1/admin/social/cases').set('Authorization', `Bearer ${reader}`)).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/social/cases').set('Authorization', `Bearer ${moderator}`)).status).toBe(200);
    const breakGlass = await request(app)
      .post(`/api/v1/admin/social/cases/${crypto.randomUUID()}/private-content`)
      .set('Authorization', `Bearer ${moderator}`)
      .send({ purpose: 'SAFETY_INVESTIGATION', justification: 'Investigating a harassment report in detail.' });
    expect(breakGlass.status).toBe(403);
  });

  it('admin: dangerous policy changes require explicit confirmation and a reason; every change is versioned', async () => {
    const cfg = await adminWith([ADMIN_PERMISSIONS.SOCIAL_READ, ADMIN_PERMISSIONS.SOCIAL_CONFIG_WRITE]);
    const noConfirm = await request(app).patch('/api/v1/admin/social/policy').set('Authorization', `Bearer ${cfg}`).send({ patch: { comments: { maxLength: 800 } }, changeReason: 'shorter comments for test' });
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.error.code).toBe('VALIDATION_ERROR');
    const before = (await request(app).get('/api/v1/admin/social/policy').set('Authorization', `Bearer ${cfg}`)).body.data.version as number;
    const ok = await request(app).patch('/api/v1/admin/social/policy').set('Authorization', `Bearer ${cfg}`).send({ patch: { comments: { maxLength: 800 } }, changeReason: 'shorter comments for test', confirm: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.diff).toEqual({ 'comments.maxLength': { from: 1000, to: 800 } });
    const rollback = await request(app).post('/api/v1/admin/social/policy/rollback').set('Authorization', `Bearer ${cfg}`).send({ toVersion: before, changeReason: 'roll back test change', confirm: true });
    expect(rollback.status).toBe(200);
    expect(rollback.body.data.rolledBackFrom).toBe(ok.body.data.version);
    expect((await request(app).get('/api/v1/admin/social/policy').set('Authorization', `Bearer ${cfg}`)).body.data.config.comments.maxLength).toBe(1000);
  });
});
