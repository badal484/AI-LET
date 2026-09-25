import crypto from 'crypto';
import { CharacterRuntimeSnapshotItem } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';

export interface CreateSnapshotInput {
  conversationId: string;
  messageId?: string;
  characterId: string;
  characterVersionId: string;
  promptVersion: string;
  behaviorPolicyData?: Record<string, unknown>;
  safetyPolicyVersion?: string;
  modelId: string;
  memoryIds?: string[];
  relationshipStage?: string | null;
  activeGoalId?: string | null;
  activeTaskId?: string | null;
  selectedSkillSlugs?: string[];
  contextAttribution?: Record<string, unknown>;
  tokensPrompt?: number;
  tokensCompletion?: number;
  costUsd?: number;
}

export class CharacterRuntimeSnapshotService {
  private static instance: CharacterRuntimeSnapshotService;

  private constructor() {}

  public static getInstance(): CharacterRuntimeSnapshotService {
    if (!CharacterRuntimeSnapshotService.instance) {
      CharacterRuntimeSnapshotService.instance = new CharacterRuntimeSnapshotService();
    }
    return CharacterRuntimeSnapshotService.instance;
  }

  /**
   * Captures an immutable runtime snapshot of the generation parameters, models, policies, and contexts.
   */
  public async captureSnapshot(input: CreateSnapshotInput): Promise<CharacterRuntimeSnapshotItem> {
    const behaviorPolicyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input.behaviorPolicyData || {}))
      .digest('hex')
      .slice(0, 32);

    const snapshot = await prisma.characterRuntimeSnapshot.create({
      data: {
        conversationId: input.conversationId,
        messageId: input.messageId || null,
        characterId: input.characterId,
        characterVersionId: input.characterVersionId,
        promptVersion: input.promptVersion,
        behaviorPolicyHash,
        safetyPolicyVersion: input.safetyPolicyVersion || 'v1.0.0',
        modelId: input.modelId,
        memoryIds: (input.memoryIds as any) || [],
        relationshipStage: input.relationshipStage || null,
        activeGoalId: input.activeGoalId || null,
        activeTaskId: input.activeTaskId || null,
        selectedSkillSlugs: (input.selectedSkillSlugs as any) || [],
        contextAttribution: (input.contextAttribution as any) || undefined,
        tokensPrompt: input.tokensPrompt || 0,
        tokensCompletion: input.tokensCompletion || 0,
        costUsd: input.costUsd || 0.0,
      },
    });

    logger.debug(`CharacterRuntimeSnapshot: saved snapshot '${snapshot.id}' for message '${input.messageId}'`);
    return this.mapToItem(snapshot);
  }

  /**
   * Explains generation provenance given a messageId or conversationId.
   */
  public async explainGeneration(messageId: string, ownerUserId?: string): Promise<CharacterRuntimeSnapshotItem | null> {
    const snapshot = await prisma.characterRuntimeSnapshot.findFirst({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) return null;

    // End users may only explain generations from their own conversations (same "not found" answer
    // either way, so message ids cannot be probed). Operators call this without an owner.
    if (ownerUserId !== undefined) {
      const owned = await prisma.conversation.findFirst({
        where: { id: snapshot.conversationId, userId: ownerUserId },
        select: { id: true },
      });
      if (!owned) return null;
    }

    return this.mapToItem(snapshot);
  }

  /**
   * Retrieves snapshot by unique ID.
   */
  public async getSnapshot(id: string): Promise<CharacterRuntimeSnapshotItem | null> {
    const snapshot = await prisma.characterRuntimeSnapshot.findUnique({
      where: { id },
    });

    return snapshot ? this.mapToItem(snapshot) : null;
  }

  private mapToItem(record: any): CharacterRuntimeSnapshotItem {
    return {
      id: record.id,
      conversationId: record.conversationId,
      messageId: record.messageId,
      characterId: record.characterId,
      characterVersionId: record.characterVersionId,
      promptVersion: record.promptVersion,
      behaviorPolicyHash: record.behaviorPolicyHash,
      safetyPolicyVersion: record.safetyPolicyVersion,
      modelId: record.modelId,
      memoryIds: record.memoryIds as string[],
      relationshipStage: record.relationshipStage,
      activeGoalId: record.activeGoalId,
      activeTaskId: record.activeTaskId,
      selectedSkillSlugs: record.selectedSkillSlugs as string[],
      contextAttribution: record.contextAttribution as Record<string, unknown> | null,
      tokensPrompt: record.tokensPrompt,
      tokensCompletion: record.tokensCompletion,
      costUsd: record.costUsd,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
