import { Request, Response } from 'express';
import { SafetyService } from '../services/SafetyService.js';
import { PolicyEngine } from '../services/PolicyEngine.js';
import { UserBlockService } from '../services/UserBlockService.js';
import { EnforcementService } from '../services/EnforcementService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  safetyEvaluateInputSchema,
  safetyEvaluateOutputSchema,
  userBlockCreateSchema,
  accountRestrictionCreateSchema,
  safetyPolicyCreateSchema,
} from '@ai-companion/validation';

export class SafetyController {
  /**
   * POST /api/v1/safety/evaluate-input
   */
  public static async evaluateInput(req: Request, res: Response): Promise<void> {
    const input = safetyEvaluateInputSchema.parse(req.body);
    const userId = req.user?.userId;

    const result = await SafetyService.evaluateInput({
      surface: input.surface,
      content: input.content,
      userId,
      characterId: input.characterId,
      conversationId: input.conversationId,
      requestId: req.headers['x-request-id'] as string,
      metadata: input.metadata,
    });

    ApiResponse.success(res, result);
  }

  /**
   * POST /api/v1/safety/evaluate-output
   */
  public static async evaluateOutput(req: Request, res: Response): Promise<void> {
    const input = safetyEvaluateOutputSchema.parse(req.body);
    const userId = req.user?.userId;

    const result = await SafetyService.evaluateOutput({
      surface: input.surface,
      content: input.content,
      userId,
      characterId: input.characterId,
      conversationId: input.conversationId,
      requestId: req.headers['x-request-id'] as string,
      metadata: input.metadata,
    });

    ApiResponse.success(res, result);
  }

  /**
   * POST /api/v1/safety/blocks
   */
  public static async blockTarget(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const input = userBlockCreateSchema.parse(req.body);

    const block = await UserBlockService.blockTarget(userId, input);
    ApiResponse.success(res, block, 201);
  }

  /**
   * DELETE /api/v1/safety/blocks/:id
   */
  public static async unblockTarget(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const blockId = req.params['id'] as string;

    await UserBlockService.unblockTarget(userId, blockId);
    ApiResponse.success(res, { unblocked: true });
  }

  /**
   * GET /api/v1/safety/blocks
   */
  public static async getBlockedList(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const list = await UserBlockService.getBlockedList(userId);
    ApiResponse.success(res, list);
  }

  // Admin Endpoints

  /**
   * GET /api/v1/admin/safety/policies
   */
  public static async getActivePolicy(_req: Request, res: Response): Promise<void> {
    const policy = await PolicyEngine.getActivePolicy();
    ApiResponse.success(res, policy);
  }

  /**
   * POST /api/v1/admin/safety/policies
   */
  public static async createPolicyVersion(req: Request, res: Response): Promise<void> {
    const input = safetyPolicyCreateSchema.parse(req.body);

    const created = await prisma.safetyPolicyVersion.create({
      data: {
        versionNumber: input.versionNumber,
        name: input.name,
        description: input.description,
        rules: input.rules as unknown as any,
        isActive: input.isActive,
      },
    });

    PolicyEngine.invalidateCache();
    ApiResponse.success(res, created, 201);
  }

  /**
   * GET /api/v1/admin/safety/evaluations
   */
  public static async listEvaluationLogs(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Number(req.query['limit']) || 50, 100);
    const logs = await prisma.safetyEvaluationLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: true, character: true },
    });

    ApiResponse.success(res, logs);
  }

  /**
   * POST /api/v1/admin/safety/restrictions
   */
  public static async issueRestriction(req: Request, res: Response): Promise<void> {
    const adminId = req.admin!.adminId;
    const input = accountRestrictionCreateSchema.parse(req.body);

    const restriction = await EnforcementService.issueRestriction(adminId, input);
    ApiResponse.success(res, restriction, 201);
  }

  /**
   * DELETE /api/v1/admin/safety/restrictions/:id
   */
  public static async revokeRestriction(req: Request, res: Response): Promise<void> {
    const adminId = req.admin!.adminId;
    const restrictionId = req.params['id'] as string;
    const reason = (req.body?.['reason'] as string) || 'Admin revocation';

    const revoked = await EnforcementService.revokeRestriction(adminId, restrictionId, reason);
    ApiResponse.success(res, revoked);
  }
}
