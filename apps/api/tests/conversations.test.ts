import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { UserRole, CharacterStatus, CharacterVisibility } from '@prisma/client';
import { signAccessToken } from '../src/security/tokens.js';

describe('Conversations API & Persistence Integration Tests', () => {
  const app = createApp();

  let userAId: string;
  let userAToken: string;
  let userBId: string;
  let userBToken: string;
  let characterId: string;
  let characterVersionId: string;

  beforeEach(async () => {
    // Clean up database state
    await prisma.messageFeedback.deleteMany();
    await prisma.messageGenerationMetadata.deleteMany();
    await prisma.messagePart.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.characterVersion.deleteMany();
    await prisma.character.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.authIdentity.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create User A
    const userA = await prisma.user.create({
      data: {
        email: 'usera@example.com',
        normalizedEmail: 'usera@example.com',
        passwordHash: 'argon2id_mock_hash',
        profile: {
          create: {
            displayName: 'User Alpha',
          },
        },
      },
    });
    userAId = userA.id;
    userAToken = signAccessToken({
      userId: userA.id,
      email: userA.email,
      roles: ['USER'],
    });

    // Create User B
    const userB = await prisma.user.create({
      data: {
        email: 'userb@example.com',
        normalizedEmail: 'userb@example.com',
        passwordHash: 'argon2id_mock_hash',
        profile: {
          create: {
            displayName: 'User Beta',
          },
        },
      },
    });
    userBId = userB.id;
    userBToken = signAccessToken({
      userId: userB.id,
      email: userB.email,
      roles: ['USER'],
    });

    // Create a published Character with Version
    const character = await prisma.character.create({
      data: {
        slug: 'celestial-luna',
        internalKey: 'celestial_luna',
        name: 'Luna',
        tagline: 'Empathetic Astrologer',
        shortDescription: 'Empathetic Astrologer',
        longDescription: 'Deep mystical companion from Kyoto',
        avatarUrl: 'https://cdn.example.com/luna.png',
        coverImageUrl: 'https://cdn.example.com/luna-cover.png',
        category: 'Astrology',
        archetype: 'Caregiver',
        backstory: 'Raised in an ancient stargazing sanctuary amidst the cedar hills of Kyoto.',
        age: 24,
        gender: 'female',
        occupation: 'Astrologer',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
    });
    characterId = character.id;

    const version = await prisma.characterVersion.create({
      data: {
        characterId: character.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        identityData: {
          name: 'Luna',
          role: 'Astrologer',
          personalitySummary: 'Warm and celestial',
        },
        personalityData: { traits: { warmth: 90, empathy: 95 } },
        communicationData: { pacing: 'thoughtful' },
        languageData: { primaryLanguage: 'en' },
        behaviorRulesData: [],
        knowledgeData: [],
        relationshipConfigData: {},
        memoryConfigData: { memoryEnabled: true },
        proactivityConfigData: { enabled: false },
        safetyConfigData: { ageSuitability: 'ALL_AGES' },
        aiConfigData: { preferredModelClass: 'fast', temperature: 0.7, maxOutputTokens: 300 },
        changeSummary: 'Initial release',
      },
    });
    characterVersionId = version.id;

    await prisma.character.update({
      where: { id: character.id },
      data: { currentPublishedVersionId: version.id },
    });
  });

  describe('POST /api/v1/conversations', () => {
    it('creates a new conversation and binds active published character version', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ characterId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.userId).toBe(userAId);
      expect(res.body.data.characterId).toBe(characterId);
      expect(res.body.data.characterVersionId).toBe(characterVersionId);
      expect(res.body.data.character.name).toBe('Luna');

      // Verify conversation in DB
      const dbConv = await prisma.conversation.findUnique({
        where: { id: res.body.data.id },
      });
      expect(dbConv).toBeDefined();
      expect(dbConv?.userId).toBe(userAId);
    });

    it('returns existing conversation if one already exists for user and character', async () => {
      const firstRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ characterId });

      expect(firstRes.status).toBe(201);
      const convId = firstRes.body.data.id;

      const secondRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ characterId });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.id).toBe(convId);
    });

    it('rejects creation for unpublished or nonexistent character with 404', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ characterId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/conversations & Ownership Isolation', () => {
    it('strictly isolates User A and User B conversations', async () => {
      // User A creates conversation
      const convRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ characterId });
      const convId = convRes.body.data.id;

      // User A can fetch it
      const userAFetch = await request(app)
        .get(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(userAFetch.status).toBe(200);
      expect(userAFetch.body.data.id).toBe(convId);

      // User B cannot fetch User A's conversation
      const userBFetch = await request(app)
        .get(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(userBFetch.status).toBe(403);

      // User B's conversation list is empty
      const userBList = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(userBList.status).toBe(200);
      expect(userBList.body.data.length).toBe(0);

      // User A's conversation list contains 1 item
      const userAList = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(userAList.status).toBe(200);
      expect(userAList.body.data.length).toBe(1);
    });
  });

  describe('Message History & Pagination', () => {
    it('supports cursor-based pagination of messages with deterministic sequence numbers', async () => {
      const conv = await prisma.conversation.create({
        data: {
          userId: userAId,
          characterId,
          characterVersionId,
          title: 'Celestial chat',
        },
      });

      // Insert 10 ordered messages
      for (let i = 1; i <= 10; i++) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            sequenceNumber: i,
            role: i % 2 === 1 ? 'user' : 'assistant',
            senderType: i % 2 === 1 ? 'USER' : 'CHARACTER',
            status: 'COMPLETED',
            content: `Message ${i}`,
          },
        });
      }

      // Fetch first page (limit 5)
      const page1 = await request(app)
        .get(`/api/v1/conversations/${conv.id}/messages?limit=5`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.length).toBe(5);
      expect(page1.body.data[0].sequenceNumber).toBe(10); // Most recent message first
      expect(page1.body.meta.hasMore).toBe(true);
      expect(page1.body.meta.cursor).toBeDefined();

      // Fetch second page using cursor
      const cursor = page1.body.meta.cursor;
      const page2 = await request(app)
        .get(`/api/v1/conversations/${conv.id}/messages?limit=5&cursor=${cursor}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.length).toBe(5);
      expect(page2.body.data[0].sequenceNumber).toBe(5);
      expect(page2.body.meta.hasMore).toBe(false);
    });
  });

  describe('Message Feedback', () => {
    it('allows authenticated user to record thumbs up/down feedback on assistant messages', async () => {
      const conv = await prisma.conversation.create({
        data: {
          userId: userAId,
          characterId,
          characterVersionId,
        },
      });

      const assistantMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          sequenceNumber: 1,
          role: 'assistant',
          senderType: 'CHARACTER',
          status: 'COMPLETED',
          content: 'The stars align in your favor.',
        },
      });

      const res = await request(app)
        .post(`/api/v1/conversations/${conv.id}/messages/${assistantMsg.id}/feedback`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          rating: 'THUMBS_UP',
          feedbackText: 'Very poetic and gentle.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe('THUMBS_UP');
      expect(res.body.data.feedbackText).toBe('Very poetic and gentle.');

      // Verify in DB
      const feedback = await prisma.messageFeedback.findFirst({
        where: { messageId: assistantMsg.id, userId: userAId },
      });
      expect(feedback).toBeDefined();
      expect(feedback?.rating).toBe('THUMBS_UP');
    });
  });
});
