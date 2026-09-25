import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { AnalyticsAnomalyService } from '../src/modules/analytics/services/AnalyticsAnomalyService.js';
import { randomUUID } from 'crypto';

describe('AnalyticsAnomalyService Tests', () => {
  beforeEach(async () => {
    await prisma.analyticsAlert.deleteMany();
    await prisma.aIUsageEvent.deleteMany();
    await prisma.safetyEvaluationLog.deleteMany();
  });

  it('detects high AI token cost spend velocity anomaly and creates alert', async () => {
    const now = new Date();

    // Create AI usage with total cost > $50
    await prisma.aIUsageEvent.create({
      data: {
        requestId: randomUUID(),
        provider: 'openai',
        model: 'gpt-4o',
        task: 'IMAGE_GEN',
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 75.5,
        currency: 'USD',
        status: 'SUCCESS',
        createdAt: now,
      },
    });

    const alerts = await AnalyticsAnomalyService.scanForAnomalies();
    expect(alerts.length).toBeGreaterThan(0);

    const costAlert = alerts.find(a => a.category === 'AI_COST');
    expect(costAlert).toBeDefined();
    expect(costAlert?.severity).toBe('WARNING');
    expect(costAlert?.status).toBe('OPEN');
    expect(costAlert?.title).toContain('High 24h AI Token Spend');
  });

  it('manages alert triage lifecycle (OPEN -> ACKNOWLEDGED -> RESOLVED)', async () => {
    const alert = await prisma.analyticsAlert.create({
      data: {
        severity: 'CRITICAL',
        category: 'SAFETY',
        title: 'Spike in Unsafe Prompts',
        message: 'Multiple severe policy violations detected in under 1 hour.',
        status: 'OPEN',
      },
    });

    const openAlerts = await AnalyticsAnomalyService.listAlerts('OPEN');
    expect(openAlerts.some(a => a.id === alert.id)).toBe(true);

    const adminId = randomUUID();
    const acked = await AnalyticsAnomalyService.acknowledgeAlert(alert.id, adminId);
    expect(acked.status).toBe('ACKNOWLEDGED');
    expect(acked.acknowledgedByAdminId).toBe(adminId);

    const resolved = await AnalyticsAnomalyService.resolveAlert(alert.id);
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();
  });
});
