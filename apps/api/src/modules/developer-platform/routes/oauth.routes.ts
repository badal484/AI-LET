import { Router } from 'express';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { OAuthController } from '../controllers/oauth.controller.js';

export const oauthRouter: Router = Router();

// OAuth Authorization & Consent Flow
oauthRouter.get('/authorize', OAuthController.getAuthorizeDetails);
oauthRouter.post('/authorize/consent', authenticateUser, OAuthController.submitConsent);

// Token Exchange & Revocation
oauthRouter.post('/token', OAuthController.exchangeToken);
oauthRouter.post('/revoke', OAuthController.revokeToken);

// User Granted Applications Management
oauthRouter.get('/user-consents', authenticateUser, OAuthController.listUserConsents);
oauthRouter.delete('/user-consents/:applicationId', authenticateUser, OAuthController.revokeUserConsent);
