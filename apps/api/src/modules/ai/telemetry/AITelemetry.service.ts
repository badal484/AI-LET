import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  AIAnalyticsOverview,
  AIModelMetrics,
  AICostMetrics,
} from '@ai-companion/types';
import { CostEstimator } from './CostEstimator.js';
import { logger } from '../../../shared/utils/logger.js';

export interface RecordTraceInput {
  requestId: string;
  userId?: string;
  characterId?: string;
  characterVersionId?: string;
  promptVersionId?: string;
  modelId?: string;
  provider: string;
  workload: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  ttftMs?: number;
  isSuccess: boolean;
  errorCode?: string;
  errorMessage?: string;
  contextHash?: string;
  metadata?: Record<string, any>;
}

export class AITelemetryService {
  private static instance: AITelemetryService;

  private constructor() {}

  public static getInstance(): AITelemetryService {
    if (!AITelemetryService.instance) {
      AITelemetryService.instance = new AITelemetryService();
    }
    return AITelemetryService.instance;
  }

  public async recordTrace(input: RecordTraceInput): Promise<void> {
    const totalTokens = input.promptTokens + input.completionTokens;
    const estimatedCostUsd = CostEstimator.calculateCost(input.promptTokens, input.completionTokens);

    try {
      await prisma.aIGenerationTrace.create({
        data: {
          requestId: input.requestId,
          userId: input.userId,
          characterId: input.characterId,
          characterVersionId: input.characterVersionId,
          promptVersionId: input.promptVersionId,
          modelId: input.modelId,
          provider: input.provider,
          workload: input.workload,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens,
          costUsd: estimatedCostUsd,
          latencyMs: input.latencyMs,
          timeToFirstTokenMs: input.ttftMs,
          status: input.isSuccess ? 'SUCCESS' : 'FAILED',
          errorCode: input.errorCode,
          contextHash: input.contextHash,
          metadata: input.metadata,
        },
      });

      // Update provider health in background
      this.updateProviderHealth(input.provider, input.isSuccess, input.latencyMs).catch(() => {});
    } catch (err) {
      logger.warn(`Failed to record AI generation trace for request ${input.requestId}: ${err}`);
    }
  }

  public async updateProviderHealth(
    provider: string,
    isSuccess: boolean,
    latencyMs: number
  ): Promise<void> {
    try {
      const existing = await prisma.aIProviderHealth.findUnique({
        where: { provider },
      });

      if (!existing) {
        await prisma.aIProviderHealth.create({
          data: {
            provider,
            status: isSuccess ? 'HEALTHY' : 'DEGRADED',
            successRate: isSuccess ? 1.0 : 0.0,
            averageLatencyMs: latencyMs,
            lastFailureAt: isSuccess ? null : new Date(),
            circuitOpen: !isSuccess,
          },
        });
        return;
      }

      const successRate = isSuccess
        ? Math.min(1.0, existing.successRate * 0.9 + 0.1)
        : Math.max(0.0, existing.successRate * 0.9);
      const status = successRate < 0.5 ? 'OUTAGE' : successRate < 0.85 ? 'DEGRADED' : 'HEALTHY';
      const averageLatencyMs = Math.round(existing.averageLatencyMs * 0.9 + latencyMs * 0.1);

      await prisma.aIProviderHealth.update({
        where: { provider },
        data: {
          status,
          successRate,
          averageLatencyMs,
          lastFailureAt: isSuccess ? existing.lastFailureAt : new Date(),
          circuitOpen: status === 'OUTAGE',
        },
      });
    } catch {
      // Ignore background health update errors
    }
  }

