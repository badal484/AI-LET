import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { CreatorProfileService } from '../src/modules/creators/services/CreatorProfileService.js';
import { CreatorCharacterService } from '../src/modules/creators/services/CreatorCharacterService.js';
import { CharacterModerationService } from '../src/modules/moderation/services/CharacterModerationService.js';
import { hashPassword } from '../src/security/password.js';

describe('CharacterModerationService Tests', () => {
  let creatorUserId: string;
  let normalUserId: string;
  let adminUserId: string;

  beforeEach(async () => {
    await prisma.moderationAppeal.deleteMany();
    await prisma.moderationCase.deleteMany();
    await prisma.characterReport.deleteMany();
    await prisma.characterVersion.deleteMany();
    await prisma.character.deleteMany();
    await prisma.creatorFollow.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    const passHash = await hashPassword('TestPass123!');
    const creatorUser = await prisma.user.create({
      data: {
        email: 'creator_mod@ai-companion.local',
        normalizedEmail: 'creator_mod@ai-companion.local',
        passwordHash: passHash,
      },
    });
    creatorUserId = creatorUser.id;

    const normalUser = await prisma.user.create({
      data: {
        email: 'reporter@ai-companion.local',
        normalizedEmail: 'reporter@ai-companion.local',
        passwordHash: passHash,
      },
    });
    normalUserId = normalUser.id;

    const admin = await prisma.adminUser.create({
      data: {
        email: 'moderator@ai-companion.local',
        normalizedEmail: 'moderator@ai-companion.local',
        passwordHash: passHash,
        displayName: 'Lead Moderator',
        isActive: true,
      },
    });
    adminUserId = admin.id;

    await CreatorProfileService.onboardCreator(creatorUserId, {
      username: 'artisan_prime',
      displayName: 'Artisan Prime',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });
  });

  it('allows moderator to approve a submitted character and make it published', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Dr. Evelyn Vance',
      category: 'Science',
      shortDescription: 'Quantum physicist researching tachyon particles and energy grids.',
      longDescription: 'Former director of the Geneva Particle Consortium, Dr. Vance explains complex physics simply.',
    });

    await CreatorCharacterService.submitForReview(creatorUserId, character.id);

    const modCase = await prisma.moderationCase.findFirst({
      where: { characterId: character.id },
    });
    expect(modCase).not.toBeNull();

    // Moderator approves
    const decision = await CharacterModerationService.reviewCase(adminUserId, {
      caseId: modCase!.id,
      decision: 'APPROVE',
      internalNotes: 'Compliant with all safety and quality standards.',
    });

    expect(decision.status).toBe('RESOLVED');

    // Verify character is now APPROVED and Published
    const updatedChar = await prisma.character.findUnique({
      where: { id: character.id },
    });
    expect(updatedChar?.moderationStatus).toBe('APPROVED');
    expect(updatedChar?.status).toBe('PUBLISHED');
  });

  it('handles structured change request and allows creator to edit and resubmit', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Cyber Blade',
      category: 'Action',
      shortDescription: 'Bounty hunter navigating neon alleyways.',
      longDescription: 'Specializes in recovering stolen corporate artificial neural cores.',
    });

    await CreatorCharacterService.submitForReview(creatorUserId, character.id);

    const modCase = await prisma.moderationCase.findFirst({
      where: { characterId: character.id },
    });

    // Moderator requests changes
    await CharacterModerationService.reviewCase(adminUserId, {
      caseId: modCase!.id,
      decision: 'REQUEST_CHANGES',
      rejectionReason: 'MISLEADING_DESCRIPTION',
      changeRequestDetails: 'Please clarify safety boundaries around weapon discussions.',
    });

    const charAfterChangeReq = await prisma.character.findUnique({
      where: { id: character.id },
    });
    expect(charAfterChangeReq?.moderationStatus).toBe('CHANGES_REQUESTED');
    expect(charAfterChangeReq?.changeRequestDetails).toContain('Please clarify safety boundaries');
  });

  it('records user character reports and auto-creates moderation case if not already open', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Shadow Fox',
      category: 'Mystery',
      shortDescription: 'Stealthy rogue in the underworld.',
      longDescription: 'Navigates clandestine secrets.',
    });

    // Report submitted by user
    const report = await CharacterModerationService.reportCharacter(normalUserId, {
      characterId: character.id,
      reasonCode: 'UNSAFE',
      details: 'This character encouraged unsafe behavior.',
    });

    expect(report).toBeDefined();
    expect(report.characterId).toBe(character.id);
    expect(report.reasonCode).toBe('UNSAFE');

    const modCase = await prisma.moderationCase.findFirst({
      where: { characterId: character.id },
    });
    expect(modCase).not.toBeNull();
    expect(modCase?.automatedFlags).toBeDefined();
  });

  it('allows creator to appeal a rejection and moderator to process the appeal', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Mystic Raven',
      category: 'Fantasy',
      shortDescription: 'Shadow alchemist brewing protective potions.',
      longDescription: 'Master of ancient elixirs.',
    });

    await CreatorCharacterService.submitForReview(creatorUserId, character.id);
    const modCase = await prisma.moderationCase.findFirst({
      where: { characterId: character.id },
    });

    // Moderator rejects
    await CharacterModerationService.reviewCase(adminUserId, {
      caseId: modCase!.id,
      decision: 'REJECT',
      rejectionReason: 'PROHIBITED_CONTENT',
      internalNotes: 'Flagged erroneously during automated sweep.',
    });

    // Creator submits appeal
    const appeal = await CharacterModerationService.submitAppeal(creatorUserId, {
      characterId: character.id,
      reason: 'My character only discusses fictional herbal alchemy, not real dangerous substances.',
    });

    expect(appeal).toBeDefined();
    expect(appeal.status).toBe('PENDING');

    // Admin resolves appeal
    const resolvedAppeal = await CharacterModerationService.processAppeal(adminUserId, appeal.id, {
      status: 'APPROVED',
      reviewerNotes: 'Verified character lore is purely high-fantasy fictional context.',
    });

    expect(resolvedAppeal.status).toBe('APPROVED');

    const updatedChar = await prisma.character.findUnique({
      where: { id: character.id },
    });
    expect(updatedChar?.moderationStatus).toBe('APPROVED');
    expect(updatedChar?.status).toBe('PUBLISHED');
  });
});
