import { Router } from 'express';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { AdminOnboardingController } from '../controllers/adminOnboarding.controller.js';

const router: Router = Router();

router.get('/analytics', authenticateAdmin, AdminOnboardingController.getAnalytics);
router.get('/configs', authenticateAdmin, AdminOnboardingController.listStepConfigs);
router.post('/configs', authenticateAdmin, AdminOnboardingController.upsertStepConfig);

export default router;
