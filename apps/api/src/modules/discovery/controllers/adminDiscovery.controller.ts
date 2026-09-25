import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { RecommendationEngine } from '../recommendations/RecommendationEngine.js';
import { SignalAggregationService } from '../services/SignalAggregationService.js';
import { DiscoveryAdminService } from '../services/DiscoveryAdminService.js';
import {
  adminCategoryUpsertSchema,
  adminTagUpsertSchema,
  adminCollectionUpsertSchema,
  adminHomeSectionConfigSchema,
  adminCharacterDiscoveryConfigSchema,
  adminRecommendationSimulatorSchema,
  searchSynonymCreateSchema,
  searchSynonymUpdateSchema,
  rankingConfigCreateSchema,
  rankingConfigUpdateSchema,
  rankingSimulationSchema,
} from '@ai-companion/validation';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';


export class AdminDiscoveryController {
  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  public static async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await prisma.characterCategory.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          tags: true,
          _count: {
            select: { characters: true },
          },
        },
      });
      ApiResponse.success(res, categories, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = adminCategoryUpsertSchema.parse(req.body);
      const category = await prisma.characterCategory.create({
        data: body,
      });

      await redis.del('discovery:categories:all');
      ApiResponse.success(res, category, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = adminCategoryUpsertSchema.partial().parse(req.body);

      const category = await prisma.characterCategory.update({
        where: { id },
        data: body,
      });

      await redis.del('discovery:categories:all');
      ApiResponse.success(res, category, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      await prisma.characterCategory.delete({ where: { id } });
      await redis.del('discovery:categories:all');
      ApiResponse.success(res, { message: 'Category deleted' }, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  public static async listTags(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await prisma.characterTag.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: { category: true },
      });
      ApiResponse.success(res, tags, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = adminTagUpsertSchema.parse(req.body);
      const tag = await prisma.characterTag.create({ data: body });
      ApiResponse.success(res, tag, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = adminTagUpsertSchema.partial().parse(req.body);
      const tag = await prisma.characterTag.update({
        where: { id },
        data: body,
      });
      ApiResponse.success(res, tag, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      await prisma.characterTag.delete({ where: { id } });
      ApiResponse.success(res, { message: 'Tag deleted' }, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Curated Collections
  // ---------------------------------------------------------------------------

  public static async listCollections(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const collections = await prisma.curatedCollection.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
            include: { character: true },
          },
        },
      });
      ApiResponse.success(res, collections, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = adminCollectionUpsertSchema.parse(req.body);
      const { characterIds, ...collectionData } = body;

      const collection = await prisma.curatedCollection.create({
        data: {
          ...collectionData,
          publishStartAt: collectionData.publishStartAt ? new Date(collectionData.publishStartAt) : null,
          publishEndAt: collectionData.publishEndAt ? new Date(collectionData.publishEndAt) : null,
          items: {
            create: characterIds.map((charId, idx) => ({
              characterId: charId,
              displayOrder: idx,
            })),
          },
        },
        include: {
          items: {
            include: { character: true },
          },
        },
      });

      ApiResponse.success(res, collection, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = adminCollectionUpsertSchema.partial().parse(req.body);
      const { characterIds, ...collectionData } = body;

      await prisma.curatedCollection.update({
        where: { id },
        data: {
          ...collectionData,
          publishStartAt: collectionData.publishStartAt !== undefined
            ? (collectionData.publishStartAt ? new Date(collectionData.publishStartAt) : null)
            : undefined,
          publishEndAt: collectionData.publishEndAt !== undefined
            ? (collectionData.publishEndAt ? new Date(collectionData.publishEndAt) : null)
            : undefined,
        },
      });

      if (characterIds) {
        // Re-link items
        await prisma.collectionItem.deleteMany({ where: { collectionId: id } });
        await prisma.collectionItem.createMany({
          data: characterIds.map((charId, idx) => ({
            collectionId: id,
            characterId: charId,
            displayOrder: idx,
          })),
        });
      }

      const updated = await prisma.curatedCollection.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
            include: { character: true },
          },
        },
      });

      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      await prisma.curatedCollection.delete({ where: { id } });
      ApiResponse.success(res, { message: 'Collection deleted' }, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Home Section Layout Configuration
  // ---------------------------------------------------------------------------

  public static async listHomeSections(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sections = await prisma.homeSectionConfig.findMany({
        orderBy: { displayOrder: 'asc' },
      });
      ApiResponse.success(res, sections, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async updateHomeSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = adminHomeSectionConfigSchema.partial().parse(req.body);

      const section = await prisma.homeSectionConfig.update({
        where: { id },
        data: body as any,
      });

      // Clear home cache keys
      const keys = await redis.keys('home:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      ApiResponse.success(res, section, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Character Discovery Metadata
  // ---------------------------------------------------------------------------

  public static async getCharacterDiscoveryConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const characterId = req.params['characterId'] as string;
      const config = await prisma.characterDiscoveryConfig.findUnique({
        where: { characterId },
        include: {
          character: {
            include: {
              tagLinks: {
                include: { tag: true },
              },
            },
          },
        },
      });

      ApiResponse.success(res, config, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async updateCharacterDiscoveryConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const characterId = req.params['characterId'] as string;
      const body = adminCharacterDiscoveryConfigSchema.parse(req.body);
      const { tagIds, categoryId, ...configData } = body;

      const character = await prisma.character.findUnique({ where: { id: characterId } });
      if (!character) {
        throw new NotFoundError('Character not found');
      }

      // Update character category reference
      if (categoryId !== undefined) {
        await prisma.character.update({
          where: { id: characterId },
          data: { categoryId },
        });
      }

      // Update tag links
      if (tagIds) {
        await prisma.characterTagLink.deleteMany({ where: { characterId } });
        if (tagIds.length > 0) {
          await prisma.characterTagLink.createMany({
            data: tagIds.map(tagId => ({
              characterId,
              tagId,
            })),
          });
        }
      }

      const config = await prisma.characterDiscoveryConfig.upsert({
        where: { characterId },
        create: {
          characterId,
          categoryId: categoryId || null,
          ...configData,
          newUntil: configData.newUntil ? new Date(configData.newUntil) : null,
          conversationStarters: configData.conversationStarters as any,
          highlightBadges: configData.highlightBadges as any,
          localizedProfiles: configData.localizedProfiles as any,
        },
        update: {
          categoryId: categoryId !== undefined ? categoryId : undefined,
          ...configData,
          newUntil: configData.newUntil !== undefined
            ? (configData.newUntil ? new Date(configData.newUntil) : null)
            : undefined,
          conversationStarters: configData.conversationStarters as any,
          highlightBadges: configData.highlightBadges as any,
          localizedProfiles: configData.localizedProfiles as any,
        },
      });

      ApiResponse.success(res, config, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Recommendations Simulator Sandbox
  // ---------------------------------------------------------------------------

  public static async simulateRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = adminRecommendationSimulatorSchema.parse(req.body);
      const simulated = await RecommendationEngine.simulateRecommendations(body);
      ApiResponse.success(res, simulated, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Discovery & Search Analytics
  // ---------------------------------------------------------------------------

  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await SignalAggregationService.getAnalyticsOverview();
      ApiResponse.success(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Search Synonyms Management
  // ---------------------------------------------------------------------------

  public static async listSynonyms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const language = req.query['language'] as string | undefined;
      const synonyms = await DiscoveryAdminService.listSynonyms(language);
      ApiResponse.success(res, synonyms, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createSynonym(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = searchSynonymCreateSchema.parse(req.body);
      const created = await DiscoveryAdminService.createSynonym(body);
      ApiResponse.success(res, created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateSynonym(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = searchSynonymUpdateSchema.parse(req.body);
      const updated = await DiscoveryAdminService.updateSynonym(id, body);
      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteSynonym(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      await DiscoveryAdminService.deleteSynonym(id);
      ApiResponse.success(res, { message: 'Synonym entry deleted' }, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Ranking Configuration Studio
  // ---------------------------------------------------------------------------

  public static async listRankingConfigs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await DiscoveryAdminService.listRankingConfigs();
      ApiResponse.success(res, configs, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createRankingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId;
      const body = rankingConfigCreateSchema.parse(req.body);
      const created = await DiscoveryAdminService.createRankingConfig(body, adminId);
      ApiResponse.success(res, created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateRankingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const body = rankingConfigUpdateSchema.parse(req.body);
      const updated = await DiscoveryAdminService.updateRankingConfig(id, body);
      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async publishRankingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const version = req.params['version'] as string;
      const published = await DiscoveryAdminService.publishRankingConfig(version);
      ApiResponse.success(res, published, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async simulateRanking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = rankingSimulationSchema.parse(req.body);
      const simulated = await DiscoveryAdminService.simulateRanking(body);
      ApiResponse.success(res, simulated, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Search Index Health & Maintenance
  // ---------------------------------------------------------------------------

  public static async getIndexHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await DiscoveryAdminService.getIndexHealth();
      ApiResponse.success(res, health, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async triggerReindex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const characterIds = req.body?.characterIds as string[] | undefined;
      const result = await DiscoveryAdminService.triggerReindex(characterIds);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Search Quality Metrics
  // ---------------------------------------------------------------------------

  public static async getSearchQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query['days'] ? Number(req.query['days']) : 30;
      const metrics = await DiscoveryAdminService.getSearchQualityMetrics(days);
      ApiResponse.success(res, metrics, 200);
    } catch (err) {
      next(err);
    }
  }
}

