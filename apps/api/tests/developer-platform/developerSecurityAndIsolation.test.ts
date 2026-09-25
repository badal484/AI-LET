import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { DeveloperEmbedService } from '../../src/modules/developer-platform/services/DeveloperEmbedService.js';
import { PermissionDeniedError, NotFoundError, AuthenticationError } from '../../src/shared/errors/AppError.js';

describe('Developer Security, Multi-Tenant Isolation & IDOR Protection Tests', () => {
  const authService = DeveloperAuthService.getInstance();
  const embedService = DeveloperEmbedService.getInstance();

  const developerOneId = '00000000-0000-0000-0000-000000000001';
  const developerTwoId = '00000000-0000-0000-0000-000000000002';

  let projectOneId: string;
  let projectTwoId: string;

  beforeEach(async () => {
    await prisma.developerEmbedConfig.deleteMany();
    await prisma.developerUsageRecord.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({
      data: [
        { id: developerOneId, email: 'dev1@example.com', normalizedEmail: 'dev1@example.com', status: 'ACTIVE' },
        { id: developerTwoId, email: 'dev2@example.com', normalizedEmail: 'dev2@example.com', status: 'ACTIVE' },
      ],
    });

    const p1 = await authService.createProject({ userId: developerOneId, name: 'Project 1' });
    const p2 = await authService.createProject({ userId: developerTwoId, name: 'Project 2' });

    projectOneId = p1.id;
    projectTwoId = p2.id;
  });

  it('prevents Developer 2 from viewing or mutating Project 1 (IDOR protection)', async () => {
    // Dev 2 tries to get Dev 1's project
    await expect(authService.getProject(projectOneId, developerTwoId)).rejects.toThrow(
      PermissionDeniedError
    );

    // Dev 2 tries to delete Dev 1's project
    await expect(authService.deleteProject(projectOneId, developerTwoId)).rejects.toThrow(
      PermissionDeniedError
    );
  });

  it('prevents Developer 2 from generating or revoking API keys on Project 1', async () => {
    const key1 = await authService.createApiKey({
      projectId: projectOneId,
      userId: developerOneId,
      name: 'Dev1 Key',
    });

    // Dev 2 tries to list keys of Project 1
    await expect(authService.listApiKeys(projectOneId, developerTwoId)).rejects.toThrow(
      PermissionDeniedError
    );

    // Dev 2 tries to revoke Dev 1's key
    await expect(authService.revokeApiKey(key1.apiKey.id, projectOneId, developerTwoId)).rejects.toThrow(
      PermissionDeniedError
    );
  });

  describe('Embed Security & Origin Allowlist Validation', () => {
    it('accurately validates exact origin matches and wildcard subdomains', () => {
      const allowlist = ['https://myapp.com', 'https://*.example.org', 'http://localhost:3000'];

      expect(embedService.isOriginAllowed('https://myapp.com', allowlist)).toBe(true);
      expect(embedService.isOriginAllowed('https://app.example.org', allowlist)).toBe(true);
      expect(embedService.isOriginAllowed('https://demo.staging.example.org', allowlist)).toBe(true);
      expect(embedService.isOriginAllowed('http://localhost:3000', allowlist)).toBe(true);

      // Disallowed origins
      expect(embedService.isOriginAllowed('https://evil-site.com', allowlist)).toBe(false);
      expect(embedService.isOriginAllowed('https://myapp.com.evil.com', allowlist)).toBe(false);
      expect(embedService.isOriginAllowed('http://myapp.com', allowlist)).toBe(false); // HTTP vs HTTPS mismatch
    });

    it('issues and verifies short-lived ephemeral session tokens', async () => {
      const char = await prisma.character.create({
        data: {
          id: '00000000-0000-0000-0000-000000000099',
          createdById: developerOneId,
          name: 'Embed Character',
          slug: 'embed-character',
          internalKey: 'embed_character',
          tagline: 'Interactive Web Companion',
          shortDescription: 'Embeddable companion',
          longDescription: 'Embeddable companion character for web experiences',
          avatarUrl: 'https://assets.companion.ai/avatars/embed.webp',
          coverImageUrl: 'https://assets.companion.ai/covers/embed.webp',
          archetype: 'Assistant',
          backstory: 'Created to assist users',
          age: 25,
          gender: 'neutral',
          occupation: 'Assistant',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
        },
      });

      await embedService.upsertEmbedConfig({
        projectId: projectOneId,
        userId: developerOneId,
        characterId: char.id,
        originAllowlist: ['https://allowed-domain.com'],
      });

      // Generate token
      const session = await embedService.createEphemeralSessionToken(
        projectOneId,
        char.id,
        'https://allowed-domain.com'
      );

      expect(session.token).toBeDefined();
      expect(session.expiresInSeconds).toBe(3600);

      // Verify token
      const verified = embedService.verifyEphemeralSessionToken(session.token, 'https://allowed-domain.com');
      expect(verified.projectId).toBe(projectOneId);
      expect(verified.characterId).toBe(char.id);

      // Reject if request origin differs from token origin
      expect(() => {
        embedService.verifyEphemeralSessionToken(session.token, 'https://hacker-domain.com');
      }).toThrow(PermissionDeniedError);
    });
  });
});
