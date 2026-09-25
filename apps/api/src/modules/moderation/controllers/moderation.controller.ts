import { Request, Response, NextFunction } from 'express';
import { CharacterModerationService } from '../services/CharacterModerationService.js';
import {
  characterReportCreateSchema,
  moderationDecisionSchema,
  moderationAppealCreateSchema,
} from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class ModerationController {
  /**
   * User submits a report on an inappropriate/unsafe character.
   */
  public static async submitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = characterReportCreateSchema.parse(req.body);
      const result = await CharacterModerationService.submitUserReport(userId, input);
      ApiResponse.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Creator submits an appeal for a rejected or suspended character.
   */
  public static async submitAppeal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const caseId = req.body.caseId as string;
      const input = moderationAppealCreateSchema.parse(req.body);
      const result = await CharacterModerationService.submitAppeal(creator.id, caseId, input);
      ApiResponse.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List pending moderation queue with risk scoring.
   */
  public static async listQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query['status'] as string | undefined;
      const riskLevel = req.query['riskLevel'] as 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;

      const result = await CharacterModerationService.listModerationQueue({
        status,
        riskLevel,
        page,
        limit,
      });

      ApiResponse.success(res, result.items, 200, {
        page,
        limit,
        total: result.total,
        hasMore: page * limit < result.total,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: View full moderation case detail with snapshot and history.
   */
  public static async getCaseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caseId = req.params['id'] as string;
      const detail = await CharacterModerationService.getModerationCaseDetail(caseId);
      ApiResponse.success(res, detail, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Apply review decision (APPROVE, REJECT, REQUEST_CHANGES, SUSPEND).
   */
  public static async reviewCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const moderatorId = (req as any).admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const caseId = req.params['id'] as string;
      const input = moderationDecisionSchema.parse(req.body);
      const result = await CharacterModerationService.reviewCharacter(moderatorId, caseId, input);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Review and decide on an appeal.
   */
  public static async reviewAppeal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const moderatorId = (req as any).admin?.adminId || (req as any).adminPrincipal?.adminId || '00000000-0000-0000-0000-000000000000';
      const appealId = req.params['id'] as string;
      const decision = req.body.decision as 'UPHELD' | 'OVERTURNED';
      const notes = req.body.notes || '';
      const result = await CharacterModerationService.reviewAppeal(moderatorId, appealId, decision, notes);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
