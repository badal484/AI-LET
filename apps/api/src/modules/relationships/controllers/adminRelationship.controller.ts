import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { RelationshipStateService } from '../services/relationshipState.service.js';
import { RelationshipSimulatorService } from '../services/relationshipSimulator.service.js';
import { relationshipSimulationSchema } from '@ai-companion/validation';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';

export class AdminRelationshipController {
  /**
   * GET /api/v1/admin/relationships/analytics
   */
  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await RelationshipStateService.getRelationshipAnalytics();
      ApiResponse.success(res, metrics, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/relationships/simulate
   */
  public static async simulate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || req.user?.userId;
      const body = relationshipSimulationSchema.parse(req.body);

      const result = await RelationshipSimulatorService.simulate(body);

      if (adminId) {
        await AuditService.log({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'RELATIONSHIP_SIMULATION_EXECUTED',
          resourceType: 'character',
          resourceId: body.characterId,
          metadata: {
            characterVersionId: body.characterVersionId,
            signalsCount: result.analyzedSignals.length,
            resultingStage: result.resultingState.stage,
          },
        });
      }

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/relationships/:relationshipId/history
   */
  public static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || req.user?.userId;
      const relationshipId = req.params['relationshipId'] as string;

      if (!relationshipId) {
        throw new ValidationError('relationshipId param is required');
      }

      const history = await RelationshipStateService.getRelationshipHistory(relationshipId);

      if (adminId) {
        await AuditService.log({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'RELATIONSHIP_HISTORY_INSPECTED',
          resourceType: 'relationship',
          resourceId: relationshipId,
        });
      }

      ApiResponse.success(res, history, 200);
    } catch (err) {
      next(err);
    }
  }
}


