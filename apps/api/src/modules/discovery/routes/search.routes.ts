import { Router } from 'express';
import { SearchController } from '../controllers/search.controller.js';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';

export const searchRouter: Router = Router();

// Public / Guest / Optional Auth Search & Autocomplete
searchRouter.get('/characters', optionalAuth, SearchController.search);
searchRouter.get('/suggestions', optionalAuth, SearchController.getSuggestions);

// Authenticated User Search History
searchRouter.get('/recent', authenticateUser, SearchController.getRecentSearches);
searchRouter.delete('/recent/:id', authenticateUser, SearchController.deleteRecentSearch);
searchRouter.delete('/recent', authenticateUser, SearchController.clearRecentSearches);

// Search Feedback & Quality Tracking
searchRouter.post('/feedback', optionalAuth, SearchController.recordFeedback);
