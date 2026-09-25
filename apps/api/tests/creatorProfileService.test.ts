import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { CreatorProfileService } from '../src/modules/creators/services/CreatorProfileService.js';
import { hashPassword } from '../src/security/password.js';

describe('CreatorProfileService Tests', () => {
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    await prisma.creatorFollow.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    const passHash = await hashPassword('CreatorPass123!');
    const userA = await prisma.user.create({
      data: {
        email: 'creatorA@ai-companion.local',
        normalizedEmail: 'creatora@ai-companion.local',
        passwordHash: passHash,
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'creatorB@ai-companion.local',
        normalizedEmail: 'creatorb@ai-companion.local',
        passwordHash: passHash,
      },
    });
    userBId = userB.id;
  });

  it('successfully completes creator onboarding and accepts guidelines', async () => {
    const profile = await CreatorProfileService.onboardCreator(userAId, {
      username: 'cosmic_artisan',
      displayName: 'Cosmic Artisan',
      bio: 'Creating immersive sci-fi companions.',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });

    expect(profile).toBeDefined();
    expect(profile.username).toBe('cosmic_artisan');
    expect(profile.displayName).toBe('Cosmic Artisan');
    expect(profile.status).toBe('ACTIVE');
    expect(profile.acceptedGuidelinesVersion).toBe('2026.1');
    expect(profile.acceptedGuidelinesAt).not.toBeNull();
  });

  it('rejects onboarding if guidelines are not accepted', async () => {
    await expect(
      CreatorProfileService.onboardCreator(userAId, {
        username: 'uncompliant_user',
        displayName: 'Uncompliant User',
        acceptGuidelines: false,
        guidelinesVersion: '2026.1',
      })
    ).rejects.toThrow('You must review and accept the creator content guidelines');
  });

  it('rejects reserved usernames', async () => {
    await expect(
      CreatorProfileService.onboardCreator(userAId, {
        username: 'admin',
        displayName: 'Fake Admin',
        acceptGuidelines: true,
        guidelinesVersion: '2026.1',
      })
    ).rejects.toThrow('This username is reserved and cannot be claimed');

    await expect(
      CreatorProfileService.onboardCreator(userAId, {
        username: 'official',
        displayName: 'Fake Official',
        acceptGuidelines: true,
        guidelinesVersion: '2026.1',
      })
    ).rejects.toThrow('This username is reserved and cannot be claimed');
  });

  it('rejects duplicate usernames (case-insensitive)', async () => {
    await CreatorProfileService.onboardCreator(userAId, {
      username: 'starlight',
      displayName: 'Starlight Prime',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });

    await expect(
      CreatorProfileService.onboardCreator(userBId, {
        username: 'STARLIGHT',
        displayName: 'Starlight Duplicate',
        acceptGuidelines: true,
        guidelinesVersion: '2026.1',
      })
    ).rejects.toThrow('Username is already taken');
  });

  it('allows creator to update their profile information', async () => {
    await CreatorProfileService.onboardCreator(userAId, {
      username: 'mythos_crafter',
      displayName: 'Mythos Crafter',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });

    const updated = await CreatorProfileService.updateProfile(userAId, {
      displayName: 'Mythos Crafter Studio',
      bio: 'High fantasy worldbuilders and companions.',
      website: 'https://mythoscrafter.dev',
      socialLinks: { twitter: 'mythos_ai', github: 'mythoscrafter' },
    });

    expect(updated.displayName).toBe('Mythos Crafter Studio');
    expect(updated.bio).toBe('High fantasy worldbuilders and companions.');
    expect(updated.website).toBe('https://mythoscrafter.dev');
  });

  it('supports public profile lookup and follow / unfollow toggling', async () => {
    await CreatorProfileService.onboardCreator(userAId, {
      username: 'aurora_dev',
      displayName: 'Aurora Dev',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });

    // Lookup public profile from userB perspective
    const publicProfileBefore = await CreatorProfileService.getPublicProfileByUsername('aurora_dev', userBId);
    expect(publicProfileBefore.username).toBe('aurora_dev');
    expect(publicProfileBefore.isFollowing).toBe(false);
    expect(publicProfileBefore.totalFollowersCount).toBe(0);

    // userB follows userA
    const followResult = await CreatorProfileService.toggleFollow('aurora_dev', userBId, true);
    expect(followResult.isFollowing).toBe(true);
    expect(followResult.totalFollowers).toBe(1);

    // Query again
    const publicProfileAfter = await CreatorProfileService.getPublicProfileByUsername('aurora_dev', userBId);
    expect(publicProfileAfter.isFollowing).toBe(true);
    expect(publicProfileAfter.totalFollowersCount).toBe(1);

    // Unfollow
    const unfollowResult = await CreatorProfileService.toggleFollow('aurora_dev', userBId, false);
    expect(unfollowResult.isFollowing).toBe(false);
    expect(unfollowResult.totalFollowers).toBe(0);
  });
});
