import { Router } from 'express';
import { PrivacyController } from '../controllers/PrivacyController.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';

export const adminPrivacyRouter: Router = Router();

adminPrivacyRouter.use(authenticateAdmin);

adminPrivacyRouter.get('/exports', PrivacyController.listAdminExports);
adminPrivacyRouter.get('/deletions', PrivacyController.listAdminDeletions);
