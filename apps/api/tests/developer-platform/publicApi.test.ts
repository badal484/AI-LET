import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { AIOrchestrator } from '../../src/infrastructure/ai/AIOrchestrator.js';

describe('Public API Gateway (/v1) End-to-End HTTP Tests', () => {
  const app = createApp();
  const authService = DeveloperAuthService.getInstance();

  const developerUserId = '00000000-0000-0000-0000-000000000001';
  let liveSecretKey: string;
  let testCharacterId: string;

  beforeEach(async () => {
    // Clean tables
    await prisma.developerUsageRecord.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();

    // Create developer user
    await prisma.user.create({
      data: {
        id: developerUserId,
        email: 'developer@example.com',
        normalizedEmail: 'developer@example.com',
        status: 'ACTIVE',
      },
    });

    // Create project and key
    const project = await authService.createProject({
      userId: developerUserId,
      name: 'Public API Test Project',
      environment: 'PRODUCTION',
    });

    const keyResult = await authService.createApiKey({
      projectId: project.id,
      userId: developerUserId,
      name: 'Test Full Key',
      scopes: ['*'],
    });
    liveSecretKey = keyResult.secretKey;

    // Create a public test character
    const char = await prisma.character.create({
      data: {
        id: '00000000-0000-0000-0000-000000000055',
        createdById: developerUserId,
        name: 'Aria Cosmos',
        slug: 'aria-cosmos',
        internalKey: 'aria_cosmos',
        tagline: 'Astrophysicist Companion',
        shortDescription: 'Deep cosmos explorer',
        longDescription: 'Deep cosmos explorer researching exoplanets',
        avatarUrl: 'https://assets.companion.ai/avatars/aria.webp',
        coverImageUrl: 'https://assets.companion.ai/covers/aria.webp',
        archetype: 'Scholar',
        backstory: 'Astronomer with passion for telescope imaging',
        age: 28,
        gender: 'female',
        occupation: 'Astrophysicist',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
    });
    testCharacterId = char.id;

    // Mock AI orchestrator response
    vi.spyOn(AIOrchestrator.getInstance(), 'generateText').mockResolvedValue({
      text: 'Hello from Aria! The cosmic microwave background is fascinating.',
      model: 'gpt-4o-mini',
      provider: 'openai',
      usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
    });
  });

  it('rejects unauthenticated requests with standard Public API error contract', async () => {
    const res = await request(app).get('/v1/characters');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('unauthorized');
    expect(res.body.error.request_id).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('successfully retrieves published characters with valid API key', async () => {
    const res = await request(app)
      .get('/v1/characters')
      .set('Authorization', `Bearer ${liveSecretKey}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Aria Cosmos');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('creates conversation and sends message to receive assistant reply', async () => {
    // 1. Create conversation
    const convRes = await request(app)
      .post('/v1/conversations')
      .set('Authorization', `Bearer ${liveSecretKey}`)
      .send({
        characterId: testCharacterId,
      });

    expect(convRes.status).toBe(201);
    expect(convRes.body.data.id).toBeDefined();
    const conversationId = convRes.body.data.id;

    // 2. Post message
    const msgRes = await request(app)
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${liveSecretKey}`)
      .send({
        content: 'Tell me about the cosmos',
      });

    expect(msgRes.status).toBe(200);
    expect(msgRes.body.data.role).toBe('assistant');
    expect(msgRes.body.data.content).toContain('cosmic microwave background');
  });
});
