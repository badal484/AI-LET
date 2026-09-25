import { Router } from 'express';
import { AdminCharacterController } from '../controllers/adminCharacter.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminCharacterRouter: Router = Router();

// All character admin routes require active admin authentication
adminCharacterRouter.use(authenticateAdmin);

// Character collection CRUD
adminCharacterRouter.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminCharacterController.listCharacters,
);

adminCharacterRouter.post(
  '/',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_CREATE),
  AdminCharacterController.createCharacter,
);

// Version diff comparison
adminCharacterRouter.get(
  '/:id/diff',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminCharacterController.compareVersions,
);

// Character detail & metadata
adminCharacterRouter.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminCharacterController.getCharacterDetail,
);

adminCharacterRouter.patch(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_UPDATE),
  AdminCharacterController.updateCharacterMetadata,
);

// Lifecycle actions (unpublish, rollback, archive)
adminCharacterRouter.post(
  '/:id/unpublish',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_PUBLISH),
  AdminCharacterController.unpublishCharacter,
);

adminCharacterRouter.post(
  '/:id/rollback',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_ROLLBACK),
  AdminCharacterController.rollbackVersion,
);

adminCharacterRouter.post(
  '/:id/archive',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_ARCHIVE),
  AdminCharacterController.archiveCharacter,
);

// Version Management
adminCharacterRouter.post(
  '/:id/versions',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_CREATE),
  AdminCharacterController.createVersionDraft,
);

adminCharacterRouter.get(
  '/:id/versions/:versionId',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminCharacterController.getVersion,
);

adminCharacterRouter.patch(
  '/:id/versions/:versionId',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_UPDATE),
  AdminCharacterController.updateVersionDraft,
);

adminCharacterRouter.post(
  '/:id/versions/:versionId/publish',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_PUBLISH),
  AdminCharacterController.publishVersion,
);

// Isolated Testing Playground
adminCharacterRouter.post(
  '/:id/versions/:versionId/test',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_TEST),
  AdminCharacterController.testInteraction,
);
