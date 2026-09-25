import { Router } from 'express';
import { RelationshipController } from '../controllers/relationship.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const relationshipRouter: Router = Router();

// All relationship endpoints require active user authentication
relationshipRouter.use(authenticateUser);

// User Personalization & Relationship Settings
relationshipRouter.get('/settings/personalization', RelationshipController.getUserSettings);
relationshipRouter.patch('/settings/personalization', RelationshipController.updateUserSettings);

// User Relationship List & Details
relationshipRouter.get('/', RelationshipController.listRelationships);
relationshipRouter.get('/:characterId', RelationshipController.getRelationship);
relationshipRouter.post('/:characterId/reset', RelationshipController.resetRelationship);
