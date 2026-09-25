import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type { CharacterStatus, CharacterVisibility } from '@ai-companion/types';

export interface EligibilityUserContext {
  userId?: string;
  userAge?: number;
  userLocale?: string;
  userEntitlements?: string[];
  includeUnlisted?: boolean;
}

export class CharacterEligibilityService {
  /**
   * Filters a list of character IDs in batch against all eligibility, safety, moderation,
   * creator suspension, user blocking, and negative signal rules.
   */
  public static async filterEligible(
    characterIds: string[],
    context: EligibilityUserContext = {},
  ): Promise<string[]> {
    if (!characterIds || characterIds.length === 0) return [];

    try {
      const visibilityList: CharacterVisibility[] = ['PUBLIC'];
      if (context.includeUnlisted) {
        visibilityList.push('UNLISTED');
      }

      // 1. Fetch character records with creator and discovery config
      const characters = await prisma.character.findMany({
        where: {
          id: { in: characterIds },
          status: 'PUBLISHED' as CharacterStatus,
          moderationStatus: { in: ['APPROVED', 'DRAFT', 'IN_REVIEW', 'PENDING'] },
          visibility: { in: visibilityList },
          deletedAt: null,
          archivedAt: null,
        },
        include: {
          creatorProfile: {
            select: { id: true, status: true },
          },
          discoveryConfig: {
            select: { isDiscoverable: true, ageGate: true },
          },
        },
      });

      // Filter out characters whose creator is suspended or banned
      let eligible = characters.filter(char => {
        if (char.creatorProfile) {
          if (char.creatorProfile.status === 'SUSPENDED' || char.creatorProfile.status === 'BANNED') {
            return false;
          }
        }
        if (char.discoveryConfig && !char.discoveryConfig.isDiscoverable) {
          return false;
        }
        if (char.discoveryConfig?.ageGate && context.userAge !== undefined && context.userAge < char.discoveryConfig.ageGate) {
          return false;
        }
        return true;
      });

      // 2. If user is authenticated, check UserBlock and UserNegativeSignal
      if (context.userId && eligible.length > 0) {
        const charIdList = eligible.map(c => c.id);
        const creatorIdList = eligible.map(c => c.creatorProfileId).filter(Boolean) as string[];

        const [blocks, negativeSignals] = await Promise.all([
          prisma.userBlock.findMany({
            where: {
              userId: context.userId,
              OR: [
                { blockedCharacterId: { in: charIdList } },
                { blockedCreatorId: { in: creatorIdList } },
              ],
            },
            select: { blockedCharacterId: true, blockedCreatorId: true },
          }),
          prisma.userNegativeSignal.findMany({
            where: {
              userId: context.userId,
              OR: [
                { characterId: { in: charIdList }, signalType: 'HIDE_CHARACTER' },
                { creatorProfileId: { in: creatorIdList }, signalType: 'HIDE_CREATOR' },
              ],
            },
            select: { characterId: true, creatorProfileId: true },
          }),
        ]);

        const blockedCharIds = new Set([
          ...blocks.map(b => b.blockedCharacterId).filter(Boolean),
          ...negativeSignals.map(n => n.characterId).filter(Boolean),
        ]);

        const blockedCreatorIds = new Set([
          ...blocks.map(b => b.blockedCreatorId).filter(Boolean),
          ...negativeSignals.map(n => n.creatorProfileId).filter(Boolean),
        ]);

        eligible = eligible.filter(char => {
          if (blockedCharIds.has(char.id)) return false;
          if (char.creatorProfileId && blockedCreatorIds.has(char.creatorProfileId)) return false;
          return true;
        });
      }

      const eligibleSet = new Set(eligible.map(c => c.id));
      // Preserve initial candidate ordering
      return characterIds.filter(id => eligibleSet.has(id));
    } catch (err) {
      logger.error('Error during batch character eligibility check', { err });
      return [];
    }
  }

  /**
   * Validates if a single character is eligible for discovery.
   */
  public static async isCharacterEligible(
    characterId: string,
    context: EligibilityUserContext = {},
  ): Promise<{ eligible: boolean; reason?: string; character?: any }> {
    const eligibleIds = await this.filterEligible([characterId], context);
    if (eligibleIds.length > 0) {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: { discoveryConfig: true, currentPublishedVersion: true, creatorProfile: true },
      });
      return { eligible: true, character };
    }
    return { eligible: false, reason: 'INELIGIBLE_OR_RESTRICTED' };
  }
}
