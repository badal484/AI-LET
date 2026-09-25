import { Router } from 'express';
import { AdminDiscoveryController } from '../controllers/adminDiscovery.controller.js';
import {
  authenticateAdmin,
  requirePermission,
} from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminDiscoveryRouter: Router = Router();

// Require authenticated administrator for all discovery admin operations
adminDiscoveryRouter.use(authenticateAdmin);

// Categories
adminDiscoveryRouter.get(
  '/categories',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listCategories,
);
adminDiscoveryRouter.post(
  '/categories',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.createCategory,
);
adminDiscoveryRouter.put(
  '/categories/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateCategory,
);
adminDiscoveryRouter.delete(
  '/categories/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.deleteCategory,
);

// Tags
adminDiscoveryRouter.get(
  '/tags',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listTags,
);
adminDiscoveryRouter.post(
  '/tags',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.createTag,
);
adminDiscoveryRouter.put(
  '/tags/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateTag,
);
adminDiscoveryRouter.delete(
  '/tags/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.deleteTag,
);

// Collections
adminDiscoveryRouter.get(
  '/collections',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listCollections,
);
adminDiscoveryRouter.post(
  '/collections',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.createCollection,
);
adminDiscoveryRouter.put(
  '/collections/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateCollection,
);
adminDiscoveryRouter.delete(
  '/collections/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.deleteCollection,
);

// Home Sections Layout Config
adminDiscoveryRouter.get(
  '/home-sections',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listHomeSections,
);
adminDiscoveryRouter.put(
  '/home-sections/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateHomeSection,
);

// Character Discovery Metadata
adminDiscoveryRouter.get(
  '/characters/:characterId/config',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.getCharacterDiscoveryConfig,
);
adminDiscoveryRouter.put(
  '/characters/:characterId/config',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateCharacterDiscoveryConfig,
);

// Recommendations Simulator
adminDiscoveryRouter.post(
  '/recommendations/simulate',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.simulateRecommendations,
);

// Analytics
adminDiscoveryRouter.get(
  '/analytics',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.getAnalytics,
);

// -----------------------------------------------------------------------------
// Search Synonyms
// -----------------------------------------------------------------------------
adminDiscoveryRouter.get(
  '/synonyms',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listSynonyms,
);
adminDiscoveryRouter.post(
  '/synonyms',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.createSynonym,
);
adminDiscoveryRouter.put(
  '/synonyms/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateSynonym,
);
adminDiscoveryRouter.delete(
  '/synonyms/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.deleteSynonym,
);

// -----------------------------------------------------------------------------
// Ranking Studio & Simulator
// -----------------------------------------------------------------------------
adminDiscoveryRouter.get(
  '/ranking-configs',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.listRankingConfigs,
);
adminDiscoveryRouter.post(
  '/ranking-configs',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.createRankingConfig,
);
adminDiscoveryRouter.put(
  '/ranking-configs/:id',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.updateRankingConfig,
);
adminDiscoveryRouter.post(
  '/ranking-configs/:version/publish',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.publishRankingConfig,
);
adminDiscoveryRouter.post(
  '/ranking-configs/simulate',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.simulateRanking,
);

// -----------------------------------------------------------------------------
// Search Index Management & Health
// -----------------------------------------------------------------------------
adminDiscoveryRouter.get(
  '/index/health',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.getIndexHealth,
);
adminDiscoveryRouter.post(
  '/index/reindex',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_WRITE),
  AdminDiscoveryController.triggerReindex,
);

// -----------------------------------------------------------------------------
// Search Quality Metrics
// -----------------------------------------------------------------------------
adminDiscoveryRouter.get(
  '/search-quality',
  requirePermission(ADMIN_PERMISSIONS.CHARACTERS_READ),
  AdminDiscoveryController.getSearchQuality,
);

