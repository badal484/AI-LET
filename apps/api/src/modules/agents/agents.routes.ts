import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { AgentsController } from './agents.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';

export const agentsRouter: Router = Router();
const controller = new AgentsController();

// Authenticated user agent tasks
agentsRouter.use(authenticateUser);

// Agent Task CRUD & Confirmation
agentsRouter.post('/tasks', asyncHandler(controller.createTask));
agentsRouter.get('/tasks', asyncHandler(controller.listTasks));
agentsRouter.get('/tasks/:taskId', asyncHandler(controller.getTask));
agentsRouter.post('/tasks/:taskId/confirm', asyncHandler(controller.confirmStep));
agentsRouter.post('/tasks/:taskId/cancel', asyncHandler(controller.cancelTask));

// Skills Catalog & Assignments
agentsRouter.get('/skills', asyncHandler(controller.listSkills));
agentsRouter.get('/skills/:slug', asyncHandler(controller.getSkill));

// Experiences Runtime
agentsRouter.get('/experiences', asyncHandler(controller.listExperiences));
agentsRouter.get('/experiences/:slug', asyncHandler(controller.getExperience));
agentsRouter.post('/experiences/:slug/start', asyncHandler(controller.startExperience));

// User Goals
agentsRouter.get('/goals', asyncHandler(controller.listGoals));
agentsRouter.get('/goals/active', asyncHandler(controller.getActiveGoal));
agentsRouter.post('/goals', asyncHandler(controller.createGoal));
agentsRouter.post('/goals/:goalId/pause', asyncHandler(controller.pauseGoal));
agentsRouter.post('/goals/:goalId/resume', asyncHandler(controller.resumeGoal));
agentsRouter.post('/goals/:goalId/cancel', asyncHandler(controller.cancelGoal));

// Generation Audit & Explainability
agentsRouter.get('/generations/:messageId/explain', asyncHandler(controller.explainGeneration));

// User Tool Consent Management
agentsRouter.get('/consents', asyncHandler(controller.getConsents));
agentsRouter.post('/consents', asyncHandler(controller.grantConsent));
agentsRouter.delete('/consents/:capabilitySlug', asyncHandler(controller.revokeConsent));

// Multimodal Upload Endpoint
agentsRouter.post('/multimodal/upload', asyncHandler(controller.uploadMultimodal));
