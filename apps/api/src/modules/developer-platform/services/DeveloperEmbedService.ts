import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuthenticationError, PermissionDeniedError, NotFoundError } from '../../../shared/errors/AppError.js';
import type { DeveloperEmbedConfigItem } from '@ai-companion/types';

const JWT_SECRET = process.env['JWT_SECRET'] || 'phase28-dev-embed-secret-key-32-chars-long!!';

export interface CreateEmbedConfigInput {
  projectId: string;
  userId: string;
  characterId: string;
  originAllowlist: string[];
  theme?: Record<string, any>;
  features?: Record<string, any>;
}

export interface EphemeralSessionTokenPayload {
  projectId: string;
  characterId: string;
  origin: string;
  sessionId: string;
  capabilities: string[];
}

export class DeveloperEmbedService {
  private static instance: DeveloperEmbedService;

  private constructor() {}

  public static getInstance(): DeveloperEmbedService {
    if (!DeveloperEmbedService.instance) {
      DeveloperEmbedService.instance = new DeveloperEmbedService();
    }
    return DeveloperEmbedService.instance;
  }

  /**
   * Creates or updates an embed configuration for a character in a project.
   */
  public async upsertEmbedConfig(input: CreateEmbedConfigInput): Promise<DeveloperEmbedConfigItem> {
    const { projectId, userId, characterId, originAllowlist, theme, features } = input;

    // Verify project access
    const project = await prisma.developerProject.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new PermissionDeniedError('Project not found or access denied');
    }

    // Verify character exists
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundError(`Character '${characterId}' not found`);
    }

    const existing = await prisma.developerEmbedConfig.findFirst({
      where: {
        projectId,
        characterId,
      },
    });

    let record;
    if (existing) {
      record = await prisma.developerEmbedConfig.update({
        where: { id: existing.id },
        data: {
          originAllowlist,
          theme: theme || undefined,
          features: features || undefined,
        },
      });
    } else {
      record = await prisma.developerEmbedConfig.create({
        data: {
          projectId,
          characterId,
          originAllowlist,
          theme: theme || {},
          features: features || { chat: true, voice: false },
        },
      });
    }

    return this.mapConfig(record);
  }

  /**
   * Retrieves embed configuration by project and character.
   */
  public async getEmbedConfig(projectId: string, characterId: string): Promise<DeveloperEmbedConfigItem> {
    const record = await prisma.developerEmbedConfig.findFirst({
      where: {
        projectId,
        characterId,
      },
    });

    if (!record) {
      throw new NotFoundError(`Embed config not found for character '${characterId}' in project '${projectId}'`);
    }

    return this.mapConfig(record);
  }

  /**
   * Validates if a requesting origin is permitted by the embed configuration.
   */
  public isOriginAllowed(origin: string, allowlist: string[]): boolean {
    if (!origin || !allowlist || allowlist.length === 0) return false;

    // Normalize origin to lowercase without trailing slash
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');

    for (const pattern of allowlist) {
      const normalizedPattern = pattern.toLowerCase().replace(/\/$/, '');

      if (normalizedPattern === '*' || normalizedPattern === normalizedOrigin) {
        return true;
      }

      // Wildcard subdomain matching: e.g. https://*.example.com or *.example.com
      if (normalizedPattern.includes('*')) {
        const regexStr = '^' + normalizedPattern.replace(/\./g, '\\.').replace(/\*/g, '[a-zA-Z0-9.-]+') + '$';
        const regex = new RegExp(regexStr);
        if (regex.test(normalizedOrigin)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generates a short-lived ephemeral session token (e.g. 15-60 min) for browser iframe/widget access.
   */
  public async createEphemeralSessionToken(
    projectId: string,
    characterId: string,
    origin: string,
    capabilities: string[] = ['chat']
  ): Promise<{ token: string; expiresInSeconds: number; sessionId: string }> {
    const config = await this.getEmbedConfig(projectId, characterId);

    if (!this.isOriginAllowed(origin, config.originAllowlist)) {
      throw new PermissionDeniedError(`Origin '${origin}' is not authorized to embed this character`);
    }

    const sessionId = `sess_embed_${crypto.randomBytes(12).toString('hex')}`;
    const expiresInSeconds = 3600; // 1 hour

    const payload: EphemeralSessionTokenPayload = {
      projectId,
      characterId,
      origin,
      sessionId,
      capabilities,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expiresInSeconds,
      subject: sessionId,
      issuer: 'ai-companion-embed-gateway',
    });

    return {
      token,
      expiresInSeconds,
      sessionId,
    };
  }

  /**
   * Verifies an ephemeral embed session token.
   */
  public verifyEphemeralSessionToken(token: string, expectedOrigin?: string): EphemeralSessionTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'ai-companion-embed-gateway',
      }) as EphemeralSessionTokenPayload;

      if (expectedOrigin && decoded.origin && expectedOrigin !== decoded.origin && decoded.origin !== '*') {
        if (!this.isOriginAllowed(expectedOrigin, [decoded.origin])) {
          throw new PermissionDeniedError(`Token origin '${decoded.origin}' mismatch with request origin '${expectedOrigin}'`);
        }
      }

      return decoded;
    } catch (err: any) {
      if (err instanceof PermissionDeniedError) throw err;
      throw new AuthenticationError('Invalid or expired embed session token');
    }
  }

  private mapConfig(record: any): DeveloperEmbedConfigItem {
    return {
      id: record.id,
      projectId: record.projectId,
      characterId: record.characterId,
      originAllowlist: (record.originAllowlist as string[]) || [],
      theme: (record.theme as Record<string, any>) || undefined,
      features: (record.features as Record<string, any>) || undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
