import { Router } from 'express';
import { SafetyController } from '../controllers/SafetyController.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';

export const adminSafetyRouter: Router = Router();

adminSafetyRouter.use(authenticateAdmin);

// Policies
adminSafetyRouter.get('/policies', SafetyController.getActivePolicy);
adminSafetyRouter.post('/policies', SafetyController.createPolicyVersion);

// Audit Evaluation Logs
adminSafetyRouter.get('/evaluations', SafetyController.listEvaluationLogs);

// Enforcement & Account Restrictions
adminSafetyRouter.post('/restrictions', SafetyController.issueRestriction);
adminSafetyRouter.delete('/restrictions/:id', SafetyController.revokeRestriction);
