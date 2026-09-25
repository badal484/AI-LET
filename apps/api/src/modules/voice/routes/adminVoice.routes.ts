import { Router } from 'express';
import { AdminVoiceController } from '../controllers/adminVoice.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminVoiceRoutes: Router = Router();

// Admin endpoints require admin authentication & RBAC
adminVoiceRoutes.use(authenticateAdmin);

adminVoiceRoutes.post(
  '/preview',
  requirePermission(ADMIN_PERMISSIONS.VOICE_PREVIEW),
  AdminVoiceController.generatePreview
);

adminVoiceRoutes.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.VOICE_TELEMETRY_READ),
  AdminVoiceController.getAnalytics
);

adminVoiceRoutes.get(
  '/cost',
  requirePermission(ADMIN_PERMISSIONS.VOICE_COST_READ),
  AdminVoiceController.getCost
);

adminVoiceRoutes.get(
  '/sessions',
  requirePermission(ADMIN_PERMISSIONS.VOICE_READ),
  AdminVoiceController.listSessions
);