  public async getOverviewMetrics(timeframeDays: number = 7): Promise<AIAnalyticsOverview> {
    const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    const traces = await prisma.aIGenerationTrace.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        latencyMs: true,
        timeToFirstTokenMs: true,
        totalTokens: true,
        costUsd: true,
        provider: true,
      },
    });

    const totalRequests = traces.length;
    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        successRate: 1.0,
        failureRate: 0.0,
        averageLatencyMs: 0,
        averageTtftMs: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        providerHealth: [],
      };
    }

    let successCount = 0;
    let totalLatency = 0;
    let totalTtft = 0;
    let ttftCount = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const t of traces) {
      if (t.status === 'SUCCESS') successCount++;
      totalLatency += t.latencyMs;
      if (t.timeToFirstTokenMs) {
        totalTtft += t.timeToFirstTokenMs;
        ttftCount++;
      }
      totalTokens += t.totalTokens;
      totalCost += t.costUsd;
    }

    const healthRecords = await prisma.aIProviderHealth.findMany();
    const providerHealth = healthRecords.map((h) => ({
      provider: h.provider,
      status: h.status,
      successRate: h.successRate,
      averageLatencyMs: h.averageLatencyMs,
      circuitOpen: h.circuitOpen,
      lastCheckedAt: h.updatedAt.toISOString(),
    }));

    return {
      totalRequests,
      successRate: Math.round((successCount / totalRequests) * 1000) / 1000,
      failureRate: Math.round(((totalRequests - successCount) / totalRequests) * 1000) / 1000,
      averageLatencyMs: Math.round(totalLatency / totalRequests),
      averageTtftMs: ttftCount > 0 ? Math.round(totalTtft / ttftCount) : 0,
      totalTokens,
      estimatedCostUsd: Math.round(totalCost * 1000) / 1000,
      providerHealth,
    };
  }

  public async getModelMetrics(): Promise<AIModelMetrics[]> {
    const models = await prisma.aIModel.findMany();
    const traces = await prisma.aIGenerationTrace.groupBy({
      by: ['modelId'],
      _count: { id: true },
      _sum: { totalTokens: true, costUsd: true, latencyMs: true },
      where: { modelId: { not: null } },
    });

    const successTraces = await prisma.aIGenerationTrace.groupBy({
      by: ['modelId'],
      _count: { id: true },
      where: { modelId: { not: null }, status: 'SUCCESS' },
    });

    const successMap = new Map(successTraces.map((s) => [s.modelId, s._count.id]));

    return models.map((m) => {
      const trace = traces.find((t) => t.modelId === m.id);
      const total = trace?._count.id || 0;
      const successes = successMap.get(m.id) || 0;
      const errorRate = total > 0 ? Math.round(((total - successes) / total) * 1000) / 1000 : 0.0;
      const avgLatency = total > 0 ? Math.round((trace?._sum.latencyMs || 0) / total) : 0;

      return {
        modelId: m.id,
        modelName: m.modelName,
        provider: m.provider,
        totalRequests: total,
        errorRate,
        averageLatencyMs: avgLatency,
        totalTokens: trace?._sum.totalTokens || 0,
        estimatedCostUsd: Math.round((trace?._sum.costUsd || 0) * 1000) / 1000,
      };
    });
  }

  public async getCostMetrics(): Promise<AICostMetrics> {
    const traces = await prisma.aIGenerationTrace.findMany({
      select: {
        provider: true,
        modelId: true,
        workload: true,
        costUsd: true,
        createdAt: true,
      },
    });

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byWorkload: Record<string, number> = {};

    let totalCost = 0;
    let dailyCost = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const t of traces) {
      totalCost += t.costUsd;
      if (t.createdAt >= oneDayAgo) {
        dailyCost += t.costUsd;
      }

      byProvider[t.provider] = (byProvider[t.provider] || 0) + t.costUsd;
      if (t.modelId) {
        byModel[t.modelId] = (byModel[t.modelId] || 0) + t.costUsd;
      }
      byWorkload[t.workload] = (byWorkload[t.workload] || 0) + t.costUsd;
    }

    return {
      dailyCostUsd: Math.round(dailyCost * 1000) / 1000,
      monthlyCostUsd: Math.round(totalCost * 1000) / 1000,
      byProvider,
      byModel,
      byWorkload,
      byEnvironment: {
        development: Math.round(totalCost * 1000) / 1000,
      },
    };
  }
}
