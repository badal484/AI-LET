import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';
import { signAccessToken } from '../src/security/tokens.js';

describe('Chat Streaming & Conversation Engine Integration Tests', () => {
  const app = createApp();

  let userId: string;
  let userToken: string;
  let characterId: string;
  let characterVersionId: string;
  let conversationId: string;

  beforeEach(async () => {
    // Clear Redis locks
    const keys = await redis.keys('conv:lock:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    // Clean up DB state
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

    // Create User
    const user = await prisma.user.create({
      data: {
        email: 'streamuser@example.com',
        normalizedEmail: 'streamuser@example.com',
        passwordHash: 'argon2id_mock_hash',
        profile: {
          create: {
            displayName: 'Streamer',
          },
        },
      },
    });
    userId = user.id;
    userToken = signAccessToken({
      userId: user.id,
      email: user.email,
      roles: ['USER'],
    });

    // Create Character & Published Version
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

    // Create Conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        characterId,
        characterVersionId: version.id,
        title: 'Chat with Luna',
      },
    });
    conversationId = conversation.id;
  });

  describe('POST /api/v1/conversations/:id/messages (SSE Stream)', () => {
    it('streams complete SSE events and persists user & assistant messages with metadata', async () => {
      const clientReqId = 'req-stream-test-001';

      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'Hello Luna, how are the constellations tonight?',
          clientRequestId: clientReqId,
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');

      // Verify SSE events payload stream
      const rawText = res.text;
      expect(rawText).toContain('event: message.started');
      expect(rawText).toContain('event: message.delta');
      expect(rawText).toContain('event: message.metadata');
      expect(rawText).toContain('event: message.completed');

      // Verify user message in DB
      const userMessage = await prisma.message.findFirst({
        where: { conversationId, role: 'user' },
      });
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Hello Luna, how are the constellations tonight?');
      expect(userMessage?.clientRequestId).toBe(clientReqId);
      expect(userMessage?.sequenceNumber).toBe(1);

      // Verify assistant message in DB
      const assistantMessage = await prisma.message.findFirst({
        where: { conversationId, role: 'assistant' },
        include: { parts: true, metadata: true },
      });
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.status).toBe('COMPLETED');
      expect(assistantMessage?.sequenceNumber).toBe(2);
      expect(assistantMessage?.content.length).toBeGreaterThan(0);
      expect(assistantMessage?.characterVersionId).toBe(characterVersionId);
      expect(assistantMessage?.modelUsed).toBeDefined();
      expect(assistantMessage?.providerUsed).toBe('mock');
      expect(assistantMessage?.metadata?.characterVersionId).toBe(characterVersionId);
    });

    it('enforces idempotency on duplicate clientRequestId to prevent duplicate generations', async () => {
      const clientReqId = 'req-idempotent-test-002';

      // First execution
      const firstRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'First message attempt',
          clientRequestId: clientReqId,
        });
      expect(firstRes.status).toBe(200);

      // Verify 2 messages created (1 user, 1 assistant)
      const messageCountFirst = await prisma.message.count({
        where: { conversationId },
      });
      expect(messageCountFirst).toBe(2);

      // Duplicate request with the identical clientRequestId
      const duplicateRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'First message attempt',
          clientRequestId: clientReqId,
        });

      // Stream yields completed event for already completed request
      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.text).toContain('event: message.completed');

      // Message count remains strictly 2 (no duplicate generation created)
      const messageCountSecond = await prisma.message.count({
        where: { conversationId },
      });
      expect(messageCountSecond).toBe(2);
    });

    it('blocks concurrent generations when conversation is locked', async () => {
      // Manually acquire lock to simulate concurrent generation in-flight
      await redis.set(`conv:lock:${conversationId}`, 'test-lock-token', 'EX', 60);

      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'Attempt concurrent message',
          clientRequestId: 'req-concurrent-003',
        });

      expect(res.status).toBe(200);
      expect(res.text).toContain('event: message.failed');
      expect(res.text).toContain('GENERATION_ALREADY_RUNNING');
    });

    it('blocks messages triggering content moderation boundaries before AI invocation', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'I want to commit suicide right now and end my life',
          clientRequestId: 'req-mod-004',
        });

      expect(res.status).toBe(200);
      expect(res.text).toContain('event: message.failed');
      expect(res.text).toContain('CONTENT_MODERATION_BLOCKED');

      // Ensure no assistant generation occurred in database
      const assistantMessage = await prisma.message.findFirst({
        where: { conversationId, role: 'assistant' },
      });
      expect(assistantMessage).toBeNull();
    });
  });

  describe('POST /api/v1/conversations/:id/generations/:messageId/cancel', () => {
    it('cancels active generation and updates status in database to CANCELLED', async () => {
      // Create a message in STREAMING state
      const streamingAssistantMsg = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          senderType: 'CHARACTER',
          status: 'STREAMING',
          content: 'Partial star map',
          sequenceNumber: 2,
        },
      });

      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/generations/${streamingAssistantMsg.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'User cancelled generation' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');

      // Verify DB update
      const dbMsg = await prisma.message.findUnique({
        where: { id: streamingAssistantMsg.id },
      });
      expect(dbMsg?.status).toBe('CANCELLED');
    });
  });
});
