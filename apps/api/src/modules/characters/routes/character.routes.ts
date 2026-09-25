import { Router } from 'express';
import { CharacterController } from '../controllers/character.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const characterRouter: Router = Router();

// Public character discovery
characterRouter.get('/', CharacterController.listPublicCharacters);
characterRouter.post('/custom', authenticateUser, CharacterController.createCustomCharacter);
characterRouter.get('/:idOrSlug', CharacterController.getPublicCharacter);
