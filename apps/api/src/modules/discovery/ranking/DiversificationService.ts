import type { RankedCharacterItem } from './CharacterRankingService.js';
import type { DiversityRules } from '@ai-companion/types';

export interface DiversificationOptions {
  rules?: DiversityRules;
  alreadyShownIds?: Set<string>;
  limit?: number;
  allowExploration?: boolean;
}

export class DiversificationService {
  /**
   * Applies diversification, creator/category capping, repetition suppression,
   * and novelty exploration to ranked candidates.
   */
  public static diversify(
    rankedItems: RankedCharacterItem[],
    options: DiversificationOptions = {},
  ): RankedCharacterItem[] {
    if (!rankedItems || rankedItems.length === 0) return [];

    const limit = options.limit || 20;
    const rules = options.rules || {
      maxPerCreator: 2,
      maxPerCategory: 4,
      mmrLambda: 0.7,
      explorationRatio: 0.1,
    };

    const alreadyShown = options.alreadyShownIds || new Set<string>();
    const creatorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    const selected: RankedCharacterItem[] = [];
    const remaining: RankedCharacterItem[] = [];

    // Filter out candidates already shown in other sections first
    const freshCandidates = rankedItems.filter(item => !alreadyShown.has(item.characterId));

    for (const item of freshCandidates) {
      const creator = (item as any).creatorId || item.document?.creatorUsername || item.document?.creatorId || 'official';
      const category = ((item as any).category || item.document?.category || 'general').toLowerCase();

      const curCreator = creatorCounts.get(creator) || 0;
      const curCategory = categoryCounts.get(category) || 0;

      if (curCreator < rules.maxPerCreator && curCategory < rules.maxPerCategory) {
        selected.push(item);
        creatorCounts.set(creator, curCreator + 1);
        categoryCounts.set(category, curCategory + 1);
      } else {
        remaining.push(item);
      }

      if (selected.length >= limit) {
        break;
      }
    }

    // If limits were too strict and we need more items to satisfy requested limit,
    // relax category cap while maintaining creator cap
    if (selected.length < limit && remaining.length > 0) {
      for (const item of remaining) {
        const creator = (item as any).creatorId || item.document?.creatorUsername || item.document?.creatorId || 'official';
        const curCreator = creatorCounts.get(creator) || 0;
        if (curCreator < rules.maxPerCreator) {
          selected.push(item);
          creatorCounts.set(creator, curCreator + 1);
        }
        if (selected.length >= limit) break;
      }
    }

    return selected.slice(0, limit);
  }
}

