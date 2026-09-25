import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const feedbackRouter: Router = Router();
const controller = new FeedbackController();

// User-facing feedback submission
feedbackRouter.post('/', authenticateUser, controller.submitFeedback);

// Admin-facing feedback summary
feedbackRouter.get('/summary', authenticateAdmin, requirePermission(ADMIN_PERMISSIONS.AI_READ), controller.getSummary);
