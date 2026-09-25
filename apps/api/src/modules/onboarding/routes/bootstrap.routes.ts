import { Router } from 'express';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { BootstrapController } from '../controllers/bootstrap.controller.js';

const router: Router = Router();

router.get('/', authenticateUser, BootstrapController.getBootstrap);

export default router;
