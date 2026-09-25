import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';

export const adminAnalyticsRouter: Router = Router();

adminAnalyticsRouter.use(authenticateAdmin);

// Overview & Executive Metrics
adminAnalyticsRouter.get('/overview', AnalyticsController.getOverview);

// Growth, Funnels & Retention
adminAnalyticsRouter.get('/growth', AnalyticsController.getGrowth);
adminAnalyticsRouter.get('/retention', AnalyticsController.getRetention);

// AI Economics & Pricing
adminAnalyticsRouter.get('/ai-economics', AnalyticsController.getAIEconomics);
adminAnalyticsRouter.get('/pricing', AnalyticsController.listPricing);
adminAnalyticsRouter.post('/pricing', AnalyticsController.createPricing);

// Character & Creator Performance
adminAnalyticsRouter.get('/characters', AnalyticsController.getCharacterAnalytics);
adminAnalyticsRouter.get('/creators', AnalyticsController.getCreatorAnalytics);

// Experiments
adminAnalyticsRouter.get('/experiments', AnalyticsController.getExperiments);
adminAnalyticsRouter.post('/experiments', AnalyticsController.createExperiment);
adminAnalyticsRouter.patch('/experiments/:id', AnalyticsController.updateExperiment);
adminAnalyticsRouter.get('/experiments/:id/analysis', AnalyticsController.getExperimentAnalysis);

// Alerts & Anomalies
adminAnalyticsRouter.get('/alerts', AnalyticsController.getAlerts);
adminAnalyticsRouter.patch('/alerts/:id/acknowledge', AnalyticsController.acknowledgeAlert);

// Manual Aggregation Trigger
adminAnalyticsRouter.post('/aggregate/trigger', AnalyticsController.triggerAggregation);
