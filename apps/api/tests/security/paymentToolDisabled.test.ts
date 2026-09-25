import crypto from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAccessToken, signAdminToken } from '../../src/security/tokens.js';
import {
  CharacterCapabilityService,
  HighRiskConfirmationService,
  ScheduledAgentTaskService,
  ToolExecutionGateway,
  ToolRegistry,
  UserConsentService,
} from '../../src/modules/agents/index.js';

const app = createApp();
const gateway = ToolExecutionGateway.getInstance();
const registry = ToolRegistry.getInstance();
const capabilities = CharacterCapabilityService.getInstance();
const consents = UserConsentService.getInstance();
const confirmations = HighRiskConfirmationService.getInstance();
const scheduler = ScheduledAgentTaskService.getInstance();

const PAYMENT = { amount: 49.99, currency: 'USD', recipient: 'acct_test_recipient' };

async function admin(permissions: string[]) {
  const tag = crypto.randomBytes(4).toString('hex');
  const a = await prisma.adminUser.create({ data: { email: `pay_${tag}@test.local`, normalizedEmail: `pay_${tag}@test.local`, passwordHash: 'x', displayName: 'Payment Test Admin' } });
  const role = await prisma.adminRole.create({ data: { name: `pay_test_${tag}`, description: 'test' } });
  for (const name of permissions) {
    const perm = await prisma.adminPermission.upsert({ where: { name }, create: { name, description: name }, update: {} });
    await prisma.adminRolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
  await prisma.adminRoleAssignment.create({ data: { adminId: a.id, roleId: role.id } });
  return signAdminToken({ adminId: a.id, email: a.email, roles: [role.name], permissions });
}

describe('payment.create is disabled everywhere (no fake success)', () => {
  it('the gateway refuses it even with a valid confirmation token for that exact step', async () => {
    const token = confirmations.createConfirmationRequest('user_pay', 'task_pay', 'step_pay', 'payment.create', PAYMENT, 'CRITICAL', 'Pay').token;
    const res = await gateway.executeTool({ taskId: 'task_pay', stepId: 'step_pay', toolSlug: 'payment.create', userId: 'user_pay', characterId: 'char_maya_001', arguments: PAYMENT, confirmationToken: token });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PAYMENT_TOOL_DISABLED');
    expect(res.data).toBeUndefined();
    expect(res.receipt).toBeUndefined();
    expect(JSON.stringify(res)).not.toMatch(/SUCCESSFUL|transactionId/);
  });

  it('cannot be re-enabled through the registry, and is never offered to the planner', () => {
    const current = registry.getTool('payment.create')!;
    expect(current.status).toBe('disabled');
    expect(() => registry.registerTool({ ...current, status: 'enabled' })).toThrow(/Payments are disabled/);
    expect(registry.getTool('payment.create')!.status).toBe('disabled');
    expect(registry.listTools(true).map((t) => t.slug)).not.toContain('payment.create');
  });

  it('a character or creator cannot grant the capability; a user cannot consent to it', () => {
    expect(() => capabilities.setCapability('char_maya_001', 'payment.create', true)).toThrow(/Payments are disabled/);
    expect(capabilities.isCapabilityAllowed('char_maya_001', 'payment.create')).toBe(false);
    expect(() => consents.grantConsent('user_pay', 'payment.create', 'stripe', 'payment.write')).toThrow(/Payments are disabled/);
  });

  it('stale and scheduled tasks cannot execute it', () => {
    expect(() => scheduler.createScheduledTask('user_pay', 'pay rent monthly', ['payment.create'], '0 0 1 * *')).toThrow(/Payments are disabled/);
    // A schedule created before the tool was disabled (simulated by inserting directly) is refused at run time.
    const legit = scheduler.createScheduledTask('user_pay', 'read calendar', ['calendar.read'], '0 9 * * *');
    (legit.taskTemplate.toolSlugs as string[]).push('payment.create');
    const check = scheduler.validateScheduledRun(legit.id);
    expect(check.isValid).toBe(false);
    expect(check.reason).toMatch(/Payments are disabled/);
  });

  it('direct API invocation cannot bypass it (admin tool registration, admin capability, user consent)', async () => {
    const tools = await admin([ADMIN_PERMISSIONS.TOOLS_WRITE, ADMIN_PERMISSIONS.CAPABILITIES_WRITE]);
    const reg = await request(app).post('/api/v1/admin/agents/tools').set('Authorization', `Bearer ${tools}`).send({
      name: 'Create Financial Transaction', slug: 'payment.create', description: 'x', version: '9.9.9', category: 'HIGH_RISK', status: 'enabled',
      riskLevel: 'CRITICAL', requiredCapability: 'payment.create', permissionScope: 'payment.write', inputSchema: {}, outputSchema: {},
      timeoutMs: 1000, isSideEffecting: true, isReversible: false, costUsd: 0,
    });
    expect([400, 403]).toContain(reg.status);
    expect(registry.getTool('payment.create')!.status).toBe('disabled');

    const cap = await request(app).post('/api/v1/admin/agents/characters/char_maya_001/capabilities').set('Authorization', `Bearer ${tools}`).send({ capabilitySlug: 'payment.create', isEnabled: true });
    expect(cap.status).toBe(403);
    expect(cap.body.error.code).toBe('PAYMENT_TOOL_DISABLED');

    const user = await prisma.user.create({ data: { email: `payuser_${crypto.randomBytes(3).toString('hex')}@test.local`, normalizedEmail: `payuser_${crypto.randomBytes(3).toString('hex')}@test.local` } });
    const token = signAccessToken({ userId: user.id, email: user.email, roles: ['user'] });
    const consent = await request(app).post('/api/v1/agents/consents').set('Authorization', `Bearer ${token}`).send({ capabilitySlug: 'payment.create', provider: 'stripe', scope: 'payment.write' });
    expect([400, 403]).toContain(consent.status);
  });
});

describe('simulated tool adapters fail closed when not explicitly allowed', () => {
  it('returns TOOL_PROVIDER_NOT_CONFIGURED instead of fabricated results', async () => {
    const original = env.AGENT_SIMULATED_TOOLS;
    (env as { AGENT_SIMULATED_TOOLS: boolean }).AGENT_SIMULATED_TOOLS = false;
    try {
      for (const toolSlug of ['email.send', 'calendar.create_event', 'calendar.read', 'document.analyze']) {
        const res = await gateway.executeTool({ taskId: 't', stepId: 's', toolSlug, userId: 'u', characterId: 'char_maya_001', arguments: {} });
        expect(res.success, toolSlug).toBe(false);
        expect(res.error?.code, toolSlug).toBe('TOOL_PROVIDER_NOT_CONFIGURED');
      }
    } finally {
      (env as { AGENT_SIMULATED_TOOLS: boolean }).AGENT_SIMULATED_TOOLS = original;
    }
  });
});
