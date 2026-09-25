import type { SocialCursorPage, SocialUserCard } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { PrivacyPolicyService } from '../identity/PrivacyPolicyService.js';
import { UsernameService } from '../identity/UsernameService.js';
import { RelationshipReader } from '../graph/RelationshipReader.js';
import { decodeCursor, keysetAfter, toPage } from '../shared/ids.js';

export interface SocialRecommendations {
  creators: Array<SocialUserCard & { reason: string }>;
  people: Array<SocialUserCard & { reason: string }>;
  communities: Array<{ slug: string; name: string; memberCount: number; reason: string }>;
}

/**
 * Social search and "people/creators/communities you may like".
 *
 * Uses only explicit, non-sensitive platform signals (follows, favorites, character follows,
 * shared public communities). Never uses private conversations, contact books, location, or
 * inferred sensitive attributes. Respects each person's `searchable` / `discoverable` settings.
 */
export class SocialDiscoveryService {
  public static async searchUsers(viewerId: string | null, q: string, cursor: string | undefined, limit: number): Promise<SocialCursorPage<SocialUserCard>> {
    await SocialPolicyService.assertFeature('social_search', { userId: viewerId });
    const normalized = UsernameService.normalize(q);
    const hidden = viewerId ? await RelationshipReader.blockedEitherWaySet(viewerId) : new Set<string>();
    const rows = await prisma.socialProfile.findMany({
      where: {
        status: 'ACTIVE',
        user: { deletedAt: null, status: 'ACTIVE' },
        // Private accounts and people who opted out of search never appear.
        OR: [{ username: { startsWith: normalized } }, { displayName: { contains: q, mode: 'insensitive' } }],
        AND: [
          { OR: [{ user: { socialPrivacySettings: { is: null } } }, { user: { socialPrivacySettings: { is: { searchable: true, profileVisibility: { not: 'PRIVATE' } } } } }] },
          ...(hidden.size ? [{ userId: { notIn: [...hidden] } }] : []),
          keysetAfter(decodeCursor(cursor)),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // Response minimization + scraping resistance: small pages only.
      take: Math.min(limit, 20) + 1,
      select: { id: true, userId: true, createdAt: true },
    });
    const page = toPage(rows, Math.min(limit, 20), (r) => ({ at: r.createdAt, id: r.id }));
    const cards = await SocialProfileService.cards(page.items.map((r) => r.userId));
    return { items: page.items.map((r) => cards.get(r.userId)).filter((c): c is SocialUserCard => !!c), nextCursor: page.nextCursor };
  }

  public static async recommendations(userId: string): Promise<SocialRecommendations> {
    const empty: SocialRecommendations = { creators: [], people: [], communities: [] };
    if (!(await SocialPolicyService.isFeatureEnabled('social_recommendations', { userId }))) return empty;
    const mySettings = await PrivacyPolicyService.get(userId);
    if (!mySettings.socialRecommendations) return empty;

    const [hidden, mutes, following, creatorFollows, favorites, charFollows, myCommunities] = await Promise.all([
      RelationshipReader.blockedEitherWaySet(userId),
      RelationshipReader.mutedTargets(userId, 'POSTS'),
      prisma.userFollow.findMany({ where: { followerUserId: userId }, select: { followedUserId: true } }),
      prisma.creatorFollow.findMany({ where: { userId }, select: { creatorProfileId: true } }),
      prisma.userFavorite.findMany({ where: { userId }, select: { character: { select: { creatorProfileId: true } } }, take: 200 }),
      prisma.characterFollow.findMany({ where: { userId }, select: { character: { select: { creatorProfileId: true } } }, take: 200 }),
      prisma.communityMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { communityId: true } }),
    ]);
    const exclude = new Set<string>([userId, ...hidden, ...mutes.users, ...following.map((f) => f.followedUserId)]);
    const followedCreatorProfiles = new Set(creatorFollows.map((c) => c.creatorProfileId));

    // Creators of characters you favorited or follow, that you don't follow yet.
    const creatorIds = [...favorites, ...charFollows].map((f) => f.character.creatorProfileId).filter((x): x is string => !!x && !followedCreatorProfiles.has(x));
    const creatorProfiles = await prisma.creatorProfile.findMany({
      where: { id: { in: [...new Set(creatorIds)] }, status: 'ACTIVE' },
      select: { userId: true },
      take: 20,
    });
    const creatorCards = await SocialProfileService.cards(creatorProfiles.map((c) => c.userId).filter((id) => !exclude.has(id)));

    // People you may know: ONLY explicit relationships — people who follow you, and discoverable
    // co-members of communities you actively participate in.
    const [followers, coMembers] = await Promise.all([
      prisma.userFollow.findMany({ where: { followedUserId: userId, status: 'ACTIVE' }, select: { followerUserId: true }, take: 50, orderBy: { createdAt: 'desc' } }),
      myCommunities.length
        ? prisma.communityMember.findMany({ where: { communityId: { in: myCommunities.map((m) => m.communityId) }, status: 'ACTIVE', userId: { not: userId } }, select: { userId: true }, take: 100 })
        : Promise.resolve([]),
    ]);
    const candidateIds = [...new Set([...followers.map((f) => f.followerUserId), ...coMembers.map((m) => m.userId)])].filter((id) => !exclude.has(id));
    const settings = await PrivacyPolicyService.getMany(candidateIds);
    const discoverable = candidateIds.filter((id) => settings.get(id)?.discoverable && settings.get(id)?.profileVisibility !== 'PRIVATE');
    const peopleCards = await SocialProfileService.cards(discoverable.slice(0, 20));
    const followerSet = new Set(followers.map((f) => f.followerUserId));

    const communities = await prisma.community.findMany({
      where: {
        privacy: 'PUBLIC',
        status: 'ACTIVE',
        deletedAt: null,
        id: { notIn: [...myCommunities.map((m) => m.communityId), ...mutes.communities] },
        characterId: { in: charFollows.length ? await prisma.characterFollow.findMany({ where: { userId }, select: { characterId: true } }).then((r) => r.map((x) => x.characterId)) : ['__none__'] },
      },
      orderBy: { memberCount: 'desc' },
      take: 10,
      select: { slug: true, name: true, memberCount: true },
    });

    return {
      creators: [...creatorCards.values()].slice(0, 10).map((c) => ({ ...c, reason: 'CREATOR_OF_CHARACTER_YOU_LIKE' })),
      people: discoverable
        .map((id) => peopleCards.get(id))
        .filter((c): c is SocialUserCard => !!c)
        .slice(0, 10)
        .map((c) => {
          const id = discoverable.find((d) => peopleCards.get(d) === c)!;
          return { ...c, reason: followerSet.has(id) ? 'FOLLOWS_YOU' : 'SHARED_COMMUNITY' };
        }),
      communities: communities.map((c) => ({ ...c, reason: 'ABOUT_A_CHARACTER_YOU_FOLLOW' })),
    };
  }
}
