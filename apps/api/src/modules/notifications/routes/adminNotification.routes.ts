import { Router } from 'express';
import { AdminNotificationController } from '../controllers/adminNotification.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminNotificationRouter: Router = Router();

// All admin notification endpoints require active admin authentication
adminNotificationRouter.use(authenticateAdmin);

// Platform-level delivery & retention analytics
adminNotificationRouter.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminNotificationController.getAnalytics,
);

// Sandboxed dry-run proactive simulation for Character Studio
adminNotificationRouter.post(
  '/simulate',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_DEBUG),
  AdminNotificationController.simulate,
);

// Proactive action lifecycle log inspection
adminNotificationRouter.get(
  '/actions',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminNotificationController.listActions,
);

// Admin Re-engagement Campaigns
adminNotificationRouter.get(
  '/campaigns',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminNotificationController.listCampaigns,
);

adminNotificationRouter.post(
  '/campaigns',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_WRITE),
  AdminNotificationController.createCampaign,
);

adminNotificationRouter.post(
  '/campaigns/dry-run',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_READ),
  AdminNotificationController.dryRunCampaign,
);

adminNotificationRouter.post(
  '/campaigns/:id/send',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_WRITE),
  AdminNotificationController.sendCampaign,
);

// Test Push tool
adminNotificationRouter.post(
  '/test-push',
  requirePermission(ADMIN_PERMISSIONS.PROACTIVITY_DEBUG),
  AdminNotificationController.testPush,
);
