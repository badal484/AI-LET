import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, ValidationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';
import { DeveloperUsageMeteringService } from '../services/DeveloperUsageMeteringService.js';
import { WebhookService } from '../services/WebhookService.js';
import type { PublicCharacterDTO } from '@ai-companion/types';

export class PublicCharacterController {
  /**
   * GET /v1/characters
   * Returns a cursor-paginated list of safe, published characters.
   */
  public static async listCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limitStr = req.query['limit'] as string | undefined;
      const limit = Math.min(Math.max(1, parseInt(limitStr || '20', 10)), 100);
      const after = req.query['after'] as string | undefined;
      const search = req.query['search'] as string | undefined;

      const whereClause: any = {
        visibility: 'PUBLIC',
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { tagline: { contains: search, mode: 'insensitive' } },
          { shortDescription: { contains: search, mode: 'insensitive' } },
        ];
      }

      const queryOptions: any = {
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      };

      if (after) {
        queryOptions.cursor = { id: after };
        queryOptions.skip = 1;
      }

      const characters = await prisma.character.findMany(queryOptions);
      const hasMore = characters.length > limit;
      const items = hasMore ? characters.slice(0, limit) : characters;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

      const data: PublicCharacterDTO[] = items.map((char) => PublicCharacterController.toPublicDTO(char));

      // Record metered usage
      if (req.developerContext) {
        DeveloperUsageMeteringService.getInstance().recordUsage({
          projectId: req.developerContext.projectId,
          metric: 'API_REQUESTS',
          quantity: 1,
          endpoint: '/v1/characters',
          environment: req.developerContext.environment,
        }).catch(() => {});
      }

      res.status(200).json({
        data,
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/characters/:id
   * Returns a single published character by ID.
   */
  public static async getCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;

      const character = await prisma.character.findUnique({
        where: { id },
      });

      if (!character) {
        throw new NotFoundError(`Character '${id}' not found`);
      }

      // If character is private, verify project ownership
      if (character.visibility === 'PRIVATE') {
        if (!req.developerContext || character.createdById !== req.developerContext.userId) {
          throw new NotFoundError(`Character '${id}' not found or access denied`);
        }
      }

      // Record metered usage
      if (req.developerContext) {
        DeveloperUsageMeteringService.getInstance().recordUsage({
          projectId: req.developerContext.projectId,
          metric: 'API_REQUESTS',
          quantity: 1,
          endpoint: `/v1/characters/${id}`,
          environment: req.developerContext.environment,
        }).catch(() => {});
      }

      res.status(200).json({
        data: PublicCharacterController.toPublicDTO(character),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /v1/characters
   * Creates a character owned by the developer's project/account.
   */
  public static async createCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const { name, tagline, description, avatarUrl } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new ValidationError('Character name is required');
      }

      const trimmedName = name.trim();
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + crypto.randomBytes(4).toString('hex');
      const internalKey = `char_${crypto.randomBytes(8).toString('hex')}`;

      const character = await prisma.character.create({
        data: {
          createdById: req.developerContext.userId,
          internalKey,
          slug,
          name: trimmedName,
          tagline: tagline ? tagline.trim() : `AI Companion ${trimmedName}`,
          shortDescription: description ? description.slice(0, 300) : '',
          longDescription: description ? description.trim() : '',
          avatarUrl: avatarUrl || 'https://assets.companion.ai/avatars/default.webp',
          coverImageUrl: 'https://assets.companion.ai/covers/default.webp',
          archetype: 'Companion',
          backstory: description ? description.trim() : 'AI character companion',
          age: 25,
          gender: 'unspecified',
          occupation: 'Companion',
          status: 'DRAFT',
          visibility: 'PRIVATE',
        },
      });

      // Record metered usage
      DeveloperUsageMeteringService.getInstance().recordUsage({
        projectId: req.developerContext.projectId,
        metric: 'API_REQUESTS',
        quantity: 1,
        endpoint: '/v1/characters',
        environment: req.developerContext.environment,
      }).catch(() => {});

      res.status(201).json({
        data: PublicCharacterController.toPublicDTO(character),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /v1/characters/:id
   * Updates an existing character owned by the developer.
   */
  public static async updateCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = req.params['id'] as string;
      const { name, tagline, description, avatarUrl } = req.body;

      const character = await prisma.character.findUnique({
        where: { id },
      });

      if (!character) {
        throw new NotFoundError(`Character '${id}' not found`);
      }

      if (character.createdById !== req.developerContext.userId) {
        throw new PermissionDeniedError('You do not own this character');
      }

      const updated = await prisma.character.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          tagline: tagline !== undefined ? tagline : undefined,
          shortDescription: description !== undefined ? description.slice(0, 300) : undefined,
          longDescription: description !== undefined ? description.trim() : undefined,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        },
      });

      res.status(200).json({
        data: PublicCharacterController.toPublicDTO(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /v1/characters/:id/submit
   * Submits a character for creator review and publication.
   */
  public static async submitCharacterForReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developerContext) {
        throw new PermissionDeniedError('Authentication required');
      }

      const id = req.params['id'] as string;
      const character = await prisma.character.findUnique({
        where: { id },
      });

      if (!character) {
        throw new NotFoundError(`Character '${id}' not found`);
      }

      if (character.createdById !== req.developerContext.userId) {
        throw new PermissionDeniedError('You do not own this character');
      }

      const updated = await prisma.character.update({
        where: { id },
        data: {
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
        },
      });

      // Dispatch Webhook event
      WebhookService.getInstance().dispatchWebhookEvent(
        req.developerContext.projectId,
        'character.published',
        {
          character_id: character.id,
          name: character.name,
          published_at: new Date().toISOString(),
        }
      ).catch(() => {});

      res.status(200).json({
        data: PublicCharacterController.toPublicDTO(updated),
        message: 'Character published successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sanitizes internal Prisma Character models to PublicCharacterDTO.
   */
  public static toPublicDTO(char: any): PublicCharacterDTO {
    return {
      id: char.id,
      name: char.name,
      tagline: char.tagline || undefined,
      description: char.shortDescription || char.longDescription || char.description || undefined,
      avatarUrl: char.avatarUrl || undefined,
      tags: Array.isArray(char.tags) ? char.tags : [],
      isNsfw: Boolean(char.isNsfw),
      totalConversations: char.totalConversations || 0,
      totalMessages: char.totalMessages || 0,
      createdAt: char.createdAt instanceof Date ? char.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: char.updatedAt instanceof Date ? char.updatedAt.toISOString() : new Date().toISOString(),
      version: char.currentVersionNumber || char.versionNumber || 1,
      voiceId: char.voiceId || undefined,
    };
  }
}
