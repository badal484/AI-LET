import { Router, Request, Response, NextFunction } from 'express';
import { CreatorController } from '../controllers/creator.controller.js';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export const creatorRouter: Router = Router();

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
      new ForbiddenError('Creator profile not found. Please complete creator onboarding first.', ErrorCode.AUTH_FORBIDDEN),
    );
  }

  if (creator.status === 'SUSPENDED' || creator.status === 'BANNED') {
    return next(new ForbiddenError(`Creator account is ${creator.status.toLowerCase()}`, ErrorCode.AUTH_FORBIDDEN));
  }

  (req as any).creator = creator;
  next();
}

// ----------------------------------------------------
// Public / Optional Auth Routes
// ----------------------------------------------------
// GET /api/v1/creators/:username - View public creator profile

// ----------------------------------------------------
// Authenticated User Routes (Onboarding & Follow)
// ----------------------------------------------------
// POST /api/v1/creators/onboard - Become a creator
creatorRouter.post('/onboard', authenticateUser, CreatorController.onboard);

// POST /api/v1/creators/:username/follow - Follow or unfollow a creator

// ----------------------------------------------------
// Authenticated Creator Routes
// ----------------------------------------------------
// GET /api/v1/creators/me - Get creator's own profile
creatorRouter.get('/me', authenticateUser, CreatorController.getMe);

// PATCH /api/v1/creators/me - Update profile
creatorRouter.patch('/me', authenticateUser, requireCreator, CreatorController.updateMe);

// GET /api/v1/creators/me/characters - List creator characters
creatorRouter.get('/me/characters', authenticateUser, requireCreator, CreatorController.listCharacters);

// POST /api/v1/creators/me/characters - Create initial character draft
creatorRouter.post('/me/characters', authenticateUser, requireCreator, CreatorController.createCharacter);

// GET /api/v1/creators/me/characters/:id - Get character builder state
creatorRouter.get('/me/characters/:id', authenticateUser, requireCreator, CreatorController.getCharacterBuilderState);

// PATCH /api/v1/creators/me/characters/:id - Save draft updates
creatorRouter.patch('/me/characters/:id', authenticateUser, requireCreator, CreatorController.saveCharacterDraft);

// POST /api/v1/creators/me/characters/:id/submit - Submit for review
creatorRouter.post('/me/characters/:id/submit', authenticateUser, requireCreator, CreatorController.submitCharacterForReview);

// POST /api/v1/creators/me/characters/:id/unpublish - Unpublish character
creatorRouter.post('/me/characters/:id/unpublish', authenticateUser, requireCreator, CreatorController.unpublishCharacter);

// POST /api/v1/creators/me/characters/:id/test - Sandboxed playground chat
creatorRouter.post('/me/characters/:id/test', authenticateUser, requireCreator, CreatorController.sandboxedPlaygroundChat);

// GET /api/v1/creators/me/analytics - Aggregate analytics overview
creatorRouter.get('/me/analytics', authenticateUser, requireCreator, CreatorController.getAnalyticsOverview);

// GET /api/v1/creators/me/characters/:id/analytics - Character specific analytics
creatorRouter.get('/me/characters/:id/analytics', authenticateUser, requireCreator, CreatorController.getCharacterAnalytics);

// GET /api/v1/creators/me/monetization - Earnings ledger and monetization foundation
creatorRouter.get('/me/monetization', authenticateUser, requireCreator, CreatorController.getMonetizationOverview);

// ----------------------------------------------------
// Public username routes — registered LAST so they never shadow '/me' and '/onboard'.
// ----------------------------------------------------
// GET /api/v1/creators/:username - View public creator profile
creatorRouter.get('/:username', optionalAuth, CreatorController.getPublicProfile);
// POST /api/v1/creators/:username/follow - Follow or unfollow a creator
creatorRouter.post('/:username/follow', authenticateUser, CreatorController.toggleFollow);
