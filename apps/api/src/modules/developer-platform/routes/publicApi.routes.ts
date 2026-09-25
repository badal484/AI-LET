import { Router } from 'express';
import {
  publicApiGateMiddleware,
  requirePublicScope,
  publicApiErrorHandler,
} from '../middleware/PublicApiGateMiddleware.js';
import { PublicCharacterController } from '../controllers/publicCharacter.controller.js';
import { PublicConversationController } from '../controllers/publicConversation.controller.js';
import { PublicAgentTaskController } from '../controllers/publicAgentTask.controller.js';
import { DeveloperConsoleController } from '../controllers/developerConsole.controller.js';

export const publicApiRouter: Router = Router();

// Apply Public API Gateway middleware across all /v1 endpoints
publicApiRouter.use(publicApiGateMiddleware);

// =========================================================================
// CHARACTERS
// =========================================================================
publicApiRouter.get('/characters', PublicCharacterController.listCharacters);
publicApiRouter.get('/characters/:id', PublicCharacterController.getCharacter);
publicApiRouter.post('/characters', requirePublicScope('characters:write'), PublicCharacterController.createCharacter);
publicApiRouter.patch('/characters/:id', requirePublicScope('characters:write'), PublicCharacterController.updateCharacter);
publicApiRouter.post('/characters/:id/submit', requirePublicScope('characters:write'), PublicCharacterController.submitCharacterForReview);

// =========================================================================
// CONVERSATIONS & MESSAGES
// =========================================================================
publicApiRouter.post('/conversations', requirePublicScope('conversations:write'), PublicConversationController.createConversation);
publicApiRouter.get('/conversations', requirePublicScope('conversations:read'), PublicConversationController.listConversations);
publicApiRouter.get('/conversations/:id', requirePublicScope('conversations:read'), PublicConversationController.getConversation);
publicApiRouter.post('/conversations/:id/messages', requirePublicScope('messages:write'), PublicConversationController.createMessage);
publicApiRouter.get('/conversations/:id/messages', requirePublicScope('conversations:read'), PublicConversationController.listMessages);

// =========================================================================
// AGENT TASKS
// =========================================================================
publicApiRouter.post('/agent-tasks', requirePublicScope('agents:run'), PublicAgentTaskController.createTask);
publicApiRouter.get('/agent-tasks/:id', requirePublicScope('agents:run'), PublicAgentTaskController.getTask);
publicApiRouter.post('/agent-tasks/:id/cancel', requirePublicScope('agents:run'), PublicAgentTaskController.cancelTask);
publicApiRouter.post('/agent-tasks/:id/confirm', requirePublicScope('agents:run'), PublicAgentTaskController.confirmStep);

// =========================================================================
// USAGE
// =========================================================================
publicApiRouter.get('/usage/summary', requirePublicScope('usage:read'), (req, res, next) => {
  if (req.developerContext) {
    req.params['id'] = req.developerContext.projectId;
  }
  DeveloperConsoleController.getUsageSummary(req, res, next);
});

// Attach standard public error handler at router boundary
publicApiRouter.use(publicApiErrorHandler);
