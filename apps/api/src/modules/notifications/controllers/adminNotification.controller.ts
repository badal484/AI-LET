import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { NotificationService } from '../services/notification.service.js';
import { ProactiveSimulatorService } from '../services/proactiveSimulator.service.js';
import { CampaignService } from '../services/CampaignService.js';
import { NotificationDeliveryEngine } from '../services/NotificationDeliveryEngine.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  adminCampaignUpsertSchema,
  adminCampaignDryRunSchema,
  testPushNotificationSchema,
  proactiveSimulationSchema,
  proactiveListQuerySchema,
} from '@ai-companion/validation';
import { ValidationError } from '../../../shared/errors/AppError.js';

export class AdminNotificationController {
  /**
   * GET /api/v1/admin/notifications/analytics
   */
  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await NotificationService.getNotificationAnalytics();
      ApiResponse.success(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/notifications/simulate
   */
  public static async simulate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = proactiveSimulationSchema.parse(req.body);
      const simulation = await ProactiveSimulatorService.simulate(input as any);
      ApiResponse.success(res, simulation, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/notifications/actions
   */
  public static async listActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = proactiveListQuerySchema.parse(req.query);
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        ...(query.status && { status: query.status }),
        ...(query.characterId && { characterId: query.characterId }),
      };

      const [actions, total] = await Promise.all([
        prisma.proactiveAction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            character: { select: { id: true, name: true, avatarUrl: true } },
            user: { select: { id: true, email: true } },
          },
        }),
        prisma.proactiveAction.count({ where }),
      ]);

      ApiResponse.success(
        res,
        {
          items: actions,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        200,
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/notifications/campaigns
   */
  public static async listCampaigns(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await CampaignService.listCampaigns();
      ApiResponse.success(res, campaigns, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/notifications/campaigns
   */
  public static async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id;
      const body = adminCampaignUpsertSchema.parse(req.body);
      const campaign = await CampaignService.createOrUpdateCampaign(body, undefined, adminId);
      ApiResponse.success(res, campaign, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/notifications/campaigns/dry-run
   */
  public static async dryRunCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = adminCampaignDryRunSchema.parse(req.body);
      const result = await CampaignService.executeDryRun(body);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/notifications/campaigns/:id/send
   */
  public static async sendCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      if (!id) {
        throw new ValidationError('Campaign ID is required');
      }
      const result = await CampaignService.dispatchCampaign(id);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/notifications/test-push
   */
  public static async testPush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id;
      const body = testPushNotificationSchema.parse(req.body);
      const targetUserId = body.targetUserId || adminId;

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: targetUserId,
        category: body.category as any,
        title: body.title,
        body: body.body,
        deepLink: body.deepLink,
        bypassQuietHours: true,
      });

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
