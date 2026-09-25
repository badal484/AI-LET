import { Router } from 'express';
import { AdminAIController } from '../controllers/adminAI.controller.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminAIRouter: Router = Router();
const controller = new AdminAIController();

adminAIRouter.use(authenticateAdmin);

// AI Overview & Telemetry
adminAIRouter.get('/overview', requirePermission(ADMIN_PERMISSIONS.AI_READ), controller.getOverview);
adminAIRouter.get('/costs', requirePermission(ADMIN_PERMISSIONS.AI_COST_READ), controller.getCosts);

// Model Registry Management
adminAIRouter.get('/models', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_READ), controller.listModels);
adminAIRouter.post('/models', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_WRITE), controller.createModel);
adminAIRouter.patch('/models/:id', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_WRITE), controller.updateModel);

// Routing Policies
adminAIRouter.get('/routing-policies', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_READ), controller.listRoutingPolicies);
adminAIRouter.post('/routing-policies', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_WRITE), controller.updateRoutingPolicy);

// Prompt Registry Management
adminAIRouter.get('/prompts', requirePermission(ADMIN_PERMISSIONS.AI_PROMPTS_READ), controller.listPrompts);
adminAIRouter.post('/prompts', requirePermission(ADMIN_PERMISSIONS.AI_PROMPTS_WRITE), controller.createPrompt);
adminAIRouter.post('/prompts/:promptId/versions', requirePermission(ADMIN_PERMISSIONS.AI_PROMPTS_WRITE), controller.createPromptVersion);
adminAIRouter.post('/prompts/versions/:versionId/publish', requirePermission(ADMIN_PERMISSIONS.AI_PROMPTS_WRITE), controller.publishPromptVersion);

// Prompt Experiments
adminAIRouter.post('/prompts/experiments', requirePermission(ADMIN_PERMISSIONS.AI_PROMPTS_WRITE), controller.createPromptExperiment);

// Sandbox Playground & Production Replay
adminAIRouter.post('/playground', requirePermission(ADMIN_PERMISSIONS.AI_PLAYGROUND), controller.runPlayground);
adminAIRouter.post('/replay', requirePermission(ADMIN_PERMISSIONS.AI_PRODUCTION_REPLAY), controller.replayGeneration);

// Circuit Breaker Maintenance
adminAIRouter.post('/circuit-breaker/reset', requirePermission(ADMIN_PERMISSIONS.AI_MODELS_WRITE), controller.resetCircuitBreaker);
