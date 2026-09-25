/**
 * Pure ranking for the social feed. No I/O, fully unit-testable.
 *
 * Deliberately does NOT optimize for time-spent, scroll depth or notification clicks.
 * Score = relationship strength + freshness + quality + explicit interest
 *         − fatigue − negative feedback, followed by a diversity pass.
 */
export interface FeedCandidate {
  id: string;
  authorId: string | null;
  characterId: string | null;
  communityId: string | null;
  topics: string[];
  publishedAt: Date;
  reactionCount: number;
  commentCount: number;
  isAiGenerated: boolean;
  /** Why the candidate was retrieved. */
  source: 'FOLLOWED_USER' | 'FOLLOWED_CREATOR' | 'FOLLOWED_CHARACTER' | 'COMMUNITY' | 'PUBLIC_DISCOVERY';
}

export interface FeedRankingSignals {
  now: Date;
  /** Recent exposures per author/character/topic key (from impression tracking). */
  exposures: Map<string, number>;
  /** Explicit "show less" targets (author:, character:, topic:, community:). */
  showLess: Set<string>;
  /** Explicit interests (topic:, character:) e.g. from followed characters' categories. */
  interests: Set<string>;
  freshnessHalfLifeHours: number;
  maxItemsPerAuthor: number;
}

export interface RankedCandidate {
  candidate: FeedCandidate;
  score: number;
  components: Record<string, number>;
}

const RELATIONSHIP_WEIGHT: Record<FeedCandidate['source'], number> = {
  FOLLOWED_USER: 1.0,
  FOLLOWED_CREATOR: 0.9,
  FOLLOWED_CHARACTER: 0.8,
  COMMUNITY: 0.7,
  PUBLIC_DISCOVERY: 0.2,
};

export class SocialFeedRankingService {
  public static score(c: FeedCandidate, s: FeedRankingSignals): RankedCandidate {
    const ageHours = Math.max(0, (s.now.getTime() - c.publishedAt.getTime()) / 3_600_000);
    const relationship = RELATIONSHIP_WEIGHT[c.source];
    const freshness = Math.pow(0.5, ageHours / s.freshnessHalfLifeHours);
    // Log-dampened so a few viral items can't dominate; comments are not treated as "better" per se.
    const quality = Math.min(1, Math.log1p(c.reactionCount + c.commentCount) / Math.log1p(200));
    const interest =
      (c.characterId && s.interests.has(`character:${c.characterId}`) ? 0.3 : 0) +
      (c.topics.some((t) => s.interests.has(`topic:${t}`)) ? 0.2 : 0);

    const keys = [
      c.authorId ? `author:${c.authorId}` : null,
      c.characterId ? `character:${c.characterId}` : null,
      c.communityId ? `community:${c.communityId}` : null,
      ...c.topics.map((t) => `topic:${t}`),
    ].filter((k): k is string => !!k);

    const exposure = keys.reduce((n, k) => n + (s.exposures.get(k) ?? 0), 0);
    const fatigue = Math.min(0.6, exposure * 0.08);
    const negative = keys.some((k) => s.showLess.has(k)) ? 0.5 : 0;

    const components = {
      relationship: relationship * 1.0,
      freshness: freshness * 0.8,
      quality: quality * 0.4,
      interest,
      fatigue: -fatigue,
      negative: -negative,
    };
    const score = Object.values(components).reduce((a, b) => a + b, 0);
    return { candidate: c, score: Number(score.toFixed(4)), components };
  }

  /**
   * Scores, sorts, then applies diversity page by page: at most `maxItemsPerAuthor` items per author
   * per page, and no two consecutive items from the same author when an alternative exists.
   * Items deferred by the cap flow to later pages (never dropped, never forced over the cap).
   */
  public static rank(candidates: FeedCandidate[], s: FeedRankingSignals, pageSize: number): RankedCandidate[] {
    const pool = candidates
      .map((c) => this.score(c, s))
      .sort((a, b) => b.score - a.score || b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime());
    const authorKey = (r: RankedCandidate) => r.candidate.authorId ?? `anon:${r.candidate.id}`;
    const cap = Math.max(1, s.maxItemsPerAuthor); // a 0 cap would never make progress
    const size = Math.max(1, pageSize);
    const result: RankedCandidate[] = [];

    while (pool.length > 0) {
      const perAuthor = new Map<string, number>();
      const page: RankedCandidate[] = [];
      while (page.length < size) {
        const underCap = (r: RankedCandidate) => (perAuthor.get(authorKey(r)) ?? 0) < cap;
        const prev = page[page.length - 1];
        let idx = pool.findIndex((r) => underCap(r) && (!prev || authorKey(prev) !== authorKey(r)));
        if (idx === -1) idx = pool.findIndex(underCap);
        if (idx === -1) break; // only capped authors left: end this page early
        const [chosen] = pool.splice(idx, 1);
        perAuthor.set(authorKey(chosen!), (perAuthor.get(authorKey(chosen!)) ?? 0) + 1);
        page.push(chosen!);
      }
      result.push(...page);
    }
    return result;
  }
}
