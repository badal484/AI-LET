import { Request, Response } from 'express';
import { AccountDeletionService } from '../services/AccountDeletionService.js';
import { PrivacyService } from '../services/PrivacyService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  privacySettingsUpdateSchema,
  dataExportCreateSchema,
  accountDeletionCreateSchema,
} from '@ai-companion/validation';

export class PrivacyController {
  /**
   * GET /api/v1/privacy/settings
   */
  public static async getSettings(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const settings = await PrivacyService.getPrivacySettings(userId);
    ApiResponse.success(res, settings);
  }

  /**
   * PATCH /api/v1/privacy/settings
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const input = privacySettingsUpdateSchema.parse(req.body);

    const settings = await PrivacyService.updatePrivacySettings(userId, input);
    ApiResponse.success(res, settings);
  }

  /**
   * POST /api/v1/privacy/export
   */
  public static async requestExport(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const input = dataExportCreateSchema.parse(req.body);

    const exportReq = await PrivacyService.requestDataExport(userId, input.dataTypes);
    ApiResponse.success(res, exportReq, 202);
  }

  /**
   * GET /api/v1/privacy/export/:id
   */
  public static async getExportStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const exportId = req.params['id'] as string;

    const exportReq = await PrivacyService.getExportStatus(userId, exportId);
    ApiResponse.success(res, exportReq);
  }

  /**
   * POST /api/v1/privacy/delete-account
   */
  public static async requestDeletion(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const input = accountDeletionCreateSchema.parse(req.body);

    const deletionReq = await PrivacyService.requestAccountDeletion(userId, input.reason, input.confirmEmail);
    ApiResponse.success(res, deletionReq, 202);
  }

  /**
   * DELETE /api/v1/privacy/delete-account — cancels a pending request during the grace period.
   */
  public static async cancelDeletion(req: Request, res: Response): Promise<void> {
    ApiResponse.success(res, await AccountDeletionService.cancel(req.user!.userId));
  }

  /**
   * POST /api/v1/privacy/purge-memories
   */
  public static async purgeMemories(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await PrivacyService.purgeUserMemories(userId);
    ApiResponse.success(res, result);
  }

  // Admin Endpoints

  /**
   * GET /api/v1/admin/privacy/exports
   */
  public static async listAdminExports(_req: Request, res: Response): Promise<void> {
    const exportsList = await prisma.dataExportRequest.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    });
    ApiResponse.success(res, exportsList);
  }

  /**
   * GET /api/v1/admin/privacy/deletions
   */
  public static async listAdminDeletions(_req: Request, res: Response): Promise<void> {
    const deletions = await prisma.accountDeletionRequest.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    ApiResponse.success(res, deletions);
  }
}
