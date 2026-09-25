import { Request, Response, NextFunction } from 'express';
import { AdminCharacterService } from '../services/adminCharacter.service.js';
import { CharacterTestService } from '../services/characterTest.service.js';
import {
  adminCharacterQuerySchema,
  createCharacterRequestSchema,
  updateCharacterMetadataSchema,
  createCharacterVersionSchema,
  updateCharacterVersionSchema,
  publishCharacterVersionSchema,
  rollbackCharacterSchema,
  characterTestRequestSchema,
} from '@ai-companion/validation';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class AdminCharacterController {
  public static async listCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = adminCharacterQuerySchema.parse(req.query);
      const result = await AdminCharacterService.listCharacters(query);

      ApiResponse.success(res, result.characters, 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.page * result.limit < result.total,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const input = createCharacterRequestSchema.parse(req.body);
      const character = await AdminCharacterService.createCharacter(adminId, input);

      ApiResponse.success(res, character, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getCharacterDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const character = await AdminCharacterService.getCharacterDetail(id);

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async updateCharacterMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const input = updateCharacterMetadataSchema.parse(req.body);
      const character = await AdminCharacterService.updateCharacterMetadata(adminId, id, input);

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createVersionDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const input = createCharacterVersionSchema.parse(req.body || {});
      const version = await AdminCharacterService.createVersionDraft(
        adminId,
        id,
        input.baseVersionId,
        input.changeSummary,
      );

      ApiResponse.success(res, version, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const versionId = req.params['versionId'] as string;
      const version = await AdminCharacterService.getVersion(id, versionId);

      ApiResponse.success(res, version, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async updateVersionDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const versionId = req.params['versionId'] as string;
      const input = updateCharacterVersionSchema.parse(req.body);
      const version = await AdminCharacterService.updateVersionDraft(adminId, id, versionId, input);

      ApiResponse.success(res, version, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async publishVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const versionId = req.params['versionId'] as string;
      const input = publishCharacterVersionSchema.parse(req.body || {});
      const character = await AdminCharacterService.publishVersion(
        adminId,
        id,
        versionId,
        input.validationOverride,
      );

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async rollbackVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const input = rollbackCharacterSchema.parse(req.body);
      const character = await AdminCharacterService.rollbackVersion(
        adminId,
        id,
        input.targetVersionId,
        input.reason,
      );

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async unpublishCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const character = await AdminCharacterService.unpublishCharacter(adminId, id);

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async archiveCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const id = req.params['id'] as string;
      const character = await AdminCharacterService.archiveCharacter(adminId, id);

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async testInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const versionId = req.params['versionId'] as string;
      const input = characterTestRequestSchema.parse(req.body);

      const adminPermissions: string[] = req.admin?.permissions || (req as any).adminPrincipal?.permissions || [];
      const hasDebugPermission =
        adminPermissions.includes(ADMIN_PERMISSIONS.CHARACTERS_DEBUG) ||
        req.admin?.roles?.includes('super_admin') ||
        req.admin?.roles?.includes('admin');

      const result = await CharacterTestService.testInteraction(id, versionId, input, hasDebugPermission);

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async compareVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const { v1, v2 } = req.query;

      if (!v1 || !v2 || typeof v1 !== 'string' || typeof v2 !== 'string') {
        ApiResponse.error(res, 'VALIDATION_ERROR', 'Both v1 and v2 version IDs are required in query params', 400);
        return;
      }

      const diff = await AdminCharacterService.compareVersions(id, v1, v2);

      ApiResponse.success(res, diff, 200);
    } catch (err) {
      next(err);
    }
  }
}
