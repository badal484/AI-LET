import { Router } from 'express';
import { DiscoveryController } from '../controllers/discovery.controller.js';
import { SearchController } from '../controllers/search.controller.js';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';

export const discoveryRouter: Router = Router();

// 1. Home Feed & Lists
discoveryRouter.get('/home', optionalAuth, DiscoveryController.getHomeFeed);
discoveryRouter.get('/trending', optionalAuth, DiscoveryController.getTrending);
discoveryRouter.get('/new', optionalAuth, DiscoveryController.getNew);
discoveryRouter.get('/similar/:characterId', optionalAuth, DiscoveryController.getSimilar);

// 2. Search characters (Alias for backwards compatibility with existing clients)
discoveryRouter.get('/search', optionalAuth, SearchController.search);

// 3. Public categories & collections
discoveryRouter.get('/categories', optionalAuth, DiscoveryController.getCategories);
discoveryRouter.get('/categories/:slug', optionalAuth, DiscoveryController.getCategoryBySlug);
discoveryRouter.get('/collections', optionalAuth, DiscoveryController.getCollections);
discoveryRouter.get('/collections/:slug', optionalAuth, DiscoveryController.getCollectionBySlug);

// 4. Character Public Detailed Profile (Sanitized)
discoveryRouter.get('/characters/:idOrSlug', optionalAuth, DiscoveryController.getCharacterProfile);

// 5. User Controls & Preferences
discoveryRouter.post('/controls/negative-signal', authenticateUser, DiscoveryController.recordNegativeSignal);
discoveryRouter.post('/reset-personalization', authenticateUser, DiscoveryController.resetPersonalization);

// 6. Batch Discovery Event Ingestion
discoveryRouter.post('/events', optionalAuth, DiscoveryController.recordEvents);

// 7. Authenticated Favorites & Preferences
discoveryRouter.post('/favorites/:characterId', authenticateUser, DiscoveryController.addFavorite);
discoveryRouter.delete('/favorites/:characterId', authenticateUser, DiscoveryController.removeFavorite);
discoveryRouter.get('/favorites', authenticateUser, DiscoveryController.listFavorites);
discoveryRouter.get('/preferences', authenticateUser, DiscoveryController.getPreferences);
discoveryRouter.put('/preferences', authenticateUser, DiscoveryController.updatePreferences);

