import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import { AuthenticationError, PermissionDeniedError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import type {
  OAuthApplicationItem,
  OAuthConsentItem,
  OAuthTokenResult,
} from '@ai-companion/types';

// In-memory fallback cache for auth codes when Redis is offline
const authCodeFallbackMap = new Map<string, { data: string; expiresAt: number }>();

export interface CreateOAuthAppInput {
  projectId: string;
  userId: string;
  name: string;
  redirectUris: string[];
  allowedScopes?: string[];
  isPublicClient?: boolean;
  clientType?: string;
  logoUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

export interface AuthorizeCodeInput {
  applicationId?: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes?: string[];
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain' | string;
}

export interface TokenExchangeInput {
  grantType?: 'authorization_code' | 'refresh_token';
  grant_type?: string;
  clientId: string;
  clientSecret?: string;
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  refreshToken?: string;
}

export class OAuthService {
  private static instance: OAuthService;

  private constructor() {}

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  // =========================================================================
  // APP REGISTRATION
  // =========================================================================

  /**
   * Registers a new OAuth 2.0 application.
   */
  public async createOAuthApplication(input: CreateOAuthAppInput): Promise<OAuthApplicationItem & { clientSecret?: string }> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Application name is required.');
    }
    if (!input.redirectUris || input.redirectUris.length === 0) {
      throw new ValidationError('At least one redirect URI is required.');
    }

    // Verify project ownership
    const project = await prisma.developerProject.findFirst({
      where: { id: input.projectId, userId: input.userId },
    });
    if (!project) {
      throw new PermissionDeniedError('Project not found or access denied');
    }

    const clientId = `app_${crypto.randomBytes(16).toString('hex')}`;
    let rawSecret: string | undefined;
    let clientSecretHash: string | null = null;

    if (!input.isPublicClient) {
      rawSecret = `sec_${crypto.randomBytes(32).toString('hex')}`;
      clientSecretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    }

    const created = await prisma.oAuthApplication.create({
      data: {
        projectId: input.projectId,
        name: input.name.trim(),
        clientId,
        clientSecretHash,
        redirectUris: input.redirectUris as any,
        allowedScopes: (input.allowedScopes || ['profile:read', 'characters:read', 'conversations:write']) as any,
        isPublicClient: input.isPublicClient ?? false,
        clientType: input.clientType || 'WEB',
        logoUrl: input.logoUrl || null,
        privacyPolicyUrl: input.privacyPolicyUrl || null,
        termsUrl: input.termsUrl || null,
      },
    });

    logger.info(`OAuthService: registered OAuth app '${created.id}' (clientId: ${clientId})`);

    return {
      ...this.mapApp(created),
      clientSecret: rawSecret,
    };
  }

  public async createOAuthApp(input: CreateOAuthAppInput): Promise<{ app: OAuthApplicationItem; clientSecret?: string }> {
    const res = await this.createOAuthApplication(input);
    return {
      app: res,
      clientSecret: res.clientSecret,
    };
  }

  /**
   * Lists OAuth applications for a project.
   */
  public async listOAuthApplications(projectId: string, userId: string): Promise<OAuthApplicationItem[]> {
    const project = await prisma.developerProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new PermissionDeniedError('Project not found or access denied');
    }

    const apps = await prisma.oAuthApplication.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((a) => this.mapApp(a));
  }

  /**
   * Retrieves an OAuth app by clientId.
   */
  public async getOAuthApplicationByClientId(clientId: string): Promise<OAuthApplicationItem> {
    const app = await prisma.oAuthApplication.findUnique({
      where: { clientId },
    });
    if (!app) {
      throw new NotFoundError(`OAuth application '${clientId}' not found.`);
    }
    return this.mapApp(app);
  }

  public async getAppByClientId(clientId: string): Promise<OAuthApplicationItem> {
    return this.getOAuthApplicationByClientId(clientId);
  }

  /**
   * Validates that a redirect URI matches one of the app's registered redirect URIs.
   */
  public validateRedirectUri(app: OAuthApplicationItem, uri: string): void {
    if (!app.redirectUris.includes(uri)) {
      throw new ValidationError(`Redirect URI '${uri}' is not registered for this application.`);
    }
  }

  // =========================================================================
  // AUTHORIZATION & CONSENT
  // =========================================================================

  /**
   * Records or updates user consent for an application.
   */
  public async recordUserConsent(applicationId: string, userId: string, grantedScopes: string[]): Promise<OAuthConsentItem> {
    const consent = await prisma.oAuthConsent.upsert({
      where: {
        applicationId_userId: {
          applicationId,
          userId,
        },
      },
      update: {
        grantedScopes: grantedScopes as any,
        revokedAt: null,
        consentedAt: new Date(),
      },
      create: {
        applicationId,
        userId,
        grantedScopes: grantedScopes as any,
      },
    });

    return {
      id: consent.id,
      applicationId: consent.applicationId,
      userId: consent.userId,
      grantedScopes: (consent.grantedScopes as string[]) || [],
      consentedAt: consent.consentedAt.toISOString(),
      revokedAt: consent.revokedAt ? consent.revokedAt.toISOString() : null,
    };
  }

  public async recordConsent(userId: string, clientId: string, grantedScopes: string[]): Promise<OAuthConsentItem> {
    const app = await this.getOAuthApplicationByClientId(clientId);
    return this.recordUserConsent(app.id, userId, grantedScopes);
  }

  /**
   * Lists user-granted consents.
   */
  public async listUserConsents(userId: string): Promise<OAuthConsentItem[]> {
    const consents = await prisma.oAuthConsent.findMany({
      where: { userId, revokedAt: null },
      include: { application: true },
      orderBy: { consentedAt: 'desc' },
    });

    return consents.map((c) => ({
      id: c.id,
      applicationId: c.applicationId,
      userId: c.userId,
      grantedScopes: (c.grantedScopes as string[]) || [],
      consentedAt: c.consentedAt.toISOString(),
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
    }));
  }

  /**
   * Revokes user consent for an application and invalidates active tokens.
   */
  public async revokeUserConsent(applicationId: string, userId: string): Promise<void> {
    await prisma.oAuthConsent.updateMany({
      where: { applicationId, userId },
      data: { revokedAt: new Date() },
    });

    await prisma.oAuthToken.updateMany({
      where: { applicationId, userId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Generates a single-use authorization code with PKCE challenge binding (TTL: 5 minutes).
   */
  public generateAuthorizationCode(input: AuthorizeCodeInput): string {
    const code = `dpc_${crypto.randomBytes(24).toString('hex')}`;
    const codeKey = `oauth:code:${code}`;

    const codePayload = {
      applicationId: input.applicationId,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scopes: input.scopes || (input.scope ? input.scope.split(' ') : ['profile:read']),
      codeChallenge: input.codeChallenge || null,
      codeChallengeMethod: input.codeChallengeMethod || 'S256',
    };

    const serialized = JSON.stringify(codePayload);

    // Save in Redis if available, or in fallback map
    if (redis.status === 'ready') {
      redis.set(codeKey, serialized, 'EX', 300).catch(() => {});
    }
    authCodeFallbackMap.set(code, { data: serialized, expiresAt: Date.now() + 300000 });

    logger.info(`OAuthService: issued auth code for user '${input.userId}' to app '${input.clientId}'`);
    return code;
  }

  // =========================================================================
  // TOKEN EXCHANGE & REFRESH
  // =========================================================================

  /**
   * Exchanges an authorization code for OAuth tokens.
   */
  public async exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret?: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenResult> {
    const app = await prisma.oAuthApplication.findUnique({
      where: { clientId: input.clientId },
    });

    if (!app) {
      throw new AuthenticationError('Invalid client_id.');
    }

    // Confidential client secret validation
    if (!app.isPublicClient) {
      if (!input.clientSecret) {
        throw new AuthenticationError('client_secret is required for confidential clients.');
      }
      const hash = crypto.createHash('sha256').update(input.clientSecret).digest('hex');
      if (hash !== app.clientSecretHash) {
        throw new AuthenticationError('Invalid client_secret.');
      }
    }

    const codeKey = `oauth:code:${input.code}`;
    let codeDataStr: string | null = null;

    if (redis.status === 'ready') {
      codeDataStr = await redis.get(codeKey);
      await redis.del(codeKey);
    }

    if (!codeDataStr) {
      const fallback = authCodeFallbackMap.get(input.code);
      if (fallback && fallback.expiresAt > Date.now()) {
        codeDataStr = fallback.data;
        authCodeFallbackMap.delete(input.code);
      }
    }

    if (!codeDataStr) {
      throw new AuthenticationError('Invalid, expired, or previously used authorization code.');
    }

    const codeData = JSON.parse(codeDataStr);

    if (codeData.clientId !== input.clientId) {
      throw new AuthenticationError('Authorization code was issued to a different client.');
    }

    if (input.redirectUri && codeData.redirectUri !== input.redirectUri) {
      throw new ValidationError('redirect_uri mismatch.');
    }

    // PKCE verification
    if (codeData.codeChallenge) {
      if (!input.codeVerifier) {
        throw new AuthenticationError('code_verifier is required for PKCE-enabled request.');
      }

      let calculatedChallenge: string;
      if (codeData.codeChallengeMethod === 'S256') {
        calculatedChallenge = crypto
          .createHash('sha256')
          .update(input.codeVerifier)
          .digest('base64url');
      } else {
        calculatedChallenge = input.codeVerifier;
      }

      if (calculatedChallenge !== codeData.codeChallenge) {
        throw new AuthenticationError('PKCE code_verifier challenge verification failed.');
      }
    }

    return this.mintTokens(app.id, codeData.userId, codeData.scopes || ['profile:read']);
  }

  /**
   * Refreshes an access token using a refresh token with rotation.
   */
  public async refreshAccessToken(input: {
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
  }): Promise<OAuthTokenResult> {
    const app = await prisma.oAuthApplication.findUnique({
      where: { clientId: input.clientId },
    });

    if (!app) {
      throw new AuthenticationError('Invalid client_id.');
    }

    const refHash = crypto.createHash('sha256').update(input.refreshToken).digest('hex');
    const token = await prisma.oAuthToken.findUnique({
      where: { refreshTokenHash: refHash },
    });

    if (!token || token.applicationId !== app.id || token.revokedAt) {
      throw new AuthenticationError('Invalid or revoked refresh token.');
    }

    // Invalidate old refresh token (refresh token rotation)
    await prisma.oAuthToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return this.mintTokens(app.id, token.userId, (token.scopes as string[]) || []);
  }

  public async exchangeToken(input: TokenExchangeInput): Promise<OAuthTokenResult> {
    const grant = input.grantType || input.grant_type;
    if (grant === 'authorization_code') {
      if (!input.code || !input.redirectUri) {
        throw new ValidationError("Missing code or redirectUri for 'authorization_code'");
      }
      return this.exchangeAuthorizationCode({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        code: input.code,
        redirectUri: input.redirectUri,
        codeVerifier: input.codeVerifier,
      });
    }

    if (grant === 'refresh_token') {
      if (!input.refreshToken) {
        throw new ValidationError("Missing refreshToken for 'refresh_token'");
      }
      return this.refreshAccessToken({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        refreshToken: input.refreshToken,
      });
    }

    throw new ValidationError(`Unsupported grant_type '${grant}'`);
  }

  /**
   * Revokes an active token.
   */
  public async revokeToken(tokenString: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(tokenString).digest('hex');

    await prisma.oAuthToken.updateMany({
      where: {
        OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }],
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Verifies an OAuth access token and resolves userId, projectId, and scopes.
   */
  public async verifyAccessToken(accessToken: string): Promise<{
    userId: string;
    projectId: string;
    clientId: string;
    scopes: string[];
  }> {
    const hash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const token = await prisma.oAuthToken.findUnique({
      where: { accessTokenHash: hash },
      include: { application: true },
    });

    if (!token || token.revokedAt) {
      throw new AuthenticationError('Invalid or revoked OAuth access token.');
    }

    if (token.expiresAt.getTime() < Date.now()) {
      throw new AuthenticationError('OAuth access token has expired.');
    }

    return {
      userId: token.userId,
      projectId: token.application.projectId,
      clientId: token.application.clientId,
      scopes: (token.scopes as string[]) || [],
    };
  }

  public async authenticateAccessToken(accessToken: string): Promise<{
    userId: string;
    applicationId: string;
    scopes: string[];
  }> {
    const res = await this.verifyAccessToken(accessToken);
    return {
      userId: res.userId,
      applicationId: res.clientId,
      scopes: res.scopes,
    };
  }

  private async mintTokens(applicationId: string, userId: string, scopes: string[]): Promise<OAuthTokenResult> {
    const rawAccess = `dpt_${crypto.randomBytes(32).toString('hex')}`;
    const rawRefresh = `dpr_${crypto.randomBytes(32).toString('hex')}`;

    const accessHash = crypto.createHash('sha256').update(rawAccess).digest('hex');
    const refreshHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    const expiresIn = 3600; // 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.oAuthToken.create({
      data: {
        applicationId,
        userId,
        accessTokenHash: accessHash,
        refreshTokenHash: refreshHash,
        scopes: scopes as any,
        expiresAt,
      },
    });

    return {
      access_token: rawAccess,
      refresh_token: rawRefresh,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: scopes.join(' '),
      accessToken: rawAccess,
      refreshToken: rawRefresh,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  private mapApp(record: any): OAuthApplicationItem {
    return {
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      clientId: record.clientId,
      redirectUris: (record.redirectUris as string[]) || [],
      allowedScopes: (record.allowedScopes as string[]) || [],
      isPublicClient: record.isPublicClient,
      clientType: record.clientType,
      logoUrl: record.logoUrl,
      privacyPolicyUrl: record.privacyPolicyUrl,
      termsUrl: record.termsUrl,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
