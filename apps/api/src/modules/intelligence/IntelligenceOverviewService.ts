import { IntelligenceOverviewSummary } from '@ai-companion/types';
import { ProductionFailureDatasetService } from './ProductionFailureDatasetService.js';
import { CircuitBreakerService } from './CircuitBreakerService.js';
import { prisma } from '../../infrastructure/database/prisma.js';

export class IntelligenceOverviewService {
  private static instance: IntelligenceOverviewService;
  private readonly failureDataset = ProductionFailureDatasetService.getInstance();
  private readonly circuitBreakers = CircuitBreakerService.getInstance();

  private constructor() {}

  public static getInstance(): IntelligenceOverviewService {
    if (!IntelligenceOverviewService.instance) {
      IntelligenceOverviewService.instance = new IntelligenceOverviewService();
    }
    return IntelligenceOverviewService.instance;
  }

  /** Last-24h production figures computed from generation traces and registries — no constants. */
  public async getOverview(): Promise<IntelligenceOverviewSummary> {
    const summary = this.failureDataset.getSummary();
    const breakers = this.circuitBreakers.getStatuses();
    const trippedBreakers = breakers.filter((b) => b.isTripped).length;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totals, generations, activeModels, activeExperiments, incidents, latencies] = await Promise.all([
      prisma.aIGenerationTrace.aggregate({ where: { createdAt: { gte: since } }, _sum: { totalTokens: true, costUsd: true } }),
      prisma.aIGenerationTrace.count({ where: { createdAt: { gte: since } } }),
      prisma.aIModel.count({ where: { isEnabled: true } }),
      prisma.experiment.count({ where: { status: 'RUNNING' } }),
      prisma.safetyIncident.count({ where: { createdAt: { gte: since } } }),
      prisma.aIGenerationTrace.findMany({
        where: { createdAt: { gte: since } },
        select: { latencyMs: true },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
      }),
    ]);

    const sorted = latencies.map((l) => l.latencyMs).sort((x, y) => x - y);
    const p95LatencyMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null : null;

    return {
      dailyTokens: totals._sum.totalTokens ?? 0,
      dailyCostUsd: Number((totals._sum.costUsd ?? 0).toFixed(4)),
      activeModels,
      // No memory-retrieval evaluation pipeline records precision/recall yet; report "unknown".
      memoryPrecision: null,
      memoryRecall: null,
      p95LatencyMs,
      safetyIncidentRate: generations ? incidents / generations : null,
      activeCircuitBreakers: trippedBreakers,
      activeExperiments,
      totalRegressionCases: summary.activeRegressionCount,
    };
  }
}
