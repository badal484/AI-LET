import { Router } from 'express';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';
import { OnboardingController } from '../controllers/onboarding.controller.js';

const router: Router = Router();

router.get('/', authenticateUser, OnboardingController.getState);
router.post('/start', authenticateUser, OnboardingController.start);
router.post('/step', authenticateUser, OnboardingController.completeStep);
router.post('/skip', authenticateUser, OnboardingController.skip);
router.post('/complete', authenticateUser, OnboardingController.complete);
router.get('/starters', optionalAuth, OnboardingController.getStarters);
router.post('/events', optionalAuth, OnboardingController.trackEvent);

export default router;
