import type {
  RelationshipState,
  RelationshipStage,
  RelationshipAnalysisResult,
  RelationshipAnalyticsMetrics,
  UserRelationshipSettingsData,
} from '@ai-companion/types';
import type { RelationshipListQueryOutput } from '@ai-companion/validation';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import { RelationshipPolicyEngine } from './relationshipPolicyEngine.service.js';
import { EmotionalToneService } from './emotionalTone.service.js';
import { RelationshipDecayService } from './relationshipDecay.service.js';

export class RelationshipStateService {
  private static readonly CACHE_TTL = SYSTEM_CONSTANTS.CACHE.USER_RELATIONSHIP_TTL_SECONDS;

  private static getCacheKey(userId: string, characterId: string): string {
    return `rel:user:${userId}:char:${characterId}`;
  }

  /**
   * Retrieves or initializes the dynamic relationship record between a user and character.
   */
  public static async getOrCreateRelationship(
    userId: string,
    characterId: string,
  ): Promise<RelationshipState> {
    // 1. Check Redis Cache
    try {
      const cached = await redis.get(this.getCacheKey(userId, characterId));
      if (cached) {
        return JSON.parse(cached) as RelationshipState;
      }
    } catch (err: any) {
      logger.warn(`Redis failed to read relationship cache: ${err.message}`);
    }

    // 2. Fetch from PostgreSQL
    let rel = await prisma.relationship.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId,
        },
      },
    });

    // 3. If not exists, initialize baseline record
    if (!rel) {
      const init = SYSTEM_CONSTANTS.RELATIONSHIP.INITIAL_DIMENSIONS;
      rel = await prisma.relationship.create({
        data: {
          userId,
          characterId,
          stage: 'STRANGER',
          familiarity: init.FAMILIARITY,
          trust: init.TRUST,
          comfort: init.COMFORT,
          affection: init.AFFECTION,
          engagement: init.ENGAGEMENT,
          totalInteractions: 0,
          consecutiveDaysActive: 0,
        },
      });
    } else {
      // Apply gentle time-based decay if inactive
      const decayedDims = RelationshipDecayService.calculateDecayedDimensions(
        {
          familiarity: rel.familiarity,
          trust: rel.trust,
          comfort: rel.comfort,
          affection: rel.affection,
          engagement: rel.engagement,
        },
        rel.lastInteractionAt,
      );

      // Check if decay altered dimensions
      if (
        decayedDims.familiarity !== rel.familiarity ||
        decayedDims.engagement !== rel.engagement ||
        decayedDims.comfort !== rel.comfort
      ) {
        rel = await prisma.relationship.update({
          where: { id: rel.id },
          data: {
            ...decayedDims,
          },
        });
      }
    }

    const state: RelationshipState = {
      id: rel.id,
      userId: rel.userId,
      characterId: rel.characterId,
      stage: rel.stage as RelationshipStage,
      familiarity: rel.familiarity,
      trust: rel.trust,
      comfort: rel.comfort,
      affection: rel.affection,
      engagement: rel.engagement,
      totalInteractions: rel.totalInteractions,
      consecutiveDaysActive: rel.consecutiveDaysActive,
      lastInteractionAt: rel.lastInteractionAt?.toISOString() || null,
      version: rel.version,
      createdAt: rel.createdAt.toISOString(),
      updatedAt: rel.updatedAt.toISOString(),
    };

    // Cache state in Redis
    try {
      await redis.set(this.getCacheKey(userId, characterId), JSON.stringify(state), 'EX', this.CACHE_TTL);
    } catch (err: any) {
      logger.warn(`Redis failed to cache relationship: ${err.message}`);
    }

    return state;
  }

  /**
   * Applies an analyzed interaction result to update the relationship state atomically.
   */
  public static async applyInteractionUpdate(params: {
    userId: string;
    characterId: string;
    analysisResult: RelationshipAnalysisResult;
    conversationId?: string;
    messageId?: string;
  }): Promise<RelationshipState> {
    const { userId, characterId, analysisResult, conversationId, messageId } = params;

    // 1. Check user personalization settings
    const settings = await this.getUserRelationshipSettings(userId);
    if (!settings.personalizationEnabled || !settings.relationshipProgressionEnabled) {
      logger.info(`Relationship personalization disabled for user ${userId}; skipping progression update.`);
      return this.getOrCreateRelationship(userId, characterId);
    }

    // 2. Fetch current state and character runtime config
    const currentRel = await this.getOrCreateRelationship(userId, characterId);
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { currentPublishedVersion: true },
    }).catch(() => null);
    const characterConfig = (character?.currentPublishedVersion?.relationshipConfigData as any) || {};

    // 3. Calculate hours since last interaction
    let hoursSinceLastInteraction: number | null = null;
    if (currentRel.lastInteractionAt) {
      const last = new Date(currentRel.lastInteractionAt).getTime();
      hoursSinceLastInteraction = Math.max(0, Math.floor((Date.now() - last) / (1000 * 60 * 60)));
    }

    // 4. Fetch recent event history for diminishing returns
    const recentEvents = await prisma.relationshipEvent.findMany({
      where: { relationshipId: currentRel.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { eventType: true },
    });

    const eventCountsHistory: Record<string, number> = {};
    for (const ev of recentEvents) {
      eventCountsHistory[ev.eventType] = (eventCountsHistory[ev.eventType] || 0) + 1;
    }

    // 5. Fetch existing milestones
    const existingMilestones = await prisma.relationshipMilestone.findMany({
      where: { relationshipId: currentRel.id },
      select: { milestoneType: true },
    });
    const achievedMilestoneTypes = existingMilestones.map(m => m.milestoneType);

    // 6. Execute Deterministic Policy Engine
    const policyResult = RelationshipPolicyEngine.evaluate({
      currentDimensions: {
        familiarity: currentRel.familiarity,
        trust: currentRel.trust,
        comfort: currentRel.comfort,
        affection: currentRel.affection,
        engagement: currentRel.engagement,
      },
      currentStage: currentRel.stage,
      totalInteractions: currentRel.totalInteractions,
      consecutiveDaysActive: currentRel.consecutiveDaysActive,
      signals: analysisResult.signals,
      characterConfig,
      eventCountsHistory,
      achievedMilestones: achievedMilestoneTypes,
      hoursSinceLastInteraction,
    });

    // 7. Update short-lived emotional tone in Redis
    await EmotionalToneService.updateTone(userId, characterId, {
      tone: analysisResult.dominantTone,
      energy: analysisResult.energy,
      warmth: analysisResult.warmth,
      seriousness: analysisResult.seriousness,
      engagement: analysisResult.engagement,
      topicSensitivity: analysisResult.topicSensitivity,
    });

    // 8. Calculate consecutive days active
    let newConsecutiveDays = currentRel.consecutiveDaysActive;
    if (hoursSinceLastInteraction === null) {
      newConsecutiveDays = 1;
    } else if (hoursSinceLastInteraction >= 20 && hoursSinceLastInteraction <= 48) {
      newConsecutiveDays += 1;
    } else if (hoursSinceLastInteraction > 48) {
      newConsecutiveDays = 1;
    }

    // 9. Persist update atomically with optimistic concurrency control
    const updated = await prisma.$transaction(async tx => {
      // Primary relationship update with version check
      const updatedRel = await tx.relationship.update({
        where: {
          id: currentRel.id,
          version: currentRel.version,
        },
        data: {
          stage: policyResult.newStage,
          familiarity: policyResult.newDimensions.familiarity,
          trust: policyResult.newDimensions.trust,
          comfort: policyResult.newDimensions.comfort,
          affection: policyResult.newDimensions.affection,
          engagement: policyResult.newDimensions.engagement,
          totalInteractions: { increment: 1 },
          consecutiveDaysActive: newConsecutiveDays,
          lastInteractionAt: new Date(),
          version: { increment: 1 },
        },
      });

      // Record relationship events
      for (const signal of analysisResult.signals) {
        await tx.relationshipEvent.create({
          data: {
            relationshipId: currentRel.id,
            eventType: signal.type,
            importance: signal.importance,
            confidence: signal.confidence,
            deltaFamiliarity: policyResult.deltas.familiarity,
            deltaTrust: policyResult.deltas.trust,
            deltaComfort: policyResult.deltas.comfort,
            deltaAffection: policyResult.deltas.affection,
            deltaEngagement: policyResult.deltas.engagement,
            description: signal.description || signal.type,
            sourceConversationId: conversationId || null,
            sourceMessageId: messageId || null,
          },
        });
      }

      // Record state history if stage changed or significant delta
      if (
        policyResult.stageChanged ||
        Math.abs(policyResult.deltas.trust) >= 2.0 ||
        Math.abs(policyResult.deltas.familiarity) >= 3.0
      ) {
        await tx.relationshipStateHistory.create({
          data: {
            relationshipId: currentRel.id,
            previousStage: currentRel.stage,
            newStage: policyResult.newStage,
            previousFamiliarity: currentRel.familiarity,
            newFamiliarity: policyResult.newDimensions.familiarity,
            previousTrust: currentRel.trust,
            newTrust: policyResult.newDimensions.trust,
            previousComfort: currentRel.comfort,
            newComfort: policyResult.newDimensions.comfort,
            previousAffection: currentRel.affection,
            newAffection: policyResult.newDimensions.affection,
            previousEngagement: currentRel.engagement,
            newEngagement: policyResult.newDimensions.engagement,
            reason: policyResult.stageTransitionReason || 'Interaction turn progression',
          },
        });
      }

      // Record newly achieved milestones
      for (const milestone of policyResult.newMilestones) {
        await tx.relationshipMilestone.upsert({
          where: {
            relationshipId_milestoneType: {
              relationshipId: currentRel.id,
              milestoneType: milestone.type,
            },
          },
          create: {
            relationshipId: currentRel.id,
            milestoneType: milestone.type,
            title: milestone.title,
            description: milestone.description,
            sourceConversationId: conversationId || null,
          },
          update: {},
        });
      }

      return updatedRel;
    });

    const newState: RelationshipState = {
      id: updated.id,
      userId: updated.userId,
      characterId: updated.characterId,
      stage: updated.stage as RelationshipStage,
      familiarity: updated.familiarity,
      trust: updated.trust,
      comfort: updated.comfort,
      affection: updated.affection,
      engagement: updated.engagement,
      totalInteractions: updated.totalInteractions,
      consecutiveDaysActive: updated.consecutiveDaysActive,
      lastInteractionAt: updated.lastInteractionAt?.toISOString() || null,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    // Invalidate Redis cache
    try {
      await redis.set(this.getCacheKey(userId, characterId), JSON.stringify(newState), 'EX', this.CACHE_TTL);
    } catch (err: any) {
      logger.warn(`Redis failed to update relationship cache: ${err.message}`);
    }

    return newState;
  }

  /**
   * Resets a relationship back to baseline for a given character.
   * Clears state history, invalidates cache, and records an audit transition.
   */
  public static async resetRelationship(userId: string, characterId: string): Promise<RelationshipState> {
    const existing = await prisma.relationship.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Relationship does not exist to reset', ErrorCode.RELATIONSHIP_NOT_FOUND);
    }

    const init = SYSTEM_CONSTANTS.RELATIONSHIP.INITIAL_DIMENSIONS;

    const resetRel = await prisma.$transaction(async tx => {
      // 1. Record reset in state history
      await tx.relationshipStateHistory.create({
        data: {
          relationshipId: existing.id,
          previousStage: existing.stage,
          newStage: 'STRANGER',
          previousFamiliarity: existing.familiarity,
          newFamiliarity: init.FAMILIARITY,
          previousTrust: existing.trust,
          newTrust: init.TRUST,
          previousComfort: existing.comfort,
          newComfort: init.COMFORT,
          previousAffection: existing.affection,
          newAffection: init.AFFECTION,
          previousEngagement: existing.engagement,
          newEngagement: init.ENGAGEMENT,
          reason: 'USER_INITIATED_RESET',
        },
      });

      // 2. Reset dimensions
      return tx.relationship.update({
        where: { id: existing.id },
        data: {
          stage: 'STRANGER',
          familiarity: init.FAMILIARITY,
          trust: init.TRUST,
          comfort: init.COMFORT,
          affection: init.AFFECTION,
          engagement: init.ENGAGEMENT,
          totalInteractions: 0,
          consecutiveDaysActive: 0,
          version: { increment: 1 },
        },
      });
    });

    // 3. Clear Redis Caches
    try {
      await Promise.all([
        redis.del(this.getCacheKey(userId, characterId)),
        EmotionalToneService.resetTone(userId, characterId),
      ]);
    } catch (err: any) {
      logger.warn(`Redis failed to flush relationship cache on reset: ${err.message}`);
    }

    return {
      id: resetRel.id,
      userId: resetRel.userId,
      characterId: resetRel.characterId,
      stage: resetRel.stage as RelationshipStage,
      familiarity: resetRel.familiarity,
      trust: resetRel.trust,
      comfort: resetRel.comfort,
      affection: resetRel.affection,
      engagement: resetRel.engagement,
      totalInteractions: resetRel.totalInteractions,
      consecutiveDaysActive: resetRel.consecutiveDaysActive,
      lastInteractionAt: resetRel.lastInteractionAt?.toISOString() || null,
      version: resetRel.version,
      createdAt: resetRel.createdAt.toISOString(),
      updatedAt: resetRel.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves user relationship & personalization settings
   */
  public static async getUserRelationshipSettings(userId: string): Promise<UserRelationshipSettingsData> {
    const settings = await prisma.userRelationshipSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        userId,
        personalizationEnabled: true,
        relationshipProgressionEnabled: true,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      userId: settings.userId,
      personalizationEnabled: settings.personalizationEnabled,
      relationshipProgressionEnabled: settings.relationshipProgressionEnabled,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  /**
   * Updates user relationship & personalization settings
   */
  public static async updateUserRelationshipSettings(
    userId: string,
    update: Partial<UserRelationshipSettingsData>,
  ): Promise<UserRelationshipSettingsData> {
    const saved = await prisma.userRelationshipSettings.upsert({
      where: { userId },
      create: {
        userId,
        personalizationEnabled: update.personalizationEnabled ?? true,
        relationshipProgressionEnabled: update.relationshipProgressionEnabled ?? true,
      },
      update: {
        personalizationEnabled: update.personalizationEnabled,
        relationshipProgressionEnabled: update.relationshipProgressionEnabled,
      },
    });

    return {
      userId: saved.userId,
      personalizationEnabled: saved.personalizationEnabled,
      relationshipProgressionEnabled: saved.relationshipProgressionEnabled,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /**
   * Lists relationships for the authenticated user
   */
  public static async listUserRelationships(
    userId: string,
    query: RelationshipListQueryOutput,
  ) {
    const { page, limit, stage } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (stage) where.stage = stage;

    const [items, total] = await Promise.all([
      prisma.relationship.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastInteractionAt: 'desc' },
        include: {
          character: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              tagline: true,
            },
          },
          milestones: {
            take: 5,
            orderBy: { achievedAt: 'desc' },
          },
        },
      }),
      prisma.relationship.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves auditable relationship transition history for admins
   */
  public static async getRelationshipHistory(relationshipId: string, limit = 50) {
    return prisma.relationshipStateHistory.findMany({
      where: { relationshipId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Aggregates platform-level relationship metrics for admin dashboard
   */
  public static async getRelationshipAnalytics(): Promise<RelationshipAnalyticsMetrics> {
    const [total, stagesGroup, averages, activeLast7Days, totalMilestones] = await Promise.all([
      prisma.relationship.count(),
      prisma.relationship.groupBy({
        by: ['stage'],
        _count: { _all: true },
      }),
      prisma.relationship.aggregate({
        _avg: {
          familiarity: true,
          trust: true,
          comfort: true,
          affection: true,
          engagement: true,
        },
      }),
      prisma.relationship.count({
        where: {
          lastInteractionAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.relationshipMilestone.count(),
    ]);

    const stageDistribution: Record<RelationshipStage, number> = {
      STRANGER: 0,
      ACQUAINTANCE: 0,
      FRIEND: 0,
      CLOSE_FRIEND: 0,
      CONFIDANT: 0,
      ROMANTIC_PARTNER: 0,
    };

    for (const s of stagesGroup) {
      if (s.stage in stageDistribution) {
        stageDistribution[s.stage as RelationshipStage] = s._count._all;
      }
    }

    return {
      totalRelationships: total,
      stageDistribution,
      averageFamiliarity: Math.round((averages._avg.familiarity || 0) * 10) / 10,
      averageTrust: Math.round((averages._avg.trust || 0) * 10) / 10,
      averageComfort: Math.round((averages._avg.comfort || 0) * 10) / 10,
      averageAffection: Math.round((averages._avg.affection || 0) * 10) / 10,
      averageEngagement: Math.round((averages._avg.engagement || 0) * 10) / 10,
      activeRelationshipsLast7Days: activeLast7Days,
      totalMilestonesAchieved: totalMilestones,
    };
  }
}
