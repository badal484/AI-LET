import { Router } from 'express';
import { AdminMemoryController } from '../controllers/adminMemory.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminMemoryRouter: Router = Router();

// All admin memory routes require active admin authentication
adminMemoryRouter.use(authenticateAdmin);

// Privacy-safe aggregate analytics
adminMemoryRouter.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.MEMORIES_READ),
  AdminMemoryController.getAnalytics,
);

// Diagnostic dry-run retrieval for authorized admin debugging
adminMemoryRouter.post(
  '/debug-retrieval',
  requirePermission(ADMIN_PERMISSIONS.MEMORIES_DEBUG),
  AdminMemoryController.debugRetrieval,
);
