import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { OAuthService } from '../../src/modules/developer-platform/services/OAuthService.js';
import { AuthenticationError, ValidationError } from '../../src/shared/errors/AppError.js';

describe('OAuth 2.0 PKCE & Consent Engine Tests', () => {
  const authService = DeveloperAuthService.getInstance();
  const oauthService = OAuthService.getInstance();

  const developerUserId = '00000000-0000-0000-0000-000000000001';
  const endUserId = '00000000-0000-0000-0000-000000000002';
  let projectId: string;

  beforeEach(async () => {
    await prisma.oAuthToken.deleteMany();
    await prisma.oAuthConsent.deleteMany();
    await prisma.oAuthApplication.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({
      data: [
        { id: developerUserId, email: 'developer@example.com', normalizedEmail: 'developer@example.com', status: 'ACTIVE' },
        { id: endUserId, email: 'enduser@example.com', normalizedEmail: 'enduser@example.com', status: 'ACTIVE' },
      ],
    });

    const project = await authService.createProject({
      userId: developerUserId,
      name: 'OAuth Integration Project',
    });
    projectId = project.id;
  });

  it('creates an OAuth 2.0 application registration', async () => {
    const app = await oauthService.createOAuthApplication({
      projectId,
      userId: developerUserId,
      name: 'Third-Party Chat Client',
      redirectUris: ['https://myapp.com/oauth/callback', 'http://localhost:3000/callback'],
      allowedScopes: ['characters:read', 'conversations:write', 'messages:write'],
      isPublicClient: true,
      clientType: 'SPA',
    });

    expect(app.clientId).toBeDefined();
    expect(app.clientId.startsWith('app_')).toBe(true);
    expect(app.name).toBe('Third-Party Chat Client');
    expect(app.isPublicClient).toBe(true);
  });

  it('completes PKCE authorization code exchange and token issuance', async () => {
    const app = await oauthService.createOAuthApplication({
      projectId,
      userId: developerUserId,
      name: 'Mobile Client with PKCE',
      redirectUris: ['https://mobile.app/callback'],
      isPublicClient: true,
      clientType: 'MOBILE',
    });

    // 1. Generate code verifier and code challenge (S256)
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk_sample_verifier';
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // 2. Authorize and generate code
    const code = oauthService.generateAuthorizationCode({
      applicationId: app.id,
      clientId: app.clientId,
      userId: endUserId,
      redirectUri: 'https://mobile.app/callback',
      scopes: ['characters:read', 'conversations:write'],
      codeChallenge,
      codeChallengeMethod: 'S256',
    });

    expect(code.startsWith('dpc_')).toBe(true);

    // 3. Exchange code for access token using code_verifier
    const tokenResult = await oauthService.exchangeAuthorizationCode({
      clientId: app.clientId,
      code,
      redirectUri: 'https://mobile.app/callback',
      codeVerifier,
    });

    expect(tokenResult.access_token).toBeDefined();
    expect(tokenResult.access_token.startsWith('dpt_')).toBe(true);
    expect(tokenResult.refresh_token).toBeDefined();
    expect(tokenResult.refresh_token.startsWith('dpr_')).toBe(true);
    expect(tokenResult.token_type).toBe('Bearer');

    // 4. Verify access token
    const verified = await oauthService.verifyAccessToken(tokenResult.access_token);
    expect(verified.userId).toBe(endUserId);
    expect(verified.projectId).toBe(projectId);
    expect(verified.scopes).toContain('characters:read');
  });

  it('rejects PKCE token exchange when code_verifier does not match challenge', async () => {
    const app = await oauthService.createOAuthApplication({
      projectId,
      userId: developerUserId,
      name: 'Tamper Test App',
      redirectUris: ['https://tamper.test/callback'],
    });

    const codeVerifier = 'valid_secret_verifier_value_1234567890';
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const code = oauthService.generateAuthorizationCode({
      applicationId: app.id,
      clientId: app.clientId,
      userId: endUserId,
      redirectUri: 'https://tamper.test/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
    });

    // Exchange with wrong verifier
    await expect(
      oauthService.exchangeAuthorizationCode({
        clientId: app.clientId,
        code,
        redirectUri: 'https://tamper.test/callback',
        codeVerifier: 'wrong_unmatched_verifier_value',
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it('supports refresh token rotation and invalidates previous refresh tokens', async () => {
    const app = await oauthService.createOAuthApplication({
      projectId,
      userId: developerUserId,
      name: 'Rotation App',
      redirectUris: ['https://rotation.app/callback'],
      isPublicClient: true,
    });

    const code = oauthService.generateAuthorizationCode({
      applicationId: app.id,
      clientId: app.clientId,
      userId: endUserId,
      redirectUri: 'https://rotation.app/callback',
    });

    const initialTokens = await oauthService.exchangeAuthorizationCode({
      clientId: app.clientId,
      code,
      redirectUri: 'https://rotation.app/callback',
    });

    // Refresh token
    const refreshedTokens = await oauthService.refreshAccessToken({
      clientId: app.clientId,
      refreshToken: initialTokens.refresh_token,
    });

    expect(refreshedTokens.access_token).toBeDefined();
    expect(refreshedTokens.refresh_token).toBeDefined();
    expect(refreshedTokens.refresh_token).not.toBe(initialTokens.refresh_token);

    // Old refresh token must be revoked
    await expect(
      oauthService.refreshAccessToken({
        clientId: app.clientId,
        refreshToken: initialTokens.refresh_token,
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it('records and revokes user consent grants', async () => {
    const app = await oauthService.createOAuthApplication({
      projectId,
      userId: developerUserId,
      name: 'Consent App',
      redirectUris: ['https://consent.app/callback'],
      isPublicClient: true,
    });

    await oauthService.recordUserConsent(app.id, endUserId, ['characters:read', 'conversations:write']);

    const consents = await oauthService.listUserConsents(endUserId);
    expect(consents.length).toBe(1);
    expect(consents[0].applicationId).toBe(app.id);

    // Revoke
    await oauthService.revokeUserConsent(app.id, endUserId);

    const afterRevoke = await oauthService.listUserConsents(endUserId);
    expect(afterRevoke.length).toBe(0);
  });
});
