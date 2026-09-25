import { Router } from 'express';
import { VoiceController } from '../controllers/voice.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const voiceRoutes: Router = Router();

// All user voice endpoints require user authentication
voiceRoutes.use(authenticateUser);

voiceRoutes.post('/sessions', VoiceController.createSession);
voiceRoutes.get('/sessions/:id', VoiceController.getSession);
voiceRoutes.post('/sessions/:id/end', VoiceController.endSession);
voiceRoutes.get('/preferences', VoiceController.getPreferences);
voiceRoutes.put('/preferences', VoiceController.updatePreferences);
