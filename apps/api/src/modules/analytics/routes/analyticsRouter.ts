import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController.js';
import { optionalAuth } from '../../../shared/middleware/auth.middleware.js';

export const analyticsRouter: Router = Router();

// Ingest batch events from client SDK (handles both authenticated & unauthenticated visitors)
analyticsRouter.post('/events', optionalAuth, AnalyticsController.ingestEvents);
