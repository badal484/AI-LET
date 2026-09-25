import { Router } from 'express';
import { CharacterController } from '../controllers/character.controller.js';

export const characterRouter: Router = Router();

// Public character discovery
characterRouter.get('/', CharacterController.listPublicCharacters);
characterRouter.get('/:idOrSlug', CharacterController.getPublicCharacter);
