import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { CreatorAnalyticsService } from '../../src/modules/creators/services/CreatorAnalyticsService.js';
import { createCharacter, createConversation, createUser, makeCreator } from '../social/fixtures.js';

describe('creator analytics are computed from real activity', () => {
  it('counts views, starts, messages, favorites and returning conversations; zero for a new character', async () => {
    const owner = await createUser();
    const creator = await makeCreator(owner.id);
    const ch = await createCharacter({ creatorProfileId: creator.id });
    const quiet = await createCharacter({ creatorProfileId: creator.id });

    const fresh = await CreatorAnalyticsService.getCharacterAnalytics(creator.id, quiet.id);
    expect(fresh).toMatchObject({ views: 0, starts: 0, messages: 0, favoritesCount: 0, returnRatePercent: 0 });

    const a = await createUser();
    const b = await createUser();
    const convA = await createConversation(a.id, ch.id, [['USER', 'hi'], ['CHARACTER', 'hello']]);
    await createConversation(b.id, ch.id, [['USER', 'hey']]);
    // User A comes back on a second day.
    await prisma.message.create({
      data: { conversationId: convA.conversationId, senderType: 'USER', role: 'user', content: 'back again', status: 'COMPLETED', createdAt: new Date(Date.now() - 2 * 86_400_000) },
    });
    await prisma.userFavorite.create({ data: { userId: a.id, characterId: ch.id } });
    await prisma.analyticsEvent.createMany({
      data: [1, 2, 3].map(() => ({ eventName: 'character_viewed', characterId: ch.id, userId: a.id, timestamp: new Date() })),
    });

    const stats = await CreatorAnalyticsService.getCharacterAnalytics(creator.id, ch.id);
    expect(stats.views).toBe(3);
    expect(stats.starts).toBe(2);
    expect(stats.messages).toBe(4);
    expect(stats.favoritesCount).toBe(1);
    expect(stats.returnRatePercent).toBe(50);

    const overview = await CreatorAnalyticsService.getCreatorAnalyticsOverview(creator.id);
    expect(overview.totalConversationStarts).toBe(2);
    expect(overview.totalMessagesExchanged).toBe(4);
    expect(overview.averageSessionDurationMinutes).toBeNull();
    expect(overview.characterBreakdown.find((c) => c.characterId === ch.id)?.views).toBe(3);
  });
});
