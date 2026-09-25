import crypto from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { signAccessToken, signAdminToken } from '../../src/security/tokens.js';
import { createCharacter, createConversation } from '../social/fixtures.js';
import { env } from '../../src/config/env.js';

const app = createApp();
async function user() {
  const tag = crypto.randomBytes(4).toString('hex');
  const u = await prisma.user.create({ data: { email: `authz_${tag}@test.local`, normalizedEmail: `authz_${tag}@test.local`, emailVerifiedAt: new Date() } });
  return { id: u.id, token: signAccessToken({ userId: u.id, email: u.email, roles: ['user'] }) };
}
const idem = () => `idem-${crypto.randomUUID()}`;

describe('authentication is required on user-data routers', () => {
  it('simulation and knowledge reject anonymous callers', async () => {
    for (const path of ['/api/v1/simulation/goals/00000000-0000-4000-8000-000000000001', '/api/v1/simulation/settings/x', '/api/v1/knowledge/documents', '/api/v1/knowledge/collections']) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
    expect((await request(app).post('/api/v1/knowledge/research').send({ query: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/v1/knowledge/qa').send({ query: 'x' })).status).toBe(401);
  });

  it('simulation operator endpoints are admin-only (a user token is not enough)', async () => {
    const u = await user();
    for (const [m, path] of [['post', '/api/v1/admin/simulation/run'], ['get', '/api/v1/admin/simulation/runs'], ['post', '/api/v1/admin/simulation/migrate']] as const) {
      const res = await request(app)[m](path).set('Authorization', `Bearer ${u.token}`).send({});
      expect(res.status, path).toBe(401);
    }
    // The old unauthenticated operator routes no longer exist on the user router.
    expect((await request(app).post('/api/v1/simulation/run').set('Authorization', `Bearer ${u.token}`).send({})).status).toBe(404);
  });
});

describe('identity comes only from the verified token (no ?userId= spoofing)', () => {
  it('simulation goals of user B cannot be read by user A', async () => {
    const a = await user();
    const b = await user();
    const ch = await createCharacter();
    const created = await request(app)
      .post('/api/v1/simulation/goals')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ characterId: ch.id, title: 'B private goal', description: 'only B should see this' });
    expect(created.status).toBe(201);
    const spoof = await request(app).get(`/api/v1/simulation/goals/${ch.id}?userId=${b.id}`).set('Authorization', `Bearer ${a.token}`);
    expect(spoof.status).toBe(200);
    expect(JSON.stringify(spoof.body)).not.toContain('B private goal');
  });

  it('knowledge documents of user B cannot be listed or deleted by user A', async () => {
    const a = await user();
    const b = await user();
    const doc = await request(app)
      .post('/api/v1/knowledge/documents')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ title: 'B secret notes', originalFilename: 'b.txt', mimeType: 'text/plain', rawContent: 'confidential content of user B' });
    expect([200, 201, 202]).toContain(doc.status);
    const list = await request(app).get(`/api/v1/knowledge/documents?userId=${b.id}`).set('Authorization', `Bearer ${a.token}`);
    expect(JSON.stringify(list.body)).not.toContain('B secret notes');
    const docId = doc.body?.data?.id ?? doc.body?.data?.document?.id;
    if (docId) {
      await request(app).delete(`/api/v1/knowledge/documents/${docId}?userId=${b.id}`).set('Authorization', `Bearer ${a.token}`);
      const still = await request(app).get('/api/v1/knowledge/documents').set('Authorization', `Bearer ${b.token}`);
      expect(JSON.stringify(still.body)).toContain('B secret notes');
    }
  });

  it('safety block lists and support tickets never include other users’ records', async () => {
    const a = await user();
    const b = await user();
    const victim = await user();
    const blk = await request(app).post('/api/v1/safety/blocks').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ blockedUserId: victim.id });
    expect([200, 201]).toContain(blk.status);
    const bList = await request(app).get('/api/v1/safety/blocks').set('Authorization', `Bearer ${b.token}`);
    expect(bList.status).toBe(200);
    expect(JSON.stringify(bList.body)).not.toContain(victim.id);

    const t = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', idem()).send({ category: 'bug', subject: 'A private ticket', description: 'details only A should see' });
    expect([200, 201]).toContain(t.status);
    const bTickets = await request(app).get('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${b.token}`);
    expect(JSON.stringify(bTickets.body)).not.toContain('A private ticket');
    const aTickets = await request(app).get('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`);
    expect(JSON.stringify(aTickets.body)).toContain('A private ticket');
  });

  it('privacy endpoints work for the authenticated user (previously broken by user.id)', async () => {
    const a = await user();
    expect((await request(app).get('/api/v1/privacy/settings').set('Authorization', `Bearer ${a.token}`)).status).toBe(200);
    const bad = await request(app).post('/api/v1/privacy/delete-account').set('Authorization', `Bearer ${a.token}`).send({ confirmEmail: 'not-an-email' });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });

  it('creators can load their own creator profile (route no longer shadowed by /:username)', async () => {
    const a = await user();
    const res = await request(app).get('/api/v1/creators/me').set('Authorization', `Bearer ${a.token}`);
    // A non-creator gets a clean "no creator profile" answer, never the public-profile lookup for username "me".
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).not.toMatch(/username/i);
  });
});

