import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { RateLimitError, ValidationError } from '../../../shared/errors/AppError.js';
import type { DeveloperUsageRecordItem } from '@ai-companion/types';

export interface RecordUsageInput {
  projectId: string;
  metric: 'API_REQUESTS' | 'AI_TOKENS' | 'VOICE_SECONDS' | 'IMAGES' | 'AGENT_STEPS' | 'WEB_RESEARCH' | string;
  quantity: number;
  costUsd?: number;
  modelId?: string;
  endpoint?: string;
  environment?: string;
  idempotencyKey?: string;
}

export interface BudgetStatus {
  projectId: string;
  monthlyBudgetUsd: number;
  currentMonthlySpendUsd: number;
  percentUsed: number;
  hardLimitReached: boolean;
  spendAlertThresholdsCrossed: number[];
}

export interface UsageSummary {
  projectId: string;
  totalCostUsd: number;
  totalRequests: number;
  totalTokens: number;
  totalVoiceSeconds: number;
  totalImages: number;
  totalAgentSteps: number;
  totalWebSearches: number;
  metricsBreakdown: Record<string, { quantity: number; costUsd: number }>;
  periodDays: number;
}

export class DeveloperUsageMeteringService {
  private static instance: DeveloperUsageMeteringService;

  private constructor() {}

  public static getInstance(): DeveloperUsageMeteringService {
    if (!DeveloperUsageMeteringService.instance) {
      DeveloperUsageMeteringService.instance = new DeveloperUsageMeteringService();
    }
    return DeveloperUsageMeteringService.instance;
  }

