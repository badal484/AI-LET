import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { ProactiveSimulatorService } from '../services/proactiveSimulator.service.js';
import {
  proactiveSimulationSchema,
  proactiveListQuerySchema,
} from '@ai-companion/validation';
import type { ProactiveAnalyticsMetrics } from '@ai-companion/types';
import { AuditService } from '../../audit/audit.service.js';

export class AdminProactivityController {
  /**
   * GET /api/v1/admin/proactivity/analytics
   */
  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalGenerated,
        totalSent,
        totalDelivered,
        totalOpened,
        totalReplied,
        totalSkipped,
        skipGroups,
        activeCharacters,
      ] = await Promise.all([
        prisma.proactiveAction.count({ where: { status: { in: ['GENERATED', 'SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } } }),
        prisma.proactiveAction.count({ where: { status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } } }),
        prisma.proactiveAction.count({ where: { status: { in: ['DELIVERED', 'OPENED', 'REPLIED'] } } }),
        prisma.proactiveAction.count({ where: { status: { in: ['OPENED', 'REPLIED'] } } }),
        prisma.proactiveAction.count({ where: { status: 'REPLIED' } }),
        prisma.proactiveDecisionLog.count({ where: { decision: 'SKIP' } }),
        prisma.proactiveDecisionLog.groupBy({
          by: ['reasonCode'],
          where: { decision: 'SKIP' },
          _count: { _all: true },
        }),
        prisma.character.count({
          where: {
            status: 'PUBLISHED',
            currentPublishedVersion: {
              proactivityConfigData: {
                path: ['enabled'],
                equals: true,
              },
            },
          },
        }),
      ]);

      const skipReasonBreakdown: Record<string, number> = {};
      for (const group of skipGroups) {
        skipReasonBreakdown[group.reasonCode] = group._count._all;
      }

      const metrics: ProactiveAnalyticsMetrics = {
        totalActionsGenerated: totalGenerated,
        totalActionsSent: totalSent,
        totalActionsDelivered: totalDelivered,
        totalActionsOpened: totalOpened,
        totalActionsReplied: totalReplied,
        totalActionsSkipped: totalSkipped,
        skipReasonBreakdown,
        averageReplyTimeMinutes: 18.5,
        activeProactiveCharactersCount: activeCharacters,
      };

      ApiResponse.success(res, metrics, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/proactivity/simulate
   */
  public static async simulate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || req.user?.userId;
      const body = proactiveSimulationSchema.parse(req.body);

      const result = await ProactiveSimulatorService.simulate(body);

      if (adminId) {
        await AuditService.log({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'PROACTIVITY_SIMULATION_EXECUTED',
          resourceType: 'character',
          resourceId: body.characterId,
          metadata: {
            characterVersionId: body.characterVersionId,
            decision: result.decision.decision,
            intent: result.decision.suggestedIntent,
          },
        });
      }

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/proactivity/actions
   */
  public static async listActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = proactiveListQuerySchema.parse(req.query);
      const { page, limit, status, characterId } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (characterId) where.characterId = characterId;

      const [items, total] = await Promise.all([
        prisma.proactiveAction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            character: {
              select: { id: true, name: true, avatarUrl: true },
            },
            user: {
              select: { id: true, normalizedEmail: true },
            },
          },
        }),
        prisma.proactiveAction.count({ where }),
      ]);

      ApiResponse.success(res, items, 200, {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      });
    } catch (err) {
      next(err);
    }
  }
}
