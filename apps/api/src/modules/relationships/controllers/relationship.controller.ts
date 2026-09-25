import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { RelationshipStateService } from '../services/relationshipState.service.js';
import {
  updateUserRelationshipSettingsSchema,
  relationshipListQuerySchema,
} from '@ai-companion/validation';
import { AuthenticationError, ValidationError } from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';

export class RelationshipController {
  /**
   * GET /api/v1/relationships/:characterId
   */
  public static async getRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const characterId = req.params['characterId'] as string;
      if (!characterId) {
        throw new ValidationError('characterId param is required');
      }

      const relationship = await RelationshipStateService.getOrCreateRelationship(userId, characterId);
      ApiResponse.success(res, relationship, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/relationships/:characterId/reset
   */
  public static async resetRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const characterId = req.params['characterId'] as string;
      if (!characterId) {
        throw new ValidationError('characterId param is required');
      }

      const resetRel = await RelationshipStateService.resetRelationship(userId, characterId);

      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'RELATIONSHIP_RESET',
        resourceType: 'relationship',
        resourceId: resetRel.id,
        metadata: { characterId },
      });

      ApiResponse.success(res, resetRel, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/relationships
   */
  public static async listRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const query = relationshipListQuerySchema.parse(req.query);
      const result = await RelationshipStateService.listUserRelationships(userId, query);
      ApiResponse.success(res, result.items, 200, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        hasMore: result.pagination.page < result.pagination.totalPages,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/settings/personalization
   */
  public static async getUserSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const settings = await RelationshipStateService.getUserRelationshipSettings(userId);
      ApiResponse.success(res, settings, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/settings/personalization
   */
  public static async updateUserSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = updateUserRelationshipSettingsSchema.parse(req.body);
      const updated = await RelationshipStateService.updateUserRelationshipSettings(userId, body);

      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'RELATIONSHIP_SETTINGS_UPDATED',
        resourceType: 'user_relationship_settings',
        resourceId: userId,
        metadata: body,
      });

      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
}


