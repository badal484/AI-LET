import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { AuthenticationError, PermissionDeniedError, ValidationError } from '../../src/shared/errors/AppError.js';

describe('Developer API Key System & Authentication Tests', () => {
  const authService = DeveloperAuthService.getInstance();
  const testUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await prisma.developerUsageRecord.deleteMany();
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
    await prisma.oAuthToken.deleteMany();
    await prisma.oAuthConsent.deleteMany();
    await prisma.oAuthApplication.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.user.deleteMany();

    // Create base test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'developer@example.com',
        normalizedEmail: 'developer@example.com',
        status: 'ACTIVE',
      },
    });
  });

  it('creates a developer project and generates scoped live secret keys', async () => {
    const project = await authService.createProject({
      userId: testUserId,
      name: 'Production Companion App',
      environment: 'PRODUCTION',
    });

    expect(project).toBeDefined();
    expect(project.id).toBeDefined();
    expect(project.name).toBe('Production Companion App');
    expect(project.environment).toBe('PRODUCTION');

    // Generate secret key
    const keyResult = await authService.createApiKey({
      projectId: project.id,
      userId: testUserId,
      name: 'Backend Microservice Key',
      keyType: 'SERVER',
      scopes: ['characters:read', 'conversations:write', 'messages:write'],
    });

    expect(keyResult.secretKey).toBeDefined();
    expect(keyResult.secretKey.startsWith('ak_live_')).toBe(true);
    expect(keyResult.apiKey.name).toBe('Backend Microservice Key');
    expect(keyResult.apiKey.scopes).toEqual(['characters:read', 'conversations:write', 'messages:write']);

    // Authenticate key
    const authResult = await authService.authenticateApiKey(keyResult.secretKey);
    expect(authResult.projectId).toBe(project.id);
    expect(authResult.userId).toBe(testUserId);
    expect(authResult.scopes).toContain('characters:read');
    expect(authResult.scopes).toContain('messages:write');
  });

  it('generates test keys with ak_test_ prefix in DEVELOPMENT environment', async () => {
    const project = await authService.createProject({
      userId: testUserId,
      name: 'Test Sandbox Project',
      environment: 'DEVELOPMENT',
    });

    const keyResult = await authService.createApiKey({
      projectId: project.id,
      userId: testUserId,
      name: 'Test Runner Key',
      keyType: 'SERVER',
    });

    expect(keyResult.secretKey.startsWith('ak_test_')).toBe(true);
  });

  it('generates public client keys with ap_live_ prefix', async () => {
    const project = await authService.createProject({
      userId: testUserId,
      name: 'Client Webapp',
      environment: 'PRODUCTION',
    });

    const keyResult = await authService.createApiKey({
      projectId: project.id,
      userId: testUserId,
      name: 'Browser Client Key',
      keyType: 'PUBLIC',
      scopes: ['characters:read'],
    });

    expect(keyResult.secretKey.startsWith('ap_live_')).toBe(true);
    expect(keyResult.apiKey.keyType).toBe('PUBLIC');
  });

  it('rejects invalid or tampered API keys with AuthenticationError', async () => {
    await expect(authService.authenticateApiKey('ak_live_invalidkey1234567890abcdef')).rejects.toThrow(
      AuthenticationError
    );
  });

  it('rejects revoked API keys immediately', async () => {
    const project = await authService.createProject({
      userId: testUserId,
      name: 'Revocation Test Project',
    });

    const keyResult = await authService.createApiKey({
      projectId: project.id,
      userId: testUserId,
      name: 'Temporary Key',
    });

    // Valid before revocation
    const authBefore = await authService.authenticateApiKey(keyResult.secretKey);
    expect(authBefore.projectId).toBe(project.id);

    // Revoke
    await authService.revokeApiKey(keyResult.apiKey.id, project.id, testUserId);

    // Invalid after revocation
    await expect(authService.authenticateApiKey(keyResult.secretKey)).rejects.toThrow(AuthenticationError);
  });

  it('supports seamless key rotation with configurable overlap period', async () => {
    const project = await authService.createProject({
      userId: testUserId,
      name: 'Rotation Test Project',
    });

    const oldKeyResult = await authService.createApiKey({
      projectId: project.id,
      userId: testUserId,
      name: 'Key To Rotate',
      scopes: ['characters:read', 'conversations:read'],
    });

    // Rotate with 24 hours overlap
    const newKeyResult = await authService.rotateApiKey(
      oldKeyResult.apiKey.id,
      project.id,
      testUserId,
      24
    );

    expect(newKeyResult.secretKey).toBeDefined();
    expect(newKeyResult.secretKey).not.toBe(oldKeyResult.secretKey);

    // Both old and new keys work during overlap window
    const authOld = await authService.authenticateApiKey(oldKeyResult.secretKey);
    expect(authOld.projectId).toBe(project.id);

    const authNew = await authService.authenticateApiKey(newKeyResult.secretKey);
    expect(authNew.projectId).toBe(project.id);
  });

  it('enforces scope matching and wildcard inheritance', () => {
    expect(authService.hasScope(['characters:read', 'messages:write'], 'characters:read')).toBe(true);
    expect(authService.hasScope(['characters:read', 'messages:write'], 'agents:run')).toBe(false);
    expect(authService.hasScope(['characters:*'], 'characters:read')).toBe(true);
    expect(authService.hasScope(['characters:*'], 'characters:write')).toBe(true);
    expect(authService.hasScope(['*'], 'anything:allowed')).toBe(true);
  });
});
