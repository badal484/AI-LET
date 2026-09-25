import { Router } from 'express';
import { AdminEvaluationController } from '../controllers/adminEvaluation.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminEvaluationRouter: Router = Router();
const controller = new AdminEvaluationController();

adminEvaluationRouter.use(authenticateAdmin);

// Datasets and Test Cases
adminEvaluationRouter.get('/datasets', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.listDatasets);
adminEvaluationRouter.post('/datasets', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.createDataset);
adminEvaluationRouter.post('/datasets/:datasetId/test-cases', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.createTestCase);

// Run Evaluations
adminEvaluationRouter.post('/run', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.runEvaluation);
adminEvaluationRouter.get('/runs/:runId', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.getRunDetails);
adminEvaluationRouter.get('/runs/:runId/compare', requirePermission(ADMIN_PERMISSIONS.AI_EVALUATE), controller.compareRuns);
