import { prisma } from '../../../infrastructure/database/prisma.js';
import { ErrorCode } from '@ai-companion/config';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { Prisma } from '@prisma/client';
import type { CreatorAnalyticsOverview } from '@ai-companion/types';

interface CharacterStats {
  views: number;
  starts: number;
  activeConversations: number;
  messages: number;
  favorites: number;
  returnRatePercent: number;
  returningConversations: number;
  voiceUsageMinutes: number;
}

const EMPTY_STATS: CharacterStats = {
  views: 0,
  starts: 0,
  activeConversations: 0,
  messages: 0,
  favorites: 0,
  returnRatePercent: 0,
  returningConversations: 0,
  voiceUsageMinutes: 0,
};

/**
 * Real, aggregate-only engagement figures per character (counts only — no user ids or content).
 * - views: `character_viewed` analytics events
 * - starts: conversations (one per user–character pair)
 * - activeConversations: conversations with a message in the last 30 days
 * - returnRate: share of conversations where the user wrote on 2+ distinct days
 */
async function statsForCharacters(characterIds: string[]): Promise<Map<string, CharacterStats>> {
  const out = new Map<string, CharacterStats>(characterIds.map((id) => [id, { ...EMPTY_STATS }]));
  if (characterIds.length === 0) return out;
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [views, starts, active, favorites, voice, messages, returning] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['characterId'], where: { characterId: { in: characterIds }, eventName: 'character_viewed' }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ['characterId'], where: { characterId: { in: characterIds } }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ['characterId'], where: { characterId: { in: characterIds }, lastMessageAt: { gte: since30d } }, _count: { _all: true } }),
    prisma.userFavorite.groupBy({ by: ['characterId'], where: { characterId: { in: characterIds } }, _count: { _all: true } }),
    prisma.voiceSession.groupBy({ by: ['characterId'], where: { characterId: { in: characterIds } }, _sum: { totalDurationSeconds: true } }),
    prisma.$queryRaw<Array<{ character_id: string; messages: bigint }>>`
      SELECT c.character_id, COUNT(m.id) AS messages
      FROM conversations c JOIN messages m ON m.conversation_id = c.id
      WHERE c.character_id IN (${Prisma.join(characterIds.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY c.character_id`,
    prisma.$queryRaw<Array<{ character_id: string; returning: bigint }>>`
      SELECT character_id, COUNT(*) AS returning FROM (
        SELECT c.character_id, c.id
        FROM conversations c JOIN messages m ON m.conversation_id = c.id
        WHERE c.character_id IN (${Prisma.join(characterIds.map((id) => Prisma.sql`${id}::uuid`))})
          AND m.sender_type = 'USER'
        GROUP BY c.character_id, c.id
        HAVING COUNT(DISTINCT date_trunc('day', m.created_at)) >= 2
      ) r GROUP BY character_id`,
  ]);

  for (const v of views) if (v.characterId) out.get(v.characterId)!.views = v._count._all;
  for (const s of starts) out.get(s.characterId)!.starts = s._count._all;
  for (const a of active) out.get(a.characterId)!.activeConversations = a._count._all;
  for (const f of favorites) out.get(f.characterId)!.favorites = f._count._all;
  for (const v of voice) out.get(v.characterId)!.voiceUsageMinutes = Math.round((v._sum.totalDurationSeconds ?? 0) / 60);
  for (const m of messages) out.get(m.character_id)!.messages = Number(m.messages);
  for (const r of returning) out.get(r.character_id)!.returningConversations = Number(r.returning);
  for (const st of out.values()) {
    st.returnRatePercent = st.starts ? Number(((st.returningConversations / st.starts) * 100).toFixed(1)) : 0;
  }
  return out;
}

export class CreatorAnalyticsService {
  /**
   * Retrieves aggregated, privacy-preserving metrics across all characters owned by the creator.
   * Never exposes user emails, user IDs, private messages, or memory records.
   */
  public static async getCreatorAnalyticsOverview(
    creatorProfileId: string,
  ): Promise<CreatorAnalyticsOverview> {
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      include: {
        characters: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            status: true,
            characterReports: { select: { id: true } },
          },
        },
        followers: { select: { id: true } },
      },
    });

    if (!creator) {
      throw new NotFoundError('Creator profile not found', ErrorCode.NOT_FOUND);
    }

    const publishedCharacters = (creator.characters || []).filter((c: any) => c.status === 'PUBLISHED');
    const totalReports = (creator.characters || []).reduce((acc: number, c: any) => acc + (c.characterReports?.length || 0), 0);
    const stats = await statsForCharacters(publishedCharacters.map((c: any) => c.id));

    const characterBreakdown = publishedCharacters.map((c: any) => {
      const st = stats.get(c.id) ?? EMPTY_STATS;
      return {
        characterId: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl || '',
        views: st.views,
        starts: st.starts,
        messages: st.messages,
        favorites: st.favorites,
        returnRatePercent: st.returnRatePercent,
      };
    });

    const all = Array.from(stats.values());
    const sum = (k: keyof CharacterStats) => all.reduce((acc, st) => acc + st[k], 0);
    const totalStarts = sum('starts');

    return {
      totalViews: sum('views'),
      totalConversationStarts: totalStarts,
      totalActiveConversations: sum('activeConversations'),
      totalMessagesExchanged: sum('messages'),
      totalFavorites: sum('favorites'),
      averageSessionDurationMinutes: null,
      returnRatePercent: totalStarts ? Number(((sum('returningConversations') / totalStarts) * 100).toFixed(1)) : 0,
      voiceUsageMinutes: sum('voiceUsageMinutes'),
      totalReports,
      characterBreakdown,
    };
  }

  /**
   * Retrieves aggregated metrics for a single creator-owned character.
   */
  public static async getCharacterAnalytics(
    creatorProfileId: string,
    characterId: string,
  ) {
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId,
        deletedAt: null,
      },
      include: {
        characterReports: { select: { id: true } },
      },
    });

    if (!character) {
      throw new NotFoundError('Character not found or ownership mismatch', ErrorCode.NOT_FOUND);
    }

    const reportCount = character.characterReports?.length || 0;
    const st = (await statsForCharacters([character.id])).get(character.id) ?? EMPTY_STATS;

    return {
      characterId: character.id,
      name: character.name,
      status: character.status,
      views: st.views,
      starts: st.starts,
      conversations: st.activeConversations,
      messages: st.messages,
      returnRatePercent: st.returnRatePercent,
      favoritesCount: st.favorites,
      voiceUsageMinutes: st.voiceUsageMinutes,
      // Media generation is not attributed per character yet.
      mediaGenerations: 0,
      reportsCount: reportCount,
    };
  }
}
