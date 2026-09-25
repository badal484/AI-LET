import type { Request, Response, NextFunction } from 'express';
import { OAuthService } from '../services/OAuthService.js';
import { ValidationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';

export class OAuthController {
  /**
   * GET /oauth/authorize
   * Validates OAuth authorization request and returns application details for consent UI.
   */
  public static async getAuthorizeDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.query['client_id'] as string;
      const redirectUri = req.query['redirect_uri'] as string;
      const responseType = req.query['response_type'] as string;
      const scope = req.query['scope'] as string | undefined;
      const state = req.query['state'] as string | undefined;
      const codeChallenge = req.query['code_challenge'] as string | undefined;
      const codeChallengeMethod = req.query['code_challenge_method'] as string | undefined;

      if (!clientId || !redirectUri || responseType !== 'code') {
        throw new ValidationError("Missing required parameters: 'client_id', 'redirect_uri', 'response_type=code'");
      }

      const app = await OAuthService.getInstance().getOAuthApplicationByClientId(clientId);
      OAuthService.getInstance().validateRedirectUri(app, redirectUri);

      const requestedScopes = scope ? scope.split(' ') : (app.allowedScopes as string[]);

      res.status(200).json({
        data: {
          client_id: app.clientId,
          application_name: app.name,
          client_type: app.clientType,
          logo_url: app.logoUrl,
          privacy_policy_url: app.privacyPolicyUrl,
          terms_url: app.termsUrl,
          redirect_uri: redirectUri,
          requested_scopes: requestedScopes,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /oauth/authorize/consent
   * Submits user approval or rejection for the OAuth grant.
   */
  public static async submitConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new PermissionDeniedError('User authentication required');
      }

      const {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        approved,
      } = req.body;

      if (!clientId || !redirectUri) {
        throw new ValidationError('client_id and redirect_uri are required');
      }

      if (approved === false) {
        // User denied authorization
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('error', 'access_denied');
        redirectUrl.searchParams.set('error_description', 'The user denied the authorization request');
        if (state) redirectUrl.searchParams.set('state', state);

        res.status(200).json({
          data: {
            redirect_to: redirectUrl.toString(),
            approved: false,
          },
        });
        return;
      }

      const app = await OAuthService.getInstance().getOAuthApplicationByClientId(clientId);
      OAuthService.getInstance().validateRedirectUri(app, redirectUri);

      const requestedScopes = scope ? (Array.isArray(scope) ? scope : scope.split(' ')) : (app.allowedScopes as string[]);

      // Record user consent grant
      await OAuthService.getInstance().recordUserConsent(app.id, userId, requestedScopes);

      // Generate authorization code
      const code = OAuthService.getInstance().generateAuthorizationCode({
        applicationId: app.id,
        clientId: app.clientId,
        userId,
        redirectUri,
        scopes: requestedScopes,
        codeChallenge,
        codeChallengeMethod,
      });

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      res.status(200).json({
        data: {
          code,
          redirect_to: redirectUrl.toString(),
          approved: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /oauth/token
   * Token endpoint supporting 'authorization_code' and 'refresh_token' grant types.
   */
  public static async exchangeToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const grantType = req.body.grant_type;
      const clientId = req.body.client_id || (req.headers['x-client-id'] as string);
      const clientSecret = req.body.client_secret || (req.headers['x-client-secret'] as string);
      const code = req.body.code;
      const redirectUri = req.body.redirect_uri;
      const codeVerifier = req.body.code_verifier;
      const refreshToken = req.body.refresh_token;

      if (!grantType) {
        throw new ValidationError("Missing 'grant_type'");
      }

      const oauthService = OAuthService.getInstance();

      if (grantType === 'authorization_code') {
        if (!clientId || !code || !redirectUri) {
          throw new ValidationError("Missing required parameters for 'authorization_code' grant");
        }

        const tokenResult = await oauthService.exchangeAuthorizationCode({
          clientId,
          clientSecret,
          code,
          redirectUri,
          codeVerifier,
        });

        res.status(200).json(tokenResult);
      } else if (grantType === 'refresh_token') {
        if (!clientId || !refreshToken) {
          throw new ValidationError("Missing required parameters for 'refresh_token' grant");
        }

        const tokenResult = await oauthService.refreshAccessToken({
          clientId,
          clientSecret,
          refreshToken,
        });

        res.status(200).json(tokenResult);
      } else {
        throw new ValidationError(`Unsupported grant_type '${grantType}'`);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /oauth/revoke
   * Revokes an active token.
   */
  public static async revokeToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        throw new ValidationError('token parameter is required');
      }

      await OAuthService.getInstance().revokeToken(token);
      res.status(200).json({ message: 'Token revoked successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /oauth/user-consents
   * Lists applications authorized by the current user.
   */
  public static async listUserConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new PermissionDeniedError('User authentication required');
      }

      const consents = await OAuthService.getInstance().listUserConsents(userId);
      res.status(200).json({ data: consents });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /oauth/user-consents/:applicationId
   * Revokes user consent for an application.
   */
  public static async revokeUserConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new PermissionDeniedError('User authentication required');
      }

      const applicationId = req.params['applicationId'] as string;
      await OAuthService.getInstance().revokeUserConsent(applicationId, userId);
      res.status(200).json({ message: 'Application authorization revoked successfully' });
    } catch (error) {
      next(error);
    }
  }
}
