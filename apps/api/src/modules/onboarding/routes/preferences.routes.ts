import { Router } from 'express';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { PreferencesController } from '../controllers/preferences.controller.js';

const router: Router = Router();

router.get('/', authenticateUser, PreferencesController.getPreferences);
router.patch('/', authenticateUser, PreferencesController.updatePreferences);
router.post('/reset', authenticateUser, PreferencesController.resetPreferences);

export default router;
