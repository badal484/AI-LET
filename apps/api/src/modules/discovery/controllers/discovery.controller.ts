import { Request, Response, NextFunction } from 'express';
import { CatalogService } from '../catalogs/CatalogService.js';
import { HomeFeedService } from '../services/HomeFeedService.js';
import { SimilarityService } from '../services/SimilarityService.js';
import { CharacterEligibilityService } from '../services/CharacterEligibilityService.js';
import { SignalAggregationService } from '../services/SignalAggregationService.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  userDiscoveryPreferenceSchema,
  discoveryEventBatchSchema,
  homeFeedQuerySchema,
  userNegativeSignalCreateSchema,
} from '@ai-companion/validation';
import { AuthenticationError, ValidationError } from '../../../shared/errors/AppError.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class DiscoveryController {
  /**
   * GET /api/v1/discovery/home (and /api/v1/home)
   * Returns unified multi-stage personalized Home feed.
   */
  public static async getHomeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = homeFeedQuerySchema.parse(req.query);
      const userId = req.user?.userId || (req as any).user?.id;
      const userEntitlements = (req as any).user?.entitlements || [];

      const feed = await HomeFeedService.getHomeFeed(userId, {
        refresh: query.refresh,
        limit: query.limit,
        userEntitlements,
      });

      ApiResponse.success(res, feed, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/trending
   * Returns rising/trending characters based on interaction velocity.
   */
  public static async getTrending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 20;

      const docs = await prisma.searchDocument.findMany({
        orderBy: { trendingScore: 'desc' },
        take: limit * 2,
        select: { characterId: true },
      });

      const chars = await prisma.character.findMany({
        where: {
          id: { in: docs.map(d => d.characterId) },
          status: 'PUBLISHED',
          deletedAt: null,
        },
        include: {
          categoryRef: true,
          discoveryConfig: true,
          currentPublishedVersion: true,
          tagLinks: { include: { tag: true } },
        },
      });

      const eligibleIds = await CharacterEligibilityService.filterEligible(chars.map(c => c.id), { userId });
      const eligibleSet = new Set(eligibleIds);
      const items = chars.filter(c => eligibleSet.has(c.id)).slice(0, limit).map(c => CatalogService.mapToCatalogItem(c));
      ApiResponse.success(res, { items }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/new
   * Returns newly published characters.
   */
  public static async getNew(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 20;

      const chars = await prisma.character.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        include: {
          categoryRef: true,
          discoveryConfig: true,
          currentPublishedVersion: true,
          tagLinks: { include: { tag: true } },
        },
      });

      const eligibleIds = await CharacterEligibilityService.filterEligible(chars.map(c => c.id), { userId });
      const eligibleSet = new Set(eligibleIds);
      const items = chars.filter(c => eligibleSet.has(c.id)).slice(0, limit).map(c => CatalogService.mapToCatalogItem(c));
      ApiResponse.success(res, { items }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/similar/:characterId
   * Returns top similar characters with explanation reasons.
   */
  public static async getSimilar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const characterId = req.params['characterId'] as string;
      if (!characterId) {
        throw new ValidationError('Character ID is required');
      }

      const userId = req.user?.userId || (req as any).user?.id;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 6;

      const items = await SimilarityService.getSimilarCharacters(characterId, userId, limit);
      ApiResponse.success(res, { items }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/discovery/controls/negative-signal
   * Registers a negative preference signal (HIDE_CHARACTER, HIDE_CREATOR, NOT_INTERESTED).
   */
  public static async recordNegativeSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required to submit preference controls');
      }

      const body = userNegativeSignalCreateSchema.parse(req.body);

      const signal = await prisma.userNegativeSignal.create({
        data: {
          userId,
          signalType: body.signalType,
          characterId: body.characterId || null,
          creatorProfileId: body.creatorProfileId || null,
          reason: body.reason || null,
        },
      });

      ApiResponse.success(res, signal, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/characters/:idOrSlug
   * Returns sanitized public profile of a character.
   */
  public static async getCharacterProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idOrSlug = req.params['idOrSlug'] as string;
      if (!idOrSlug) {
        throw new ValidationError('Character identifier is required');
      }

      const userId = req.user?.userId || (req as any).user?.id;
      const userEntitlements = (req as any).user?.entitlements || [];

      const profile = await CatalogService.getPublicCharacterProfile(
        idOrSlug,
        userId,
        userEntitlements,
      );

      ApiResponse.success(res, profile, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/categories
   */
  public static async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await CatalogService.getCategories();
      ApiResponse.success(res, categories, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/categories/:slug
   */
  public static async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params['slug'] as string;
      const userId = req.user?.userId || (req as any).user?.id;
      const result = await CatalogService.getCategoryBySlug(slug, userId);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/collections
   */
  public static async getCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      const collections = await CatalogService.getCollections(userId);
      ApiResponse.success(res, collections, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/collections/:slug
   */
  public static async getCollectionBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params['slug'] as string;
      const userId = req.user?.userId || (req as any).user?.id;
      const collection = await CatalogService.getCollectionBySlug(slug, userId);
      ApiResponse.success(res, collection, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/discovery/favorites/:characterId
   */
  public static async addFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const characterId = req.params['characterId'] as string;
      const result = await CatalogService.toggleFavorite(userId, characterId, true);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/discovery/favorites/:characterId
   */
  public static async removeFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const characterId = req.params['characterId'] as string;
      const result = await CatalogService.toggleFavorite(userId, characterId, false);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/favorites
   */
  public static async listFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const favorites = await CatalogService.listUserFavorites(userId);
      ApiResponse.success(res, favorites, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/discovery/preferences
   */
  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const prefs = await CatalogService.getUserDiscoveryPreferences(userId);
      ApiResponse.success(res, prefs, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/discovery/preferences
   */
  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = userDiscoveryPreferenceSchema.parse(req.body);
      const updated = await CatalogService.updateUserDiscoveryPreferences(userId, body);
      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/discovery/reset-personalization
   */
  public static async resetPersonalization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      await CatalogService.resetPersonalization(userId);
      ApiResponse.success(res, { message: 'Discovery personalization reset successfully' }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/discovery/events
   * Batch ingestion of impression, click, and interaction analytics.
   */
  public static async recordEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      const body = discoveryEventBatchSchema.parse(req.body);

      const result = await SignalAggregationService.processEvents(userId, body);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

