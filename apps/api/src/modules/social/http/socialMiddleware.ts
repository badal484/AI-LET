import type { NextFunction, Request, Response } from 'express';
import { ErrorCode, type SocialFeatureKey, type SocialRateLimitedAction } from '@ai-companion/config';
import { AppError } from '../../../shared/errors/AppError.js';
import { idempotencyMiddleware } from '../../../shared/middleware/idempotency.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialRateLimiter } from '../safety/SocialRateLimiter.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const handle =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export const requestIdOf = (res: Response): string | undefined => res.locals['correlationId'] as string | undefined;

/** Independent kill switch / rollout gate per social primitive. */
export const requireSocialFeature = (feature: SocialFeatureKey) =>
  handle(async (req, _res, next) => {
    const platform = (req.headers['x-client-platform'] as string | undefined)?.toLowerCase();
    await SocialPolicyService.assertFeature(feature, {
      userId: req.user?.userId ?? null,
      platform: platform === 'ios' || platform === 'android' || platform === 'web' ? platform : undefined,
      appVersion: req.headers['x-app-version'] as string | undefined,
      region: req.headers['x-client-region'] as string | undefined,
    });
    next();
  });

/**
 * Every social mutation requires an Idempotency-Key (retries must never double-execute),
 * then reuses the platform idempotency middleware for replay.
 */
const replay = idempotencyMiddleware(86_400);
export const requireIdempotencyKey = (req: Request, res: Response, next: NextFunction): void => {
  const key = (req.headers['idempotency-key'] as string | undefined) ?? (req.headers['x-idempotency-key'] as string | undefined);
  if (!key || key.length < 8 || key.length > 128) {
    next(new AppError('An Idempotency-Key header (8-128 chars) is required for this request.', 400, ErrorCode.SOCIAL_IDEMPOTENCY_KEY_REQUIRED));
    return;
  }
  // The platform middleware only covers POST/PUT/PATCH; DELETEs here are naturally idempotent.
  void replay(req, res, next);
};

/** Read-side limits (scraping resistance) keyed by user, falling back to IP. */
export const socialReadLimit = (action: Extract<SocialRateLimitedAction, 'profile_read' | 'share_read'>) =>
  handle(async (req, _res, next) => {
    const subject = req.user?.userId ?? `ip:${req.ip}`;
    await SocialRateLimiter.enforce(action, subject);
    next();
  });
