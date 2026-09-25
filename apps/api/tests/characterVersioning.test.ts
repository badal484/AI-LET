import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { AdminCharacterService } from '../src/modules/characters/services/adminCharacter.service.js';
import { CharacterService } from '../src/modules/characters/services/character.service.js';
import { CharacterTestService } from '../src/modules/characters/services/characterTest.service.js';
import { hashPassword } from '../src/security/password.js';

describe('Character Versioning, Immutability & Section 49 Lifecycle Tests', () => {
  let adminUserId: string;
  let devUserId: string;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.characterVersion.deleteMany();
    await prisma.character.deleteMany();
    await prisma.adminSession.deleteMany();
    await prisma.adminRoleAssignment.deleteMany();
    await prisma.adminRolePermission.deleteMany();
    await prisma.adminRole.deleteMany();
    await prisma.adminPermission.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create super admin
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await prisma.adminUser.create({
      data: {
        email: 'admin@ai-companion.local',
        normalizedEmail: 'admin@ai-companion.local',
        passwordHash,
        displayName: 'Super Admin',
        isActive: true,
      },
    });
    adminUserId = admin.id;

    // Create dev user
    const userPassHash = await hashPassword('UserPass123!');
    const user = await prisma.user.create({
      data: {
        email: 'user@ai-companion.local',
        normalizedEmail: 'user@ai-companion.local',
        passwordHash: userPassHash,
      },
    });
    devUserId = user.id;
  });

  it('verifies Section 49 exact lifecycle scenario (draft isolation & live version switching)', async () => {
    // Step 1: Admin creates Character (which starts in DRAFT v1)
    const character = await AdminCharacterService.createCharacter(adminUserId, {
      internalKey: 'char_luna_test',
      slug: 'luna-test',
      name: 'Luna Test',
      tagline: 'Empathetic Astrologer v1',
      shortDescription: 'Gentle stargazer v1 description',
      longDescription: 'Luna was raised in an ancient stargazing observatory in Kyoto.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'Astrology',
      archetype: 'Mystic',
      age: 23,
      gender: 'Female',
      occupation: 'Astrologer',
    });

    const v1Id = character.versions[0].id;

    // Step 2: Admin publishes v1
    await AdminCharacterService.publishVersion(adminUserId, character.id, v1Id);

    // Step 3: User resolves live character runtime (must be v1)
    const liveRuntimeV1 = await CharacterService.resolveRuntime(character.slug);
    expect(liveRuntimeV1.versionNumber).toBe(1);
    expect(liveRuntimeV1.identity.name).toBe('Luna Test');
    expect(liveRuntimeV1.compiledSystemPrompt).toContain('Empathetic Astrologer v1');

    // User starts conversation and records active character version v1
    const conversation = await prisma.conversation.create({
      data: {
        userId: devUserId,
        characterId: character.id,
        characterVersionId: v1Id,
        status: 'ACTIVE',
      },
    });
    expect(conversation.characterVersionId).toBe(v1Id);

    // Step 4: Admin creates draft v2
    const draftV2 = await AdminCharacterService.createVersionDraft(
      adminUserId,
      character.id,
      v1Id,
      'Experimental v2 draft with high playfulness',
    );
    expect(draftV2.versionNumber).toBe(2);
    expect(draftV2.status).toBe('DRAFT');

    // Step 5: Admin modifies draft v2 (changes personality summary & increases playfulness)
    const updatedDraftV2 = await AdminCharacterService.updateVersionDraft(
      adminUserId,
      character.id,
      draftV2.id,
      {
        identityData: {
          ...draftV2.identityData,
          personalitySummary: 'Wildly playful and witty v2 stargazer',
        },
        personalityData: {
          ...draftV2.personalityData,
          traits: { ...draftV2.personalityData.traits, playfulness: 99, sarcasm: 90 },
        },
      },
    );
    expect(updatedDraftV2.identityData.personalitySummary).toBe('Wildly playful and witty v2 stargazer');

    // Step 6: Admin tests v2 in isolated test playground
    const testResult = await CharacterTestService.testInteraction(
      character.id,
      draftV2.id,
      { userMessage: 'Hello!' },
      true,
    );
    expect(testResult.compiledPrompt).toContain('Wildly playful and witty v2 stargazer');

    // CRITICAL SECTION 49 CHECK: User requests MUST CONTINUE receiving v1 behavior while v2 is unpublished!
    const liveRuntimeStillV1 = await CharacterService.resolveRuntime(character.slug);
    expect(liveRuntimeStillV1.versionNumber).toBe(1);
    expect(liveRuntimeStillV1.compiledSystemPrompt).toContain('Empathetic Astrologer v1');
    expect(liveRuntimeStillV1.compiledSystemPrompt).not.toContain('Wildly playful and witty v2 stargazer');

    // Step 7: Admin publishes v2
    await AdminCharacterService.publishVersion(adminUserId, character.id, draftV2.id);

    // Step 8: New runtime requests now resolve v2
    const liveRuntimeNowV2 = await CharacterService.resolveRuntime(character.slug);
    expect(liveRuntimeNowV2.versionNumber).toBe(2);
    expect(liveRuntimeNowV2.compiledSystemPrompt).toContain('Wildly playful and witty v2 stargazer');

    // Step 9: Existing historical conversation remains 100% reproducible via recorded v1 snapshot
    const historicalConversationRuntime = await CharacterService.resolveRuntime(
      character.id,
      conversation.characterVersionId!,
    );
    expect(historicalConversationRuntime.versionNumber).toBe(1);
    expect(historicalConversationRuntime.compiledSystemPrompt).toContain('Empathetic Astrologer v1');
  });

  it('enforces version immutability (published versions cannot be mutated directly)', async () => {
    const character = await AdminCharacterService.createCharacter(adminUserId, {
      internalKey: 'char_immutable_test',
      slug: 'immutable-test',
      name: 'Immutable Test',
      tagline: 'Testing Immutability',
      shortDescription: 'Short description test',
      longDescription: 'Long description test backstory.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'General',
      archetype: 'Companion',
      age: 24,
      gender: 'Female',
      occupation: 'Companion',
    });

    const v1Id = character.versions[0].id;
    await AdminCharacterService.publishVersion(adminUserId, character.id, v1Id);

    // Attempting to update published v1 directly must fail
    await expect(
      AdminCharacterService.updateVersionDraft(adminUserId, character.id, v1Id, {
        changeSummary: 'Sneaky mutation of published version',
      }),
    ).rejects.toThrow(/Cannot modify a published version/i);
  });

  it('safely rolls back from v2 to v1 and preserves version history', async () => {
    const character = await AdminCharacterService.createCharacter(adminUserId, {
      internalKey: 'char_rollback_test',
      slug: 'rollback-test',
      name: 'Rollback Test',
      tagline: 'Testing Rollback',
      shortDescription: 'Short description test',
      longDescription: 'Long description test backstory.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      category: 'General',
      archetype: 'Companion',
      age: 24,
      gender: 'Female',
      occupation: 'Companion',
    });

    const v1Id = character.versions[0].id;
    await AdminCharacterService.publishVersion(adminUserId, character.id, v1Id);

    // Create and publish v2
    const v2 = await AdminCharacterService.createVersionDraft(adminUserId, character.id, v1Id, 'v2 release');
    await AdminCharacterService.publishVersion(adminUserId, character.id, v2.id);

    const runtimeAtV2 = await CharacterService.resolveRuntime(character.slug);
    expect(runtimeAtV2.versionNumber).toBe(2);

    // Rollback to v1
    await AdminCharacterService.rollbackVersion(adminUserId, character.id, v1Id, 'Emergency rollback to stable v1');

    const runtimeAfterRollback = await CharacterService.resolveRuntime(character.slug);
    expect(runtimeAfterRollback.versionNumber).toBe(1);

    // Ensure v2 was NOT deleted and is still in history
    const detail = await AdminCharacterService.getCharacterDetail(character.id);
    expect(detail.versions.length).toBe(2);
    expect(detail.currentVersionNumber).toBe(1);
  });
});