  /**
   * Records a billable usage event with optional idempotency key.
   */
  public async recordUsage(input: RecordUsageInput): Promise<DeveloperUsageRecordItem> {
    const {
      projectId,
      metric,
      quantity,
      costUsd = 0.0,
      modelId,
      endpoint,
      environment = 'DEVELOPMENT',
      idempotencyKey,
    } = input;

    if (quantity <= 0) {
      throw new ValidationError('Usage quantity must be greater than zero');
    }

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await prisma.developerUsageRecord.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return this.mapRecord(existing);
      }
    }

    // Fetch project to inspect budget & status
    const project = await prisma.developerProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ValidationError(`Project '${projectId}' not found`);
    }

    if (project.status === 'SUSPENDED') {
      throw new RateLimitError('Developer project is suspended due to policy or billing limits');
    }

    // Persist usage record
    const record = await prisma.developerUsageRecord.create({
      data: {
        projectId,
        metric,
        quantity,
        costUsd,
        modelId,
        endpoint,
        environment,
        idempotencyKey,
        timestamp: new Date(),
      },
    });

    // Check spend limits asynchronously or inline if cost was non-zero
    if (costUsd > 0) {
      await this.evaluateBudgetThresholds(project);
    }

    return this.mapRecord(record);
  }

  /**
   * Checks current monthly budget consumption and returns threshold alert status.
   */
  public async getBudgetStatus(projectId: string): Promise<BudgetStatus> {
    const project = await prisma.developerProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ValidationError(`Project '${projectId}' not found`);
    }

    const metadata = (project.metadata as Record<string, any>) || {};
    const monthlyBudgetUsd = typeof metadata['monthlyBudgetUsd'] === 'number' ? metadata['monthlyBudgetUsd'] : 100.0;
    const hardLimitEnabled = metadata['hardLimitEnabled'] !== false;

    // Calculate sum of costUsd since first of current month
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const aggregate = await prisma.developerUsageRecord.aggregate({
      where: {
        projectId,
        timestamp: { gte: startOfMonth },
      },
      _sum: {
        costUsd: true,
      },
    });

    const currentMonthlySpendUsd = aggregate._sum.costUsd || 0.0;
    const percentUsed = monthlyBudgetUsd > 0 ? (currentMonthlySpendUsd / monthlyBudgetUsd) * 100 : 0;
    const hardLimitReached = hardLimitEnabled && currentMonthlySpendUsd >= monthlyBudgetUsd;

    const spendAlertThresholdsCrossed: number[] = [];
    if (percentUsed >= 50) spendAlertThresholdsCrossed.push(50);
    if (percentUsed >= 75) spendAlertThresholdsCrossed.push(75);
    if (percentUsed >= 90) spendAlertThresholdsCrossed.push(90);
    if (percentUsed >= 100) spendAlertThresholdsCrossed.push(100);

    return {
      projectId,
      monthlyBudgetUsd,
      currentMonthlySpendUsd,
      percentUsed,
      hardLimitReached,
      spendAlertThresholdsCrossed,
    };
  }

  /**
   * Evaluates budget and updates project status if hard limit exceeded.
   */
  private async evaluateBudgetThresholds(project: any): Promise<void> {
    try {
      const budgetStatus = await this.getBudgetStatus(project.id);
      if (budgetStatus.hardLimitReached && project.status === 'ACTIVE') {
        logger.warn(
          `[DeveloperUsageMetering] Project '${project.id}' reached hard budget limit of $${budgetStatus.monthlyBudgetUsd}. Marking RESTRICTED.`
        );
        await prisma.developerProject.update({
          where: { id: project.id },
          data: { status: 'RESTRICTED' },
        });
      }
    } catch (err: any) {
      logger.error(`[DeveloperUsageMetering] Error evaluating budget for project ${project.id}:`, err);
    }
  }

  /**
   * Aggregates usage summary across metrics for the past N days.
   */
  public async getUsageSummary(projectId: string, periodDays: number = 30): Promise<UsageSummary> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const records = await prisma.developerUsageRecord.findMany({
      where: {
        projectId,
        timestamp: { gte: since },
      },
    });

    let totalCostUsd = 0;
    let totalRequests = 0;
    let totalTokens = 0;
    let totalVoiceSeconds = 0;
    let totalImages = 0;
    let totalAgentSteps = 0;
    let totalWebSearches = 0;

    const metricsBreakdown: Record<string, { quantity: number; costUsd: number }> = {};

    for (const rec of records) {
      totalCostUsd += rec.costUsd;

      const current = metricsBreakdown[rec.metric] || { quantity: 0, costUsd: 0 };
      current.quantity += rec.quantity;
      current.costUsd += rec.costUsd;
      metricsBreakdown[rec.metric] = current;

      switch (rec.metric) {
        case 'API_REQUESTS':
          totalRequests += rec.quantity;
          break;
        case 'AI_TOKENS':
          totalTokens += rec.quantity;
          break;
        case 'VOICE_SECONDS':
          totalVoiceSeconds += rec.quantity;
          break;
        case 'IMAGES':
          totalImages += rec.quantity;
          break;
        case 'AGENT_STEPS':
          totalAgentSteps += rec.quantity;
          break;
        case 'WEB_RESEARCH':
          totalWebSearches += rec.quantity;
          break;
      }
    }

    return {
      projectId,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      totalRequests,
      totalTokens,
      totalVoiceSeconds,
      totalImages,
      totalAgentSteps,
      totalWebSearches,
      metricsBreakdown,
      periodDays,
    };
  }

  /**
   * Retrieves paginated usage records.
   */
  public async getUsageRecords(
    projectId: string,
    limit: number = 50,
    after?: string
  ): Promise<{ data: DeveloperUsageRecordItem[]; hasMore: boolean; nextCursor?: string }> {
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const queryOptions: any = {
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: safeLimit + 1,
    };

    if (after) {
      queryOptions.cursor = { id: after };
      queryOptions.skip = 1;
    }

    const records = await prisma.developerUsageRecord.findMany(queryOptions);
    const hasMore = records.length > safeLimit;
    const data = hasMore ? records.slice(0, safeLimit) : records;
    const lastItem = data[data.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

    return {
      data: data.map((r) => this.mapRecord(r)),
      hasMore,
      nextCursor,
    };
  }

  private mapRecord(rec: any): DeveloperUsageRecordItem {
    return {
      id: rec.id,
      projectId: rec.projectId,
      metric: rec.metric,
      quantity: rec.quantity,
      costUsd: rec.costUsd,
      modelId: rec.modelId || undefined,
      endpoint: rec.endpoint || undefined,
      environment: rec.environment,
      idempotencyKey: rec.idempotencyKey || undefined,
      timestamp: rec.timestamp.toISOString(),
      createdAt: rec.createdAt.toISOString(),
    };
  }
}
