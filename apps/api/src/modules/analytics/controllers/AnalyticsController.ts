import { Request, Response } from 'express';
import { EventIngestionService } from '../services/EventIngestionService.js';
import { AIEconomicsService } from '../services/AIEconomicsService.js';
import { ExperimentationEngine } from '../services/ExperimentationEngine.js';
import { MetricsAggregationService } from '../services/MetricsAggregationService.js';
import { AnalyticsAnomalyService } from '../services/AnalyticsAnomalyService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  analyticsBatchIngestSchema,
  experimentCreateSchema,
  experimentUpdateSchema,
  aiModelPricingCreateSchema,
} from '@ai-companion/validation';

export class AnalyticsController {
  /**
   * POST /api/v1/analytics/events
   * Client-side event batch ingestion.
   */
  public static async ingestEvents(req: Request, res: Response): Promise<void> {
    const input = analyticsBatchIngestSchema.parse(req.body);
    const authUserId = req.user?.userId;

    const result = await EventIngestionService.ingestBatch(input.events, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      authUserId,
    });

    ApiResponse.success(res, result, 202);
  }

  /**
   * GET /api/v1/admin/analytics/overview
   */
  public static async getOverview(_req: Request, res: Response): Promise<void> {
    const today = new Date();
    const metrics = await MetricsAggregationService.aggregateProductDailyMetrics(today);
    const recentMetrics = await prisma.productDailyMetric.findMany({
      orderBy: { date: 'desc' },
      take: 7,
    });

    const alerts = await AnalyticsAnomalyService.listAlerts('OPEN', 5);

    ApiResponse.success(res, {
      dau: metrics.dau,
      wau: metrics.wau,
      mau: metrics.mau,
      newUsersToday: metrics.newUsers,
      activatedUsersToday: metrics.activatedUsers,
      activationRate: metrics.newUsers > 0 ? Number(((metrics.activatedUsers / metrics.newUsers) * 100).toFixed(1)) : 0,
      d1RetentionRate: metrics.d1Retained,
      d7RetentionRate: metrics.d7Retained,
      dailyRevenue: metrics.revenue,
      dailyAICost: metrics.aiCost,
      estimatedGrossMargin: metrics.grossMargin,
      activeConversations: metrics.conversations,
      totalMessagesToday: metrics.messages,
      activeAlerts: alerts,
      recentDailyMetrics: recentMetrics.map(m => ({
        id: m.id,
        date: m.date.toISOString().split('T')[0]!,
        dau: m.dau,
        wau: m.wau,
        mau: m.mau,
        newUsers: m.newUsers,
        activatedUsers: m.activatedUsers,
        d1Retained: m.d1Retained,
        d7Retained: m.d7Retained,
        d30Retained: m.d30Retained,
        conversations: m.conversations,
        messages: m.messages,
        revenue: m.revenue,
        aiCost: m.aiCost,
        grossMargin: m.grossMargin,
        voiceMinutes: m.voiceMinutes,
        imageGenerations: m.imageGenerations,
      })),
    });
  }

  /**
   * GET /api/v1/admin/analytics/growth
   */
  public static async getGrowth(_req: Request, res: Response): Promise<void> {
    const funnel = await MetricsAggregationService.getOnboardingFunnel(30);
    const attribution = await MetricsAggregationService.getAttributionSummary();
    const cohorts = await MetricsAggregationService.getCohortRetention(14);

    ApiResponse.success(res, {
      onboardingFunnel: funnel,
      attributionChannels: attribution,
      cohortRetention: cohorts,
    });
  }

  /**
   * GET /api/v1/admin/analytics/retention
   */
  public static async getRetention(_req: Request, res: Response): Promise<void> {
    const cohorts = await MetricsAggregationService.getCohortRetention(30);
    ApiResponse.success(res, { cohorts });
  }

  /**
   * GET /api/v1/admin/analytics/ai-economics
   */
  public static async getAIEconomics(req: Request, res: Response): Promise<void> {
    const days = Math.min(Number(req.query['days']) || 30, 90);
    const economics = await AIEconomicsService.getUnitEconomics(days);
    ApiResponse.success(res, economics);
  }

  /**
   * GET /api/v1/admin/analytics/pricing
   */
  public static async listPricing(_req: Request, res: Response): Promise<void> {
    const pricing = await AIEconomicsService.listPricingRates();
    ApiResponse.success(res, pricing);
  }

  /**
   * POST /api/v1/admin/analytics/pricing
   */
  public static async createPricing(req: Request, res: Response): Promise<void> {
    const input = aiModelPricingCreateSchema.parse(req.body);
    const created = await AIEconomicsService.setPricingRate(input);
    ApiResponse.success(res, created, 201);
  }

  /**
   * GET /api/v1/admin/analytics/characters
   */
  public static async getCharacterAnalytics(_req: Request, res: Response): Promise<void> {
    const today = new Date();
    const metrics = await MetricsAggregationService.aggregateCharacterDailyMetrics(today);
    ApiResponse.success(res, metrics);
  }

  /**
   * GET /api/v1/admin/analytics/creators
   */
  public static async getCreatorAnalytics(_req: Request, res: Response): Promise<void> {
    const today = new Date();
    const metrics = await MetricsAggregationService.aggregateCreatorDailyMetrics(today);
    ApiResponse.success(res, metrics);
  }

  /**
   * GET /api/v1/admin/analytics/experiments
   */
  public static async getExperiments(_req: Request, res: Response): Promise<void> {
    const experiments = await ExperimentationEngine.listExperiments();
    ApiResponse.success(res, experiments);
  }

  /**
   * POST /api/v1/admin/analytics/experiments
   */
  public static async createExperiment(req: Request, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    const input = experimentCreateSchema.parse(req.body);
    const created = await ExperimentationEngine.createExperiment(input, adminId);
    ApiResponse.success(res, created, 201);
  }

  /**
   * PATCH /api/v1/admin/analytics/experiments/:id
   */
  public static async updateExperiment(req: Request, res: Response): Promise<void> {
    const expId = req.params['id'] as string;
    const input = experimentUpdateSchema.parse(req.body);
    const updated = await ExperimentationEngine.updateExperiment(expId, input);
    ApiResponse.success(res, updated);
  }

  /**
   * GET /api/v1/admin/analytics/experiments/:id/analysis
   */
  public static async getExperimentAnalysis(req: Request, res: Response): Promise<void> {
    const expId = req.params['id'] as string;
    const analysis = await ExperimentationEngine.analyzeExperiment(expId);
    ApiResponse.success(res, analysis);
  }

  /**
   * GET /api/v1/admin/analytics/alerts
   */
  public static async getAlerts(req: Request, res: Response): Promise<void> {
    const status = (req.query['status'] as string) || undefined;
    const alerts = await AnalyticsAnomalyService.listAlerts(status);
    ApiResponse.success(res, alerts);
  }

  /**
   * PATCH /api/v1/admin/analytics/alerts/:id/acknowledge
   */
  public static async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    const alertId = req.params['id'] as string;
    const adminId = req.admin?.adminId ?? 'admin';
    const alert = await AnalyticsAnomalyService.acknowledgeAlert(alertId, adminId);
    ApiResponse.success(res, alert);
  }

  /**
   * POST /api/v1/admin/analytics/aggregate/trigger
   */
  public static async triggerAggregation(_req: Request, res: Response): Promise<void> {
    const targetDate = new Date();
    const product = await MetricsAggregationService.aggregateProductDailyMetrics(targetDate);
    const characters = await MetricsAggregationService.aggregateCharacterDailyMetrics(targetDate);
    const creators = await MetricsAggregationService.aggregateCreatorDailyMetrics(targetDate);
    const anomalies = await AnalyticsAnomalyService.scanForAnomalies();

    ApiResponse.success(res, {
      aggregatedDate: targetDate.toISOString().split('T')[0],
      productDau: product.dau,
      charactersProcessed: characters.length,
      creatorsProcessed: creators.length,
      anomaliesFound: anomalies.length,
    });
  }

  // Creator Self Analytics
  /**
   * GET /api/v1/creators/me/analytics/overview
   */
  public static async getCreatorSelfOverview(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      ApiResponse.error(res, 'NOT_FOUND', 'Creator profile not found', 404);
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const metrics = await prisma.creatorDailyMetric.findFirst({
      where: { creatorProfileId: profile.id, date: today },
    });

    ApiResponse.success(res, {
      publishedCharacters: metrics?.publishedCharacters || 0,
      totalStarts: metrics?.totalStarts || 0,
      activeUsers: metrics?.activeUsers || 0,
      returningUsers: metrics?.returningUsers || 0,
      grossEarnings: metrics?.grossEarnings || 0,
      creatorNet: metrics?.creatorNet || 0,
    });
  }

  /**
   * GET /api/v1/creators/me/analytics/characters
   */
  public static async getCreatorSelfCharacters(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      ApiResponse.error(res, 'NOT_FOUND', 'Creator profile not found', 404);
      return;
    }

    const characters = await prisma.character.findMany({
      where: { creatorProfileId: profile.id },
      select: { id: true, name: true, slug: true, avatarUrl: true, status: true },
    });

    const charIds = characters.map(c => c.id);
    const metrics = charIds.length > 0
      ? await prisma.characterDailyMetric.findMany({
          where: { characterId: { in: charIds } },
          orderBy: { date: 'desc' },
          take: 50,
        })
      : [];

    const result = characters.map(char => ({
      ...char,
      recentMetrics: metrics.filter(m => m.characterId === char.id),
    }));

    ApiResponse.success(res, result);
  }
}
