import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { updateProfileSchema, registerDeviceSchema } from '@ai-companion/validation';

const router = Router();

// All user routes require authenticated principal
router.use(authenticateUser);

router.get('/profile', UsersController.getProfile);
router.patch('/profile', validateRequest(updateProfileSchema), UsersController.updateProfile);

router.get('/devices', UsersController.getDevices);
router.post('/devices', validateRequest(registerDeviceSchema), UsersController.registerDevice);
router.delete('/devices/:deviceId', UsersController.revokeDevice);

router.delete('/me', UsersController.deleteAccount);

export const usersRouter: Router = router;
