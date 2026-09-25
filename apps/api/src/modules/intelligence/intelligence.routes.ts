import { Router } from 'express';
import { IntelligenceController } from './intelligence.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import {
  updatePersonalizationSchema,
  resetPersonalizationSchema,
} from '@ai-companion/validation';

export const intelligenceRouter: Router = Router();
const controller = new IntelligenceController();

// User Personalization Endpoints
intelligenceRouter.get(
  '/personalization',
  authenticateUser,
  controller.getPersonalization
);

intelligenceRouter.patch(
  '/personalization',
  authenticateUser,
  validateRequest(updatePersonalizationSchema),
  controller.updatePersonalization
);

intelligenceRouter.post(
  '/personalization/reset',
  authenticateUser,
  validateRequest(resetPersonalizationSchema),
  controller.resetPersonalization
);

// User-Facing Explicit Feedback (sanitized and recorded)
intelligenceRouter.post(
  '/feedback',
  authenticateUser,
  controller.submitFeedback
);
