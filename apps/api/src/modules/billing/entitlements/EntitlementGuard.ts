import { Request, Response, NextFunction } from 'express';
import { EntitlementService } from './EntitlementService.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';

/**
 * Express middleware factory to guard routes by entitlement key.
 */
export function requireEntitlement(entitlementKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required to access this resource');
      }

      await EntitlementService.requireEntitlement(req.user.userId, entitlementKey);
      next();
    } catch (err) {
      next(err);
    }
  };
}
