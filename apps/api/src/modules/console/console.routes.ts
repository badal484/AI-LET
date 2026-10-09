import { Router, type NextFunction, type Request, type Response } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { getOverview } from './overview.service.js';

/**
 * The admin console (apps/admin): one compact API made for its 9 screens.
 * Every route needs an admin session and a permission; changes are written to the audit log.
 */
export const consoleRouter: Router = Router();
consoleRouter.use(authenticateAdmin);

const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await fn(req) });
    } catch (err) {
      next(err);
    }
  };

consoleRouter.get('/overview', requirePermission(ADMIN_PERMISSIONS.ANALYTICS_READ), handle(() => getOverview()));
