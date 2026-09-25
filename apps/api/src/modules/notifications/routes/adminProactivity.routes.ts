import { Router } from 'express';
import { AdminProactivityController } from '../controllers/adminProactivity.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminProactivityRouter: Router = Router();

// All admin proactivity endpoints require active admin authentication
adminProactivityRouter.use(authenticateAdmin);

// Platform-level proactivity analytics
adminProactivityRouter.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminProactivityController.getAnalytics,
);

// Sandboxed dry-run proactive simulation for Character Studio
adminProactivityRouter.post(
  '/simulate',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_DEBUG),
  AdminProactivityController.simulate,
);

// Proactive action lifecycle log inspection
adminProactivityRouter.get(
  '/actions',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminProactivityController.listActions,
);
