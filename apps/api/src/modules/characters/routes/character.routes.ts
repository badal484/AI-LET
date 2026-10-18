import { markRomanceForTeens } from '../../users/ageGate.js';
import { Router } from 'express';
import { CharacterController } from '../controllers/character.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const characterRouter: Router = Router();
// Under-18s see romance characters marked ageRestricted (blurred, "18+ only") — users/ageGate.ts.
characterRouter.use(markRomanceForTeens);

// Public character discovery
characterRouter.get('/', CharacterController.listPublicCharacters);
characterRouter.post('/custom', authenticateUser, CharacterController.createCustomCharacter);
characterRouter.get('/:idOrSlug', CharacterController.getPublicCharacter);
