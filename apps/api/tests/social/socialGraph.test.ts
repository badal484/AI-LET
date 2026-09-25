import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { SocialGraphService } from '../../src/modules/social/graph/SocialGraphService.js';
import { SocialProfileService } from '../../src/modules/social/identity/SocialProfileService.js';
import { PrivacyPolicyService } from '../../src/modules/social/identity/PrivacyPolicyService.js';
import { SocialAccessService } from '../../src/modules/social/access/SocialAccessService.js';
import { UsernameService } from '../../src/modules/social/identity/UsernameService.js';
import { createCharacter, createSocialUser, createUser, enableAllSocialFeatures, flushEvents } from './fixtures.js';

const counts = async (userId: string) => prisma.socialProfile.findUniqueOrThrow({ where: { userId }, select: { followersCount: true, followingCount: true } });

describe('Social identity', () => {
  beforeAll(enableAllSocialFeatures);

  it('creates a profile with privacy-first defaults and an opaque public id', async () => {
    const u = await createSocialUser();
    const me = await SocialProfileService.getMine(u.id);
    expect(me.publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(me.publicId).not.toContain(u.id);
    expect(me.privacy.profileVisibility).toBe('LIMITED');
    expect(me.privacy.discoverable).toBe(false);
    expect(me.privacy.whoCanMessage).toBe('MUTUALS');
  });

  it('rejects taken, confusable and held usernames; enforces change cooldown', async () => {
    const a = await createSocialUser({ username: `maya${Date.now() % 100000}` });
    const b = await createUser();
    await expect(SocialProfileService.create(b.id, { username: a.username, displayName: 'B' })).rejects.toThrow(/taken/i);
    const lookalike = a.username.replace(/1/g, 'l').replace('m', 'rn');
    const check = await UsernameService.checkAvailability(lookalike, b.id);
    expect(check.available).toBe(false);

    // Changing frees nothing immediately: the old name is held against impersonation.
    await prisma.socialProfile.update({ where: { userId: a.id }, data: { usernameChangedAt: new Date(Date.now() - 30 * 86_400_000) } });
    const newName = `${a.username}x`;
    await UsernameService.changeUsername(a.id, newName);
    expect((await UsernameService.checkAvailability(a.username, b.id)).reason).toBe('HELD');
    await expect(UsernameService.changeUsername(a.id, `${a.username}y`)).rejects.toThrow(/change your username again/i);
  });

  it('never exposes internal identifiers or private account data in a public profile view', async () => {
    const owner = await createSocialUser();
    const viewer = await createSocialUser();
    const view = await SocialProfileService.getView(viewer.id, owner.username);
    const json = JSON.stringify(view);
    expect(json).not.toContain(owner.id);
    expect(json).not.toMatch(/@test\.local/);
    expect(view.isFullView).toBe(false); // LIMITED: card only for non-followers
    expect(view.bio).toBeNull();
  });
});

describe('Follow graph', () => {
  beforeAll(enableAllSocialFeatures);

  it('is idempotent and self-follow is rejected', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    expect((await SocialGraphService.follow(a.id, b.publicId)).status).toBe('ACTIVE');
    expect((await SocialGraphService.follow(a.id, b.publicId)).status).toBe('ACTIVE');
    expect(await counts(b.id)).toMatchObject({ followersCount: 1 });
    await expect(SocialGraphService.follow(a.id, a.publicId)).rejects.toThrow(/yourself/);
  });

  it('CONCURRENCY: 10 simultaneous follows produce exactly one edge and one counter increment', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await Promise.all(Array.from({ length: 10 }, () => SocialGraphService.follow(a.id, b.publicId)));
    expect(await prisma.userFollow.count({ where: { followerUserId: a.id, followedUserId: b.id } })).toBe(1);
    expect(await counts(b.id)).toMatchObject({ followersCount: 1 });
    expect(await counts(a.id)).toMatchObject({ followingCount: 1 });
  });

  it('CONCURRENCY: simultaneous unfollows decrement exactly once', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await SocialGraphService.follow(a.id, b.publicId);
    await Promise.all(Array.from({ length: 8 }, () => SocialGraphService.unfollow(a.id, b.publicId)));
    expect(await counts(b.id)).toMatchObject({ followersCount: 0 });
  });

  it('CONCURRENCY: follow racing a block never leaves a follow alongside a block', async () => {
    for (let i = 0; i < 3; i++) {
      const a = await createSocialUser();
      const b = await createSocialUser();
      await Promise.allSettled([SocialGraphService.follow(a.id, b.publicId), SocialGraphService.block(b.id, a.publicId)]);
      const follows = await prisma.userFollow.count({ where: { followerUserId: a.id, followedUserId: b.id } });
      const blocks = await prisma.userBlock.count({ where: { userId: b.id, blockedUserId: a.id } });
      expect(blocks).toBe(1);
      expect(follows).toBe(0);
      expect(await counts(b.id)).toMatchObject({ followersCount: 0 });
    }
  });

  it('private / approval accounts produce follow requests that the owner can accept', async () => {
    const owner = await createSocialUser();
    const fan = await createSocialUser();
    await PrivacyPolicyService.update(owner.id, { profileVisibility: 'PRIVATE' });
    expect((await SocialGraphService.follow(fan.id, owner.publicId)).status).toBe('PENDING');
    expect(await counts(owner.id)).toMatchObject({ followersCount: 0 });
    expect((await SocialGraphService.listIncomingRequests(owner.id, undefined, 10)).items.map((c) => c.publicId)).toContain(fan.publicId);
    expect((await SocialGraphService.respondToFollowRequest(owner.id, fan.publicId, 'ACCEPT')).status).toBe('ACTIVE');
    expect(await counts(owner.id)).toMatchObject({ followersCount: 1 });
  });

  it('follow lists obey their own audience setting (not the profile visibility)', async () => {
    const owner = await createSocialUser();
    const stranger = await createSocialUser();
    await PrivacyPolicyService.update(owner.id, { profileVisibility: 'PUBLIC' });
    await expect(SocialGraphService.listFollows(stranger.id, owner.publicId, 'followers', undefined, 10)).rejects.toThrow(/private/i);
    await PrivacyPolicyService.update(owner.id, { followListAudience: 'EVERYONE' });
    await expect(SocialGraphService.listFollows(stranger.id, owner.publicId, 'followers', undefined, 10)).resolves.toBeDefined();
  });

  it('following a character is separate from favoriting it and from chatting', async () => {
    const u = await createSocialUser();
    const ch = await createCharacter();
    const state = await SocialGraphService.followCharacter(u.id, ch.slug, true);
    expect(state).toMatchObject({ following: true, notificationsEnabled: true, followerCount: 1 });
    expect(await prisma.userFavorite.count({ where: { userId: u.id, characterId: ch.id } })).toBe(0);
    expect(await prisma.conversation.count({ where: { userId: u.id, characterId: ch.id } })).toBe(0);
  });

  it('following an active creator joins their creator audience (existing CreatorFollow)', async () => {
    const creatorUser = await createSocialUser();
    const creator = await prisma.creatorProfile.create({ data: { userId: creatorUser.id, displayName: 'C', username: `cr_${creatorUser.username}`, status: 'ACTIVE' } });
    const fan = await createSocialUser();
    await SocialGraphService.follow(fan.id, creatorUser.publicId);
    expect(await prisma.creatorFollow.count({ where: { userId: fan.id, creatorProfileId: creator.id } })).toBe(1);
    await SocialGraphService.unfollow(fan.id, creatorUser.publicId);
    expect(await prisma.creatorFollow.count({ where: { userId: fan.id, creatorProfileId: creator.id } })).toBe(0);
  });

  it('reconciliation repairs drifted counters from the source-of-truth edges', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await SocialGraphService.follow(a.id, b.publicId);
    await prisma.socialProfile.update({ where: { userId: b.id }, data: { followersCount: 42 } });
    await SocialGraphService.reconcileCounters([b.id]);
    expect(await counts(b.id)).toMatchObject({ followersCount: 1 });
  });
});

