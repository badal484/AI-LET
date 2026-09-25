import { Router } from 'express';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { DeveloperConsoleController } from '../controllers/developerConsole.controller.js';

export const developerConsoleRouter: Router = Router();

// Developer console endpoints require authenticated platform user
developerConsoleRouter.use(authenticateUser);

// =========================================================================
// PROJECTS
// =========================================================================
developerConsoleRouter.post('/projects', DeveloperConsoleController.createProject);
developerConsoleRouter.get('/projects', DeveloperConsoleController.listProjects);
developerConsoleRouter.get('/projects/:id', DeveloperConsoleController.getProject);
developerConsoleRouter.delete('/projects/:id', DeveloperConsoleController.deleteProject);

// =========================================================================
// API KEYS
// =========================================================================
developerConsoleRouter.post('/projects/:id/keys', DeveloperConsoleController.createApiKey);
developerConsoleRouter.get('/projects/:id/keys', DeveloperConsoleController.listApiKeys);
developerConsoleRouter.delete('/projects/:id/keys/:keyId', DeveloperConsoleController.revokeApiKey);
developerConsoleRouter.post('/projects/:id/keys/:keyId/rotate', DeveloperConsoleController.rotateApiKey);

// =========================================================================
// OAUTH APPS
// =========================================================================
developerConsoleRouter.post('/projects/:id/oauth-apps', DeveloperConsoleController.createOAuthApp);
developerConsoleRouter.get('/projects/:id/oauth-apps', DeveloperConsoleController.listOAuthApps);

// =========================================================================
// WEBHOOKS
// =========================================================================
developerConsoleRouter.post('/projects/:id/webhooks', DeveloperConsoleController.createWebhook);
developerConsoleRouter.get('/projects/:id/webhooks', DeveloperConsoleController.listWebhooks);
developerConsoleRouter.patch('/projects/:id/webhooks/:endpointId', DeveloperConsoleController.updateWebhook);
developerConsoleRouter.delete('/projects/:id/webhooks/:endpointId', DeveloperConsoleController.deleteWebhook);
developerConsoleRouter.post('/projects/:id/webhooks/:endpointId/ping', DeveloperConsoleController.pingWebhook);

// Webhook deliveries & DLQ
developerConsoleRouter.get('/projects/:id/webhooks-deliveries', DeveloperConsoleController.listDeliveries);
developerConsoleRouter.post('/projects/:id/webhooks-deliveries/:deliveryId/replay', DeveloperConsoleController.replayDelivery);

// =========================================================================
// USAGE & BUDGET
// =========================================================================
developerConsoleRouter.get('/projects/:id/usage/summary', DeveloperConsoleController.getUsageSummary);
developerConsoleRouter.get('/projects/:id/usage/records', DeveloperConsoleController.getUsageRecords);
developerConsoleRouter.get('/projects/:id/usage/budget', DeveloperConsoleController.getBudgetStatus);

// =========================================================================
// EMBEDS
// =========================================================================
developerConsoleRouter.post('/projects/:id/embeds', DeveloperConsoleController.upsertEmbed);
developerConsoleRouter.get('/projects/:id/embeds/:characterId', DeveloperConsoleController.getEmbed);
developerConsoleRouter.post('/projects/:id/embeds/:characterId/tokens', DeveloperConsoleController.createEmbedSessionToken);
