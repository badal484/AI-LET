import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { AuthenticationError, PermissionDeniedError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import type {
  DeveloperProjectItem,
  DeveloperApiKeyItem,
  CreatedApiKeyResult,
  ApiKeyType,
  ProjectEnvironment,
} from '@ai-companion/types';

export interface CreateProjectInput {
  userId: string;
  organizationId?: string | null;
  name: string;
  slug?: string;
  environment?: ProjectEnvironment;
  allowedOrigins?: string[];
}

export interface CreateApiKeyInput {
  projectId: string;
  userId: string;
  name: string;
  keyType?: ApiKeyType;
  scopes?: string[];
  expiresInDays?: number | null;
}

export class DeveloperAuthService {
  private static instance: DeveloperAuthService;

  private constructor() {}

  public static getInstance(): DeveloperAuthService {
    if (!DeveloperAuthService.instance) {
      DeveloperAuthService.instance = new DeveloperAuthService();
    }
    return DeveloperAuthService.instance;
  }

  // =========================================================================
  // PROJECT MANAGEMENT
  // =========================================================================

  /**
   * Creates a new developer project workspace.
   */
  public async createProject(input: CreateProjectInput): Promise<DeveloperProjectItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Project name is required.');
    }

    const slug = input.slug
      ? input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')
      : input.name.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');

    const project = await prisma.developerProject.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId || null,
        name: input.name.trim(),
        slug,
        environment: input.environment || 'DEVELOPMENT',
        allowedOrigins: (input.allowedOrigins || []) as any,
        status: 'ACTIVE',
      },
    });

    logger.info(`DeveloperAuthService: created project '${project.id}' for user '${input.userId}'`);
    return this.mapProject(project);
  }

  /**
   * Retrieves a developer project by ID with tenant access validation.
   */
  public async getProject(projectId: string, userId?: string): Promise<DeveloperProjectItem> {
    const project = await prisma.developerProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError(`Project '${projectId}' not found.`);
    }

    if (userId && project.userId !== userId) {
      throw new PermissionDeniedError(`Access denied to project '${projectId}'.`);
    }

    return this.mapProject(project);
  }

  /**
   * Deletes a developer project.
   */
  public async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await prisma.developerProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError(`Project '${projectId}' not found.`);
    }

    if (project.userId !== userId) {
      throw new PermissionDeniedError(`Access denied to project '${projectId}'.`);
    }

    await prisma.developerProject.delete({
      where: { id: projectId },
    });

    logger.info(`DeveloperAuthService: deleted project '${projectId}'`);
  }

  /**
   * Lists projects for a developer user.
   */
  public async listProjects(userId: string): Promise<DeveloperProjectItem[]> {
    const projects = await prisma.developerProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => this.mapProject(p));
  }

  // =========================================================================
  // API KEY MANAGEMENT
  // =========================================================================

  /**
   * Generates a new cryptographically secure API key with prefix and SHA-256 hash.
   */
  public async createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKeyResult & { apiKey: DeveloperApiKeyItem }> {
    const project = await this.getProject(input.projectId, input.userId);

    const isLive = project.environment === 'PRODUCTION';
    const keyType = input.keyType || 'SERVER';
    const prefixType = keyType === 'PUBLIC' ? 'ap' : 'ak';
    const envTag = isLive ? 'live' : 'test';

    // Format: ak_live_<random32bytesHex> or ap_test_<random32bytesHex>
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const fullSecretKey = `${prefixType}_${envTag}_${rawSecret}`;
    const keyPrefix = fullSecretKey.slice(0, 16);
    const keyHash = crypto.createHash('sha256').update(fullSecretKey).digest('hex');

    const defaultScopes = keyType === 'PUBLIC'
      ? ['characters:read', 'conversations:write', 'messages:write']
      : [
          'characters:read',
          'conversations:read',
          'conversations:write',
          'messages:write',
          'agents:run',
          'webhooks:manage',
          'usage:read',
        ];

    const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : defaultScopes;

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await prisma.developerApiKey.create({
      data: {
        projectId: project.id,
        name: input.name.trim() || `${keyType} Key`,
        keyPrefix,
        keyHash,
        keyType,
        scopes: scopes as any,
        environment: project.environment,
        expiresAt,
      },
    });

    logger.info(`DeveloperAuthService: generated API key '${created.id}' (${keyPrefix}...) for project '${project.id}'`);

    const mapped = this.mapApiKey(created);
    return {
      ...mapped,
      apiKey: mapped,
      secretKey: fullSecretKey,
    };
  }

  /**
   * Authenticates an API key string and verifies status, expiration, and project state.
   */
  public async authenticateApiKey(rawApiKey: string): Promise<{
    apiKeyId: string;
    projectId: string;
    userId: string;
    scopes: string[];
    environment: string;
    keyType: string;
    apiKey: DeveloperApiKeyItem;
    project: DeveloperProjectItem;
  }> {
    if (!rawApiKey || !rawApiKey.includes('_')) {
      throw new AuthenticationError('Invalid API key format.');
    }

    const keyHash = crypto.createHash('sha256').update(rawApiKey.trim()).digest('hex');

    const key = await prisma.developerApiKey.findUnique({
      where: { keyHash },
      include: { project: true },
    });

    if (!key) {
      throw new AuthenticationError('API key not recognized.');
    }

    if (key.revokedAt) {
      throw new AuthenticationError('API key has been revoked.');
    }

    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      throw new AuthenticationError('API key has expired.');
    }

    if (key.project.status !== 'ACTIVE') {
      throw new PermissionDeniedError(`Developer project is currently ${key.project.status.toLowerCase()}.`);
    }

    // Touch lastUsedAt asynchronously (fire-and-forget)
    prisma.developerApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    const mappedKey = this.mapApiKey(key);
    const mappedProject = this.mapProject(key.project);

    return {
      apiKeyId: key.id,
      projectId: key.projectId,
      userId: key.project.userId,
      scopes: mappedKey.scopes,
      environment: key.environment,
      keyType: key.keyType,
      apiKey: mappedKey,
      project: mappedProject,
    };
  }

  /**
   * Rotates an API key with a smooth overlap window.
   */
  public async rotateApiKey(
    keyId: string,
    projectId: string,
    userId: string,
    overlapHours: number = 24
  ): Promise<CreatedApiKeyResult & { apiKey: DeveloperApiKeyItem }> {
    const existing = await prisma.developerApiKey.findFirst({
      where: { id: keyId, projectId },
      include: { project: true },
    });

    if (!existing || existing.project.userId !== userId) {
      throw new PermissionDeniedError(`API Key '${keyId}' not found or access denied.`);
    }

    // Set expiration on old key after overlap window
    const newExpiresAt = new Date(Date.now() + overlapHours * 3600 * 1000);
    await prisma.developerApiKey.update({
      where: { id: keyId },
      data: { expiresAt: newExpiresAt },
    });

    // Create new key with same name & scopes
    return this.createApiKey({
      projectId,
      userId,
      name: `${existing.name} (Rotated)`,
      keyType: existing.keyType as ApiKeyType,
      scopes: existing.scopes as string[],
    });
  }

  /**
   * Revokes an active API key immediately.
   */
  public async revokeApiKey(keyId: string, projectIdOrUserId?: string, userId?: string): Promise<DeveloperApiKeyItem> {
    const key = await prisma.developerApiKey.findFirst({
      where: { id: keyId },
      include: { project: true },
    });

    if (!key) {
      throw new NotFoundError(`API Key '${keyId}' not found.`);
    }

    const ownerUserId = userId || projectIdOrUserId;
    if (ownerUserId && key.project.userId !== ownerUserId) {
      throw new PermissionDeniedError(`Access denied to revoke API Key '${keyId}'.`);
    }

    const updated = await prisma.developerApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    logger.info(`DeveloperAuthService: revoked key '${keyId}'`);
    return this.mapApiKey(updated);
  }

  /**
   * Lists API keys for a project.
   */
  public async listApiKeys(projectId: string, userId: string): Promise<DeveloperApiKeyItem[]> {
    await this.getProject(projectId, userId); // verify ownership

    const keys = await prisma.developerApiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => this.mapApiKey(k));
  }

  /**
   * Verifies if an API key or token has the requested scope.
   */
  public hasScope(grantedScopes: string[], requiredScope: string): boolean {
    if (grantedScopes.includes('*') || grantedScopes.includes('admin:*')) return true;
    if (grantedScopes.includes(requiredScope)) return true;

    // Check wildcard prefix (e.g., 'characters:*' satisfies 'characters:read')
    const [domain] = requiredScope.split(':');
    if (domain && grantedScopes.includes(`${domain}:*`)) return true;

    return false;
  }

  private mapProject(record: any): DeveloperProjectItem {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      name: record.name,
      slug: record.slug,
      status: record.status,
      environment: record.environment,
      allowedOrigins: (record.allowedOrigins as string[]) || [],
      metadata: record.metadata as Record<string, unknown> | null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapApiKey(record: any): DeveloperApiKeyItem {
    return {
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      keyPrefix: record.keyPrefix,
      keyType: record.keyType as ApiKeyType,
      scopes: (record.scopes as string[]) || [],
      environment: record.environment,
      lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