describe('request validation is actually enforced for shared schemas', () => {
  it('rejects bodies that violate @ai-companion/validation schemas (CJS/ESM zod boundary)', async () => {
    const a = await user();
    const res = await request(app)
      .post('/api/v1/operations/support/tickets')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ category: 'NOT_A_CATEGORY', subject: 'x', description: 'y' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('global Idempotency-Key replay is scoped to the caller and the request', () => {
  const ticket = (subject: string) => ({ category: 'bug', subject, description: 'idempotency regression body' });

  it('a second user reusing the same key does not receive the first user’s cached response', async () => {
    const a = await user();
    const b = await user();
    const key = idem();
    const ra = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', key).send(ticket('ticket of A'));
    expect(ra.status).toBe(201);
    const rb = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${b.token}`).set('Idempotency-Key', key).send(ticket('ticket of B'));
    expect(rb.status).toBe(201);
    expect(rb.headers['x-idempotent-replay']).toBeUndefined();
    expect(rb.body.data.userId).toBe(b.id);
    expect(JSON.stringify(rb.body)).not.toContain('ticket of A');
  });

  it('replays only the identical request; reuse with a different body is refused', async () => {
    const a = await user();
    const key = idem();
    const first = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', key).send(ticket('first'));
    const replay = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', key).send(ticket('first'));
    expect(replay.headers['x-idempotent-replay']).toBe('true');
    expect(replay.body.data.id).toBe(first.body.data.id);
    const reused = await request(app).post('/api/v1/operations/support/tickets').set('Authorization', `Bearer ${a.token}`).set('Idempotency-Key', key).send(ticket('different'));
    expect(reused.status).toBe(422);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

async function adminWith(permissions: string[]) {
  const tag = crypto.randomBytes(4).toString('hex');
  const admin = await prisma.adminUser.create({ data: { email: `authz_admin_${tag}@test.local`, normalizedEmail: `authz_admin_${tag}@test.local`, passwordHash: 'x', displayName: 'Authz Admin' } });
  const role = await prisma.adminRole.create({ data: { name: `authz_test_${tag}`, description: 'test' } });
  for (const name of permissions) {
    const perm = await prisma.adminPermission.upsert({ where: { name }, create: { name, description: name }, update: {} });
    await prisma.adminRolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  await prisma.adminRoleAssignment.create({ data: { adminId: admin.id, roleId: role.id } });
  return signAdminToken({ adminId: admin.id, email: admin.email, roles: [role.name], permissions });
}

describe('admin operator surfaces act on an explicit target and need specific permissions', () => {
  it('simulation inspection requires simulation.read and an existing target user', async () => {
    const noPerm = await adminWith([ADMIN_PERMISSIONS.USERS_READ]);
    const reader = await adminWith([ADMIN_PERMISSIONS.SIMULATION_READ]);
    const u = await user();
    const ch = await createCharacter();
    await request(app).post('/api/v1/simulation/goals').set('Authorization', `Bearer ${u.token}`).send({ characterId: ch.id, title: 'goal visible to operator' });

    expect((await request(app).get(`/api/v1/admin/simulation/users/goals/${ch.id}?userId=${u.id}`).set('Authorization', `Bearer ${noPerm}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/admin/simulation/users/goals/${ch.id}`).set('Authorization', `Bearer ${reader}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/admin/simulation/users/goals/${ch.id}?userId=${crypto.randomUUID()}`).set('Authorization', `Bearer ${reader}`)).status).toBe(404);
    const ok = await request(app).get(`/api/v1/admin/simulation/users/goals/${ch.id}?userId=${u.id}`).set('Authorization', `Bearer ${reader}`);
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).toContain('goal visible to operator');
    // Reading is not operating.
    expect((await request(app).post('/api/v1/admin/simulation/users/goals').set('Authorization', `Bearer ${reader}`).send({ userId: u.id, characterId: ch.id, title: 'x' })).status).toBe(403);
  });

  it('end users can no longer create character-global routines', async () => {
    const u = await user();
    const ch = await createCharacter();
    const res = await request(app).post('/api/v1/simulation/routines').set('Authorization', `Bearer ${u.token}`).send({ characterId: ch.id, name: 'hijack', routineType: 'CHECK_IN', scheduleCron: '* * * * *' });
    expect(res.status).toBe(404);
  });

  it('admin knowledge view is metadata-only and search runs in the admin sandbox, not over user documents', async () => {
    const u = await user();
    await request(app).post('/api/v1/knowledge/documents').set('Authorization', `Bearer ${u.token}`).send({ title: 'user private kb', originalFilename: 'p.txt', mimeType: 'text/plain', rawContent: 'zebracorn secret launch codes for the private project' });
    const admin = await adminWith([ADMIN_PERMISSIONS.AI_READ, ADMIN_PERMISSIONS.AI_PLAYGROUND]);
    const docs = await request(app).get('/api/v1/admin/knowledge/documents').set('Authorization', `Bearer ${admin}`);
    expect(docs.status).toBe(200);
    expect(JSON.stringify(docs.body)).not.toContain('zebracorn');
    const search = await request(app).post('/api/v1/admin/knowledge/search').set('Authorization', `Bearer ${admin}`).send({ query: 'zebracorn launch codes' });
    expect(search.status).toBe(200);
    expect(JSON.stringify(search.body)).not.toContain('zebracorn secret');
    // A user token cannot reach the operator view.
    expect((await request(app).get('/api/v1/admin/knowledge/documents').set('Authorization', `Bearer ${u.token}`)).status).toBe(401);
  });

  it('reliability controls need their own permission; deep diagnostics are not public', async () => {
    expect((await request(app).get('/health/dependencies')).status).toBe(401);
    const support = await adminWith([ADMIN_PERMISSIONS.USERS_READ]);
    const res = await request(app).post('/health/admin/killswitches').set('Authorization', `Bearer ${support}`).send({ key: 'DISABLE_VOICE_CALLS', enabled: true });
    expect(res.status).toBe(403);
    expect((await request(app).post('/health/admin/circuit-breakers/reset').set('Authorization', `Bearer ${support}`)).status).toBe(403);
    const ops = await adminWith([ADMIN_PERMISSIONS.SETTINGS_READ]);
    expect((await request(app).get('/health/dependencies').set('Authorization', `Bearer ${ops}`)).status).toBeLessThan(500);
  });

  it('creator verification is a real, audited, permissioned change', async () => {
    const owner = await user();
    const username = `authz_${crypto.randomBytes(3).toString('hex')}`;
    const profile = await prisma.creatorProfile.create({ data: { userId: owner.id, displayName: 'Authz Creator', username } });
    const reader = await adminWith([ADMIN_PERMISSIONS.USERS_READ]);
    const list = await request(app).get(`/api/v1/admin/creators?search=${username}`).set('Authorization', `Bearer ${reader}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(profile.id);
    expect((await request(app).patch(`/api/v1/admin/creators/${profile.id}/verification`).set('Authorization', `Bearer ${reader}`).send({ verificationStatus: 'VERIFIED' })).status).toBe(403);
    const moderator = await adminWith([ADMIN_PERMISSIONS.MODERATION_WRITE]);
    const changed = await request(app).patch(`/api/v1/admin/creators/${profile.id}/verification`).set('Authorization', `Bearer ${moderator}`).send({ verificationStatus: 'VERIFIED', reason: 'identity confirmed' });
    expect(changed.status).toBe(200);
    expect((await prisma.creatorProfile.findUniqueOrThrow({ where: { id: profile.id } })).verificationStatus).toBe('VERIFIED');
    expect(await prisma.auditLog.count({ where: { action: 'CREATOR_VERIFICATION_CHANGED', resourceId: profile.id } })).toBe(1);
  });

  it('admin user status accepts the documented lowercase values and normalizes them', async () => {
    const u = await user();
    const admin = await adminWith([ADMIN_PERMISSIONS.USERS_SUSPEND]);
    const res = await request(app).patch(`/api/v1/admin/users/${u.id}/status`).set('Authorization', `Bearer ${admin}`).send({ status: 'suspended', reason: 'regression check' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe('SUSPENDED');
  });
});

describe('agents and knowledge: no cross-user reads, no fabricated results', () => {
  it('a user cannot read the generation explanation of another user\'s message', async () => {
    const owner = await user();
    const other = await user();
    const ch = await createCharacter();
    const { conversationId, messageIds } = await createConversation(owner.id, ch.id, [['USER', 'hi'], ['CHARACTER', 'hello']]);
    const messageId = messageIds[1]!;
    await prisma.characterRuntimeSnapshot.create({
      data: {
        conversationId,
        messageId,
        characterId: ch.id,
        characterVersionId: 'v1',
        promptVersion: 'p1',
        behaviorPolicyHash: 'h',
        safetyPolicyVersion: 's1',
        modelId: 'm1',
        memoryIds: [],
        selectedSkillSlugs: [],
        tokensPrompt: 1,
        tokensCompletion: 1,
        costUsd: 0,
      },
    });
    expect((await request(app).get(`/api/v1/agents/generations/${messageId}/explain`).set('Authorization', `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/agents/generations/${messageId}/explain`).set('Authorization', `Bearer ${owner.token}`)).status).toBe(200);
  });

  it('starting an experience requires a real, reachable character (no demo fallback)', async () => {
    const u = await user();
    const exps = await request(app).get('/api/v1/agents/experiences').set('Authorization', `Bearer ${u.token}`);
    const slug = exps.body.data?.[0]?.slug ?? 'study_session';
    expect((await request(app).post(`/api/v1/agents/experiences/${slug}/start`).set('Authorization', `Bearer ${u.token}`).send({})).status).toBe(400);
    const draft = await createCharacter({ status: 'DRAFT' });
    expect((await request(app).post(`/api/v1/agents/experiences/${slug}/start`).set('Authorization', `Bearer ${u.token}`).send({ characterId: draft.id })).status).toBe(404);
  });

  it('web research fails honestly when no provider is configured (simulation off)', async () => {
    const u = await user();
    const previous = env.AGENT_SIMULATED_TOOLS;
    (env as { AGENT_SIMULATED_TOOLS: boolean }).AGENT_SIMULATED_TOOLS = false;
    try {
      const res = await request(app).post('/api/v1/knowledge/research').set('Authorization', `Bearer ${u.token}`).send({ query: 'latest news' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('TOOL_PROVIDER_NOT_CONFIGURED');
    } finally {
      (env as { AGENT_SIMULATED_TOOLS: boolean }).AGENT_SIMULATED_TOOLS = previous;
    }
  });
});
