import { Router, Request, Response, NextFunction } from 'express';
import { ModerationController } from '../controllers/moderation.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export const moderationRouter: Router = Router();
export const adminModerationRouter: Router = Router();

/**
 * Middleware ensuring caller has an active creator profile.
 */
async function requireCreator(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    return next(new ForbiddenError('User authentication required', ErrorCode.AUTH_UNAUTHORIZED));
  }

  const creator = await prisma.creatorProfile.findUnique({
    where: { userId },
  });

  if (!creator) {
    return next(
      new ForbiddenError('Creator profile not found', ErrorCode.AUTH_FORBIDDEN),
    );
  }

  (req as any).creator = creator;
  next();
}

// ----------------------------------------------------
// User / Creator Moderation Routes (/api/v1/moderation)
// ----------------------------------------------------
// POST /api/v1/moderation/reports - Submit a report against a character
moderationRouter.post('/reports', authenticateUser, ModerationController.submitReport);

// POST /api/v1/moderation/appeals - Submit an appeal for a rejected character
moderationRouter.post('/appeals', authenticateUser, requireCreator, ModerationController.submitAppeal);

// ----------------------------------------------------
// Admin Moderation Routes (/api/v1/admin/moderation)
// ----------------------------------------------------
// GET /api/v1/admin/moderation/queue - List characters pending review
adminModerationRouter.get('/queue', authenticateAdmin, ModerationController.listQueue);

// GET /api/v1/admin/moderation/cases/:id - Get case details
adminModerationRouter.get('/cases/:id', authenticateAdmin, ModerationController.getCaseDetail);

// POST /api/v1/admin/moderation/cases/:id/decision - Approve, reject, request changes, or suspend
adminModerationRouter.post('/cases/:id/decision', authenticateAdmin, ModerationController.reviewCase);

// POST /api/v1/admin/moderation/appeals/:id/decision - Review appeal
adminModerationRouter.post('/appeals/:id/decision', authenticateAdmin, ModerationController.reviewAppeal);
