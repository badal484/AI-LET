import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { createSupportRequest, mySupportRequests } from './ops.service.js';

/** The app's Help → Contact us: users write to the team and see the replies. */
export const supportRouter: Router = Router();
supportRouter.use(authenticateUser);

supportRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await createSupportRequest(req.user!.userId, String(req.body?.topic ?? 'other'), String(req.body?.message ?? '')) });
  } catch (err) {
    next(err);
  }
});

supportRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await mySupportRequests(req.user!.userId) });
  } catch (err) {
    next(err);
  }
});
