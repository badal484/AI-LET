import { Router } from 'express';
import { AdminRelationshipController } from '../controllers/adminRelationship.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminRelationshipRouter: Router = Router();

// All admin relationship endpoints require active admin authentication
adminRelationshipRouter.use(authenticateAdmin);

// Platform-level aggregate metrics
adminRelationshipRouter.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.RELATIONSHIPS_READ),
  AdminRelationshipController.getAnalytics,
);

// Dry-run sandboxed relationship simulator for Character Studio
adminRelationshipRouter.post(
  '/simulate',
  requirePermission(ADMIN_PERMISSIONS.RELATIONSHIPS_DEBUG),
  AdminRelationshipController.simulate,
);

// Auditable transition history inspection
adminRelationshipRouter.get(
  '/:relationshipId/history',
  requirePermission(ADMIN_PERMISSIONS.RELATIONSHIPS_READ),
  AdminRelationshipController.getHistory,
);
