import { Router } from 'express';
import { PrivacyController } from '../controllers/PrivacyController.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const privacyRouter: Router = Router();

privacyRouter.use(authenticateUser);

// Privacy Preferences
privacyRouter.get('/settings', PrivacyController.getSettings);
privacyRouter.patch('/settings', PrivacyController.updateSettings);

// Data Export & Account Deletion
privacyRouter.post('/export', PrivacyController.requestExport);
privacyRouter.get('/export/:id', PrivacyController.getExportStatus);
privacyRouter.post('/delete-account', PrivacyController.requestDeletion);
privacyRouter.delete('/delete-account', PrivacyController.cancelDeletion);
privacyRouter.post('/purge-memories', PrivacyController.purgeMemories);
