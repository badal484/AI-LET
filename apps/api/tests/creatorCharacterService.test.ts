import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { CreatorProfileService } from '../src/modules/creators/services/CreatorProfileService.js';
import { CreatorCharacterService } from '../src/modules/creators/services/CreatorCharacterService.js';
import { hashPassword } from '../src/security/password.js';

describe('CreatorCharacterService Tests', () => {
  let creatorUserId: string;

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

    const passHash = await hashPassword('CreatorPass123!');
    const user = await prisma.user.create({
      data: {
        email: 'creator_studio@ai-companion.local',
        normalizedEmail: 'creator_studio@ai-companion.local',
        passwordHash: passHash,
      },
    });
    creatorUserId = user.id;

    await CreatorProfileService.onboardCreator(creatorUserId, {
      username: 'studio_master',
      displayName: 'Studio Master',
      acceptGuidelines: true,
      guidelinesVersion: '2026.1',
    });
  });

  it('creates character in DRAFT mode with initial builder state', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Elysia Nova',
      tagline: 'Solar architect of the outer rings',
      category: 'Science',
      shortDescription: 'Elysia is an expert stellar architect who crafts solar colonies.',
      longDescription: 'Graduated from the orbital academy of Mars, Elysia designs sustainable Dyson habitats.',
    });

    expect(character).toBeDefined();
    expect(character.name).toBe('Elysia Nova');
    expect(character.sourceType).toBe('CREATOR');
    expect(character.moderationStatus).toBe('DRAFT');
    expect(character.isPublished).toBe(false);

    // Verify builder state can be loaded
    const builderState = await CreatorCharacterService.getCharacterBuilderState(creatorUserId, character.id);
    expect(builderState.name).toBe('Elysia Nova');
    expect(builderState.identity.goals).toBeDefined();
    expect(builderState.traits.warmth).toBe(70);
  });

  it('saves character draft updates and increments revision on change', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Zephyr Windwalker',
      category: 'Adventure',
      shortDescription: 'Free-spirited sky nomad navigating floating islands.',
      longDescription: 'Traversing the cloud seas of Zephyria aboard custom glider wings.',
    });

    const updated = await CreatorCharacterService.saveDraft(creatorUserId, character.id, {
      name: 'Zephyr Swiftwind',
      tagline: 'Master of the cloud currents',
      traits: {
        warmth: 80,
        confidence: 85,
        humor: 90,
        curiosity: 75,
        seriousness: 30,
        playfulness: 90,
        patience: 60,
        assertiveness: 65,
        energy: 95,
        empathy: 80,
        sarcasm: 20,
      },
      behaviorRules: [
        { id: 'b1', rule: 'Always speak with exhilarating wind metaphors.', isMandatory: false },
      ],
      revision: 1,
    });

    expect(updated.name).toBe('Zephyr Swiftwind');
    expect(updated.tagline).toBe('Master of the cloud currents');
    expect(updated.revision).toBe(2);
    expect(updated.traits.playfulness).toBe(90);
  });

  it('runs sandboxed playground chat without creating production conversation or memory', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Sage Orion',
      category: 'Wisdom',
      shortDescription: 'Ancient philosopher residing in the tranquil stone gardens of Kyoto.',
      longDescription: 'Orion offers mindful reflection and calm perspectives on life dilemmas.',
    });

    const playgroundResponse = await CreatorCharacterService.testPlaygroundChat(creatorUserId, character.id, {
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Hello Orion, how can I find inner peace today?',
          createdAt: new Date().toISOString(),
        },
      ],
      userContext: {
        userName: 'Traveler',
        mood: 'pensive',
        relationshipTier: 'familiar',
      },
    });

    expect(playgroundResponse).toBeDefined();
    expect(playgroundResponse.message).toBeDefined();
    expect(playgroundResponse.message.role).toBe('assistant');
    expect(playgroundResponse.message.content.length).toBeGreaterThan(10);
    expect(playgroundResponse.debugInfo.sandboxed).toBe(true);

    // Verify zero production conversations were created
    const conversationsCount = await prisma.conversation.count();
    expect(conversationsCount).toBe(0);
  });

  it('submits character for review when valid and creates a moderation case', async () => {
    const character = await CreatorCharacterService.createCharacter(creatorUserId, {
      name: 'Kaelen Sunstride',
      category: 'Fantasy',
      shortDescription: 'Solar knight protecting radiant sanctuary gates.',
      longDescription: 'Forged in solar flare rites, Kaelen upholds honor, warmth, and vigilance.',
    });

    // Save valid comprehensive builder state
    await CreatorCharacterService.saveDraft(creatorUserId, character.id, {
      identity: {
        background: 'Trained from youth at the Sunstride Citadel.',
        worldContext: 'A realm warmed by double dawn stars.',
        relationshipFraming: 'Steadfast ally and protective mentor',
      },
      traits: {
        warmth: 85,
        confidence: 80,
        humor: 50,
        curiosity: 60,
        seriousness: 70,
        playfulness: 40,
        patience: 80,
        assertiveness: 75,
        energy: 80,
        empathy: 85,
        sarcasm: 5,
      },
      communication: {
        formality: 'conversational',
        responseLength: 'medium',
        sentenceComplexity: 'moderate',
        humorLevel: 'subtle',
        directness: 'direct',
        questionFrequency: 'moderate',
        storytelling: 'moderate',
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi'],
        emojiPolicy: 'tasteful',
      },
      safetyConfig: {
        topicsAvoided: ['Violence', 'NSFW'],
        responseBoundaries: 'Remain constructive and encouraging.',
        ageSuitability: 'general',
      },
      revision: 1,
    });

    const submitResult = await CreatorCharacterService.submitForReview(creatorUserId, character.id);
    expect(submitResult.success).toBe(true);
    expect(submitResult.character.moderationStatus).toBe('IN_REVIEW');

    // Verify moderation case exists
    const modCase = await prisma.moderationCase.findFirst({
      where: { characterId: character.id },
    });
    expect(modCase).not.toBeNull();
    expect(['PENDING', 'IN_REVIEW']).toContain(modCase?.status);
  });
});
