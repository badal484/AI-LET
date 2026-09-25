import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { DeveloperUsageMeteringService } from '../../src/modules/developer-platform/services/DeveloperUsageMeteringService.js';
import { ValidationError, RateLimitError } from '../../src/shared/errors/AppError.js';

describe('Developer Usage Metering & Budget Threshold Tests', () => {
  const authService = DeveloperAuthService.getInstance();
  const usageService = DeveloperUsageMeteringService.getInstance();

  const developerUserId = '00000000-0000-0000-0000-000000000001';
  let projectId: string;

  beforeEach(async () => {
    await prisma.developerUsageRecord.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: developerUserId, email: 'developer@example.com', normalizedEmail: 'developer@example.com', status: 'ACTIVE' },
    });

    const project = await authService.createProject({
      userId: developerUserId,
      name: 'Usage Test Project',
    });
    projectId = project.id;
  });

  it('records billable usage events accurately', async () => {
    const record = await usageService.recordUsage({
      projectId,
      metric: 'AI_TOKENS',
      quantity: 500,
      costUsd: 0.001,
      modelId: 'gpt-4o-mini',
      endpoint: '/v1/conversations/conv-1/messages',
    });

    expect(record.id).toBeDefined();
    expect(record.quantity).toBe(500);
    expect(record.costUsd).toBe(0.001);
    expect(record.metric).toBe('AI_TOKENS');
  });

  it('deduplicates usage events when idempotencyKey is provided', async () => {
    const idempotencyKey = 'idem_req_9991a';

    const first = await usageService.recordUsage({
      projectId,
      metric: 'API_REQUESTS',
      quantity: 1,
      costUsd: 0.0,
      idempotencyKey,
    });

    const duplicate = await usageService.recordUsage({
      projectId,
      metric: 'API_REQUESTS',
      quantity: 1,
      costUsd: 0.0,
      idempotencyKey,
    });

    expect(duplicate.id).toBe(first.id);

    // Verify only 1 record exists in DB
    const count = await prisma.developerUsageRecord.count({
      where: { projectId },
    });
    expect(count).toBe(1);
  });

  it('calculates aggregate usage summary over period', async () => {
    await usageService.recordUsage({ projectId, metric: 'API_REQUESTS', quantity: 10, costUsd: 0.0 });
    await usageService.recordUsage({ projectId, metric: 'AI_TOKENS', quantity: 2000, costUsd: 0.004 });
    await usageService.recordUsage({ projectId, metric: 'VOICE_SECONDS', quantity: 120, costUsd: 0.02 });

    const summary = await usageService.getUsageSummary(projectId, 30);
    expect(summary.totalRequests).toBe(10);
    expect(summary.totalTokens).toBe(2000);
    expect(summary.totalVoiceSeconds).toBe(120);
    expect(summary.totalCostUsd).toBeGreaterThan(0.02);
  });

  it('tracks monthly spend budget and detects crossed thresholds', async () => {
    // Set budget to $10.00
    await prisma.developerProject.update({
      where: { id: projectId },
      data: {
        metadata: { monthlyBudgetUsd: 10.0, hardLimitEnabled: true },
      },
    });

    // Record $6.00 spend (60% of budget -> crosses 50% threshold)
    await usageService.recordUsage({
      projectId,
      metric: 'AI_TOKENS',
      quantity: 100000,
      costUsd: 6.0,
    });

    const status = await usageService.getBudgetStatus(projectId);
    expect(status.monthlyBudgetUsd).toBe(10.0);
    expect(status.currentMonthlySpendUsd).toBe(6.0);
    expect(status.percentUsed).toBe(60);
    expect(status.hardLimitReached).toBe(false);
    expect(status.spendAlertThresholdsCrossed).toEqual([50]);

    // Record additional $4.50 spend ($10.50 total -> crosses 75%, 90%, 100% and hits hard limit)
    await usageService.recordUsage({
      projectId,
      metric: 'AI_TOKENS',
      quantity: 50000,
      costUsd: 4.5,
    });

    const statusAfter = await usageService.getBudgetStatus(projectId);
    expect(statusAfter.percentUsed).toBe(105);
    expect(statusAfter.hardLimitReached).toBe(true);
    expect(statusAfter.spendAlertThresholdsCrossed).toEqual([50, 75, 90, 100]);
  });
});
