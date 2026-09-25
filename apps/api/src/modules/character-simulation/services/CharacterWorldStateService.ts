import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import type {
  CharacterWorldStateItem,
  CharacterWorldStateEventItem,
  WorldEntityType,
  WorldStateEventType,
} from '@ai-companion/types';

export interface UpsertWorldStateInput {
  characterId: string;
  userId?: string | null;
  characterVersionId?: string | null;
  entityKey: string;
  entityType: WorldEntityType;
  stateValue: Record<string, unknown>;
  eventType?: WorldStateEventType;
  source?: string;
}

export class CharacterWorldStateService {
  private static instance: CharacterWorldStateService;

  private constructor() {}

  public static getInstance(): CharacterWorldStateService {
    if (!CharacterWorldStateService.instance) {
      CharacterWorldStateService.instance = new CharacterWorldStateService();
    }
    return CharacterWorldStateService.instance;
  }

  /**
   * Upserts a world state entity with atomic event logging.
   */
  public async setEntityState(input: UpsertWorldStateInput): Promise<CharacterWorldStateItem> {
    if (!input.entityKey || input.entityKey.trim().length === 0) {
      throw new ValidationError('entityKey is required.');
    }

    const userIdKey = input.userId || null;
    const eventType = input.eventType || 'CUSTOM_EVENT';
    const source = input.source || 'SIMULATION';

    let resultItem: CharacterWorldStateItem;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.characterWorldState.findFirst({
        where: {
          characterId: input.characterId,
          userId: userIdKey,
          entityKey: input.entityKey,
        },
      });

      const nextVersion = existing ? existing.version + 1 : 1;

      // 1. Log immutable world state event
      const event = await tx.characterWorldStateEvent.create({
        data: {
          characterId: input.characterId,
          userId: userIdKey,
          characterVersionId: input.characterVersionId || null,
          eventType,
          entityKey: input.entityKey,
          delta: input.stateValue as any,
          source,
          version: nextVersion,
        },
      });

      // 2. Upsert entity state
      let updated;
      if (existing) {
        updated = await tx.characterWorldState.update({
          where: { id: existing.id },
          data: {
            entityType: input.entityType,
            stateValue: input.stateValue as any,
            version: nextVersion,
            lastEventId: event.id,
            characterVersionId: input.characterVersionId || existing.characterVersionId,
          },
        });
      } else {
        updated = await tx.characterWorldState.create({
          data: {
            characterId: input.characterId,
            userId: userIdKey,
            characterVersionId: input.characterVersionId || null,
            entityKey: input.entityKey,
            entityType: input.entityType,
            stateValue: input.stateValue as any,
            version: nextVersion,
            lastEventId: event.id,
          },
        });
      }

      // 3. Emit simulation event
      await tx.characterSimulationEvent.create({
        data: {
          characterId: input.characterId,
          userId: userIdKey,
          characterVersionId: input.characterVersionId || null,
          eventType: `character.world_state.${eventType.toLowerCase()}.v1`,
          source: 'WORLD_EVENT' as any,
          payload: { entityKey: input.entityKey, entityType: input.entityType, version: nextVersion } as any,
          stateVersion: nextVersion,
        },
      });

      resultItem = this.mapToItem(updated);
    });

    logger.info(`CharacterWorldStateService: updated entity '${input.entityKey}' for character '${input.characterId}'`);
    return resultItem!;
  }

  /**
   * Retrieves an entity state.
   */
  public async getEntityState(
    characterId: string,
    entityKey: string,
    userId?: string | null
  ): Promise<CharacterWorldStateItem | null> {
    const state = await prisma.characterWorldState.findFirst({
      where: {
        characterId,
        userId: userId || null,
        entityKey,
      },
    });

    return state ? this.mapToItem(state) : null;
  }

  /**
   * Lists active world states for a character and optional user context.
   */
  public async listWorldStates(
    characterId: string,
    userId?: string | null
  ): Promise<CharacterWorldStateItem[]> {
    const states = await prisma.characterWorldState.findMany({
      where: {
        characterId,
        OR: [
          { userId: null }, // Character-global
          ...(userId ? [{ userId }] : []), // User-specific
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return states.map((s) => this.mapToItem(s));
  }

  /**
   * Lists recent world state events.
   */
  public async listRecentEvents(
    characterId: string,
    userId?: string | null,
    limit: number = 10
  ): Promise<CharacterWorldStateEventItem[]> {
    const events = await prisma.characterWorldStateEvent.findMany({
      where: {
        characterId,
        OR: [
          { userId: null },
          ...(userId ? [{ userId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      characterId: e.characterId,
      userId: e.userId,
      characterVersionId: e.characterVersionId,
      eventType: e.eventType as WorldStateEventType,
      entityKey: e.entityKey,
      delta: e.delta as Record<string, unknown>,
      source: e.source,
      version: e.version,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  private mapToItem(record: any): CharacterWorldStateItem {
    return {
      id: record.id,
      characterId: record.characterId,
      userId: record.userId,
      characterVersionId: record.characterVersionId,
      entityKey: record.entityKey,
      entityType: record.entityType as WorldEntityType,
      stateValue: record.stateValue as Record<string, unknown>,
      version: record.version,
      lastEventId: record.lastEventId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
