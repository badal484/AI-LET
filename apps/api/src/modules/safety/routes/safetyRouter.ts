import { Router } from 'express';
import { SafetyController } from '../controllers/SafetyController.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const safetyRouter: Router = Router();

// Public / Semi-authenticated evaluation endpoints (can be called with or without auth)
safetyRouter.post('/evaluate-input', SafetyController.evaluateInput);
safetyRouter.post('/evaluate-output', SafetyController.evaluateOutput);

// User-Authenticated Block / Mute Endpoints
safetyRouter.use(authenticateUser);
safetyRouter.get('/blocks', SafetyController.getBlockedList);
safetyRouter.post('/blocks', SafetyController.blockTarget);
safetyRouter.delete('/blocks/:id', SafetyController.unblockTarget);