describe('Blocking is strong and bypass-proof', () => {
  beforeAll(enableAllSocialFeatures);

  it('severs follows both ways and fixes counters', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await SocialGraphService.follow(a.id, b.publicId);
    await SocialGraphService.follow(b.id, a.publicId);
    await SocialGraphService.block(a.id, b.publicId);
    expect(await prisma.userFollow.count({ where: { OR: [{ followerUserId: a.id }, { followerUserId: b.id }] } })).toBe(0);
    expect(await counts(a.id)).toMatchObject({ followersCount: 0, followingCount: 0 });
    expect(await counts(b.id)).toMatchObject({ followersCount: 0, followingCount: 0 });
  });

  it('blocked user cannot view, follow, mention, message or be recommended — via any path', async () => {
    const blocker = await createSocialUser();
    const blocked = await createSocialUser();
    await PrivacyPolicyService.update(blocker.id, { profileVisibility: 'PUBLIC', whoCanMention: 'EVERYONE', whoCanMessage: 'EVERYONE' });
    await SocialGraphService.block(blocker.id, blocked.publicId);

    // Profile view by public id AND by username behaves as "not found" (no block inference).
    await expect(SocialProfileService.getView(blocked.id, blocker.publicId)).rejects.toThrow(/not found/i);
    await expect(SocialProfileService.getView(blocked.id, blocker.username)).rejects.toThrow(/not found/i);
    await expect(SocialGraphService.follow(blocked.id, blocker.publicId)).rejects.toThrow(/not found/i);
    expect((await SocialAccessService.canMention(blocked.id, blocker.id)).allowed).toBe(false);
    expect((await SocialAccessService.canStartConversation(blocked.id, blocker.id)).allowed).toBe(false);
    expect((await SocialAccessService.canReceiveNotificationFrom(blocker.id, blocked.id)).allowed).toBe(false);
    expect((await SocialAccessService.canInviteToCommunity(blocked.id, blocker.id)).allowed).toBe(false);
    // …and symmetric: the blocker can't reach the blocked user either.
    expect((await SocialAccessService.canView(blocker.id, blocked.id)).allowed).toBe(false);
  });

  it('muting hides but does not deny (distinct from blocking)', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await PrivacyPolicyService.update(b.id, { profileVisibility: 'PUBLIC' });
    await SocialGraphService.mute(a.id, { targetType: 'USER', target: b.publicId, scope: 'NOTIFICATIONS' });
    expect((await SocialAccessService.canView(a.id, b.id)).allowed).toBe(true);
    expect((await SocialAccessService.canReceiveNotificationFrom(a.id, b.id)).allowed).toBe(false);
    expect((await SocialGraphService.listMutes(a.id))[0]).toMatchObject({ targetType: 'USER', target: b.publicId, scope: 'NOTIFICATIONS' });
  });

  it('ENUMERATION: unknown, deleted and hidden profiles are indistinguishable', async () => {
    const viewer = await createSocialUser();
    const gone = await createSocialUser();
    await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date(), status: 'DELETED' } });
    await expect(SocialProfileService.getView(viewer.id, 'doesnotexist123')).rejects.toThrow(/not found/i);
    await expect(SocialProfileService.getView(viewer.id, gone.publicId)).rejects.toThrow(/not found/i);
    await flushEvents();
  });
});
