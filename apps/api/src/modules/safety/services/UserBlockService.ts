import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import type { UserBlockCreateInput, UserBlockItem } from '@ai-companion/types';

export class UserBlockService {
  /**
   * Blocks a character, creator, or other user.
   */
  public static async blockTarget(userId: string, input: UserBlockCreateInput): Promise<UserBlockItem> {
    const block = await prisma.userBlock.create({
      data: {
        userId,
        blockedUserId: input.blockedUserId,
        blockedCharacterId: input.blockedCharacterId,
        blockedCreatorId: input.blockedCreatorId,
        reason: input.reason,
      },
      include: {
        blockedCharacter: true,
        blockedCreator: true,
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'USER_BLOCK_CREATED',
      resourceType: 'user_block',
      resourceId: block.id,
      metadata: {
        blockedUserId: input.blockedUserId,
        blockedCharacterId: input.blockedCharacterId,
        blockedCreatorId: input.blockedCreatorId,
        reason: input.reason,
      },
    });

    return {
      id: block.id,
      userId: block.userId,
      blockedUserId: block.blockedUserId,
      blockedCharacterId: block.blockedCharacterId,
      blockedCreatorId: block.blockedCreatorId,
      targetName: block.blockedCharacter?.name || block.blockedCreator?.displayName || 'User',
      reason: block.reason,
      createdAt: block.createdAt.toISOString(),
    };
  }

  /**
   * Unblocks a previously blocked target.
   */
  public static async unblockTarget(userId: string, blockId: string): Promise<void> {
    const block = await prisma.userBlock.findUnique({
      where: { id: blockId },
    });

    if (block && block.userId === userId) {
      await prisma.userBlock.delete({
        where: { id: blockId },
      });

      await AuditService.log({
        actorType: 'USER',
        actorId: userId,
        action: 'USER_BLOCK_REMOVED',
        resourceType: 'user_block',
        resourceId: blockId,
      });
    }
  }

  /**
   * Lists all blocks created by a user.
   */
  public static async getBlockedList(userId: string): Promise<UserBlockItem[]> {
    const blocks = await prisma.userBlock.findMany({
      where: { userId },
      include: {
        blockedCharacter: true,
        blockedCreator: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map(b => ({
      id: b.id,
      userId: b.userId,
      blockedUserId: b.blockedUserId,
      blockedCharacterId: b.blockedCharacterId,
      blockedCreatorId: b.blockedCreatorId,
      targetName: b.blockedCharacter?.name || b.blockedCreator?.displayName || 'User',
      reason: b.reason,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  /**
   * Checks whether a character or creator is blocked by user.
   */
  public static async isBlocked(
    userId: string,
    target: { characterId?: string; creatorId?: string; targetUserId?: string },
  ): Promise<boolean> {
    const orConditions: any[] = [];
    if (target.characterId) orConditions.push({ blockedCharacterId: target.characterId });
    if (target.creatorId) orConditions.push({ blockedCreatorId: target.creatorId });
    if (target.targetUserId) orConditions.push({ blockedUserId: target.targetUserId });

    if (orConditions.length === 0) return false;

    const existing = await prisma.userBlock.findFirst({
      where: {
        userId,
        OR: orConditions,
      },
    });

    return !!existing;
  }

  /**
   * Filters out blocked characters from discovery or recommendation list.
   */
  public static async filterBlockedCharacters(userId: string, characterIds: string[]): Promise<string[]> {
    if (characterIds.length === 0) return [];

    const blocks = await prisma.userBlock.findMany({
      where: {
        userId,
        blockedCharacterId: { in: characterIds },
      },
      select: { blockedCharacterId: true },
    });

    const blockedSet = new Set(blocks.map(b => b.blockedCharacterId));
    return characterIds.filter(id => !blockedSet.has(id));
  }
}
