import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type { CharacterStatus, CharacterVisibility } from '@ai-companion/types';

export interface EligibilityContext {
  userId?: string;
  userAge?: number;
  userLocale?: string;
  userEntitlements?: string[];
  includeUnlisted?: boolean;
}

export class CharacterDiscoveryEligibilityService {
  /**
   * Builds the standard Prisma `where` clause for publicly discoverable characters.
   */
  public static getPublicEligibilityWhereClause(context: EligibilityContext = {}): Record<string, any> {
    const visibilityList: CharacterVisibility[] = ['PUBLIC'];
    if (context.includeUnlisted) {
      visibilityList.push('UNLISTED');
    }

    const where: Record<string, any> = {
      status: 'PUBLISHED' as CharacterStatus,
      visibility: { in: visibilityList },
      deletedAt: null,
      archivedAt: null,
      currentPublishedVersionId: { not: null },
    };

    // If character discovery config exists, ensure discoverable is true
    where['OR'] = [
      { discoveryConfig: null },
      {
        discoveryConfig: {
          isDiscoverable: true,
        },
      },
    ];

    return where;
  }

  /**
   * Validates if a single character is eligible for public discovery and chat initiation.
   */
  public static async isCharacterEligible(
    characterId: string,
    context: EligibilityContext = {},
  ): Promise<{ eligible: boolean; reason?: string; character?: any }> {
    try {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          discoveryConfig: true,
          currentPublishedVersion: true,
        },
      });

      if (!character) {
        return { eligible: false, reason: 'CHARACTER_NOT_FOUND' };
      }

      if (character.status !== 'PUBLISHED') {
        return { eligible: false, reason: 'NOT_PUBLISHED' };
      }

      if (character.deletedAt || character.archivedAt) {
        return { eligible: false, reason: 'ARCHIVED_OR_DELETED' };
      }

      if (!context.includeUnlisted && character.visibility !== 'PUBLIC') {
        return { eligible: false, reason: 'VISIBILITY_RESTRICTED' };
      }

      if (!character.currentPublishedVersionId || !character.currentPublishedVersion) {
        return { eligible: false, reason: 'NO_PUBLISHED_VERSION' };
      }

      if (character.discoveryConfig && !character.discoveryConfig.isDiscoverable) {
        return { eligible: false, reason: 'DISCOVERY_DISABLED' };
      }

      // Age gate check
      if (character.discoveryConfig?.ageGate && character.discoveryConfig.ageGate > 0) {
        if (context.userAge !== undefined && context.userAge < character.discoveryConfig.ageGate) {
          return { eligible: false, reason: 'AGE_GATE_RESTRICTED' };
        }
      }

      return { eligible: true, character };
    } catch (err) {
      logger.error(`[CharacterDiscoveryEligibilityService] Error checking eligibility for ${characterId}: ${(err as Error).message}`);
      return { eligible: false, reason: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Determines if a character is locked behind an entitlement for a specific user.
   */
  public static isCharacterLocked(
    character: { accessType: string; requiredEntitlement?: string | null },
    userEntitlements: string[] = [],
  ): boolean {
    if (character.accessType === 'free') {
      return false;
    }

    if (character.accessType === 'entitlement' || character.accessType === 'subscription') {
      if (!character.requiredEntitlement) {
        // If it requires general PRO entitlement
        return !userEntitlements.includes('unlimited_messages') && !userEntitlements.includes('pro_access');
      }
      return !userEntitlements.includes(character.requiredEntitlement);
    }

    return false;
  }
}
