import type { RelationshipDimensions } from '@ai-companion/types';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class RelationshipDecayService {
  /**
   * Calculates time-based decay for an inactive relationship.
   * Trust is permanent and stable. Engagement and familiarity decay smoothly
   * without destructive erasure of history.
   */
  public static calculateDecayedDimensions(
    dimensions: RelationshipDimensions,
    lastInteractionAt: Date | string | null | undefined,
  ): RelationshipDimensions {
    if (!lastInteractionAt) {
      return { ...dimensions };
    }

    const lastDate = typeof lastInteractionAt === 'string' ? new Date(lastInteractionAt) : lastInteractionAt;
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // Inactive under 7 days has zero decay
    if (diffDays <= 7) {
      return { ...dimensions };
    }

    const inactiveDaysPastGrace = diffDays - 7;

    // 1. Engagement Decay: 5% per inactive day past grace period, floor at 30
    const engagementDrop = inactiveDaysPastGrace * (SYSTEM_CONSTANTS.RELATIONSHIP.DECAY_RATES.ENGAGEMENT_DAILY * 100);
    const decayedEngagement = Math.max(30, dimensions.engagement - engagementDrop);

    // 2. Familiarity Decay: 1% per 30 days past 30 days, floor at 10
    let decayedFamiliarity = dimensions.familiarity;
    if (diffDays > 30) {
      const monthsInactive = (diffDays - 30) / 30;
      const familiarityDrop = monthsInactive * (SYSTEM_CONSTANTS.RELATIONSHIP.DECAY_RATES.FAMILIARITY_MONTHLY * 100);
      decayedFamiliarity = Math.max(10, dimensions.familiarity - familiarityDrop);
    }

    // 3. Comfort Decay: Very slight past 60 days, floor at 15
    let decayedComfort = dimensions.comfort;
    if (diffDays > 60) {
      const monthsInactive = (diffDays - 60) / 30;
      decayedComfort = Math.max(15, dimensions.comfort - monthsInactive * 0.5);
    }

    // 4. Affection Decay: Very slight past 60 days, floor at 10
    let decayedAffection = dimensions.affection;
    if (diffDays > 60) {
      const monthsInactive = (diffDays - 60) / 30;
      decayedAffection = Math.max(10, dimensions.affection - monthsInactive * 0.5);
    }

    // 5. Trust: 0 decay (Trust is earned and retained)
    const decayedTrust = dimensions.trust;

    return {
      familiarity: Math.round(decayedFamiliarity * 10) / 10,
      trust: Math.round(decayedTrust * 10) / 10,
      comfort: Math.round(decayedComfort * 10) / 10,
      affection: Math.round(decayedAffection * 10) / 10,
      engagement: Math.round(decayedEngagement * 10) / 10,
    };
  }
}
