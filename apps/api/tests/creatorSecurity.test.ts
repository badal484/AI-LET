import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { CreatorProfileService } from '../src/modules/creators/services/CreatorProfileService.js';
import { CreatorCharacterService } from '../src/modules/creators/services/CreatorCharacterService.js';
import { hashPassword } from '../src/security/password.js';

describe('Creator Security & Cross-Creator Isolation Tests', () => {
  let creatorAId: string;
  let creatorBId: string;
  let nonCreatorId: string;

  beforeEach(async () => {
    await prisma.moderationAppeal.deleteMany();
    await prisma.moderationCase.deleteMany();
    await prisma.characterReport.deleteMany();
    await prisma.characterVersion.deleteMany();
    await prisma.character.deleteMany();
    await prisma.creatorFollow.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    const passHash = await hashPassword('SecurityPass123!');
    const userA = await prisma.user.create({
      data: {
        email: 'creator_alpha@ai-companion.local',
        normalizedEmail: 'creator_alpha@ai-companion.local',
        passwordHash: passHash,
      },
    });
    creatorAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'creator_beta@ai-companion.local',
        normalizedEmail: 'creator_beta@ai-companion.local',
        passwordHash: passHash,
      },
    });
    creatorBId = userB.id;

    const userC = await prisma.user.create({
      data: {
        email: 'non_creator@ai-companion.local',
        normalizedEmail: 'non_creator@ai-companion.local',
        passwordHash: passHash,
      },
    });
    nonCreatorId = userC.id;

    await CreatorProfileService.onboardCreator(creatorAId, {
      username: 'creator_alpha',
      displayName: 'Creator Alpha',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });

    await CreatorProfileService.onboardCreator(creatorBId, {
      username: 'creator_beta',
      displayName: 'Creator Beta',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });
  });

  it('prevents non-creator from creating characters', async () => {
    await expect(
      CreatorCharacterService.createCharacter(nonCreatorId, {
        name: 'Unauthorized Char',
        category: 'Test',
        shortDescription: 'Short description for unauthorized character',
        longDescription: 'Long description for unauthorized character',
      })
    ).rejects.toThrow('Active creator profile required to create characters');
  });

  it('prevents Creator B from reading Creator A draft builder state', async () => {
    const charA = await CreatorCharacterService.createCharacter(creatorAId, {
      name: 'Alpha Secret Character',
      category: 'Mystery',
      shortDescription: 'Alpha top-secret companion concept in draft.',
      longDescription: 'Full detailed lore only visible to Creator Alpha.',
    });

    await expect(
      CreatorCharacterService.getCharacterBuilderState(creatorBId, charA.id)
    ).rejects.toThrow('Character not found or not owned by creator');
  });

  it('prevents Creator B from modifying Creator A draft', async () => {
    const charA = await CreatorCharacterService.createCharacter(creatorAId, {
      name: 'Alpha Original',
      category: 'Adventure',
      shortDescription: 'Alpha companion concept.',
      longDescription: 'Alpha long background description.',
    });

    await expect(
      CreatorCharacterService.saveDraft(creatorBId, charA.id, {
        name: 'Hacked By Beta',
        revision: 1,
      })
    ).rejects.toThrow('Character not found or not owned by creator');
  });

  it('prevents Creator B from submitting Creator A character for review', async () => {
    const charA = await CreatorCharacterService.createCharacter(creatorAId, {
      name: 'Alpha Submission Target',
      category: 'Adventure',
      shortDescription: 'Alpha companion concept for submission.',
      longDescription: 'Alpha long background description.',
    });

    await expect(
      CreatorCharacterService.submitForReview(creatorBId, charA.id)
    ).rejects.toThrow('Character not found or not owned by creator');
  });

  it('prevents Creator B from unpublishing or archiving Creator A character', async () => {
    const charA = await CreatorCharacterService.createCharacter(creatorAId, {
      name: 'Alpha Lifecycle Target',
      category: 'Adventure',
      shortDescription: 'Alpha companion concept.',
      longDescription: 'Alpha long background description.',
    });

    await expect(
      CreatorCharacterService.unpublishCharacter(creatorBId, charA.id)
    ).rejects.toThrow('Character not found or not owned by creator');

    await expect(
      CreatorCharacterService.archiveCharacter(creatorBId, charA.id)
    ).rejects.toThrow('Character not found or not owned by creator');
  });
});
