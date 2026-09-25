import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { MemoryRetrieverService } from '../src/modules/memory/services/memoryRetriever.service.js';
import { MemoryEmbeddingService } from '../src/modules/memory/services/memoryEmbedding.service.js';

describe('Phase 5: Memory Hybrid Retrieval & Ranking Engine', () => {
  const testUserId = '11111111-1111-4111-a111-111111111111';
  const charAId = '22222222-2222-4222-a222-222222222222';
  const charBId = '33333333-3333-4333-a333-333333333333';

  beforeEach(async () => {
    await prisma.memoryAccessLog.deleteMany();
    await prisma.memoryEmbedding.deleteMany();
    await prisma.memory.deleteMany();
    await prisma.userMemorySettings.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.character.deleteMany({ where: { id: { in: [charAId, charBId] } } });

    // Seed test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'retriever-test@example.com',
        normalizedEmail: 'retriever-test@example.com',
        profile: { create: { displayName: 'Retrieval Tester' } },
      },
    });

    // Seed Character A & Character B
    await prisma.character.createMany({
      data: [
        {
          id: charAId,
          internalKey: 'char_a_memory',
          slug: 'char-a-memory',
          name: 'Luna',
          tagline: 'Companion A',
          avatarUrl: 'https://example.com/a.png',
          coverImageUrl: 'https://example.com/a_cover.png',
          archetype: 'Companion',
          backstory: 'Character A backstory.',
          age: 23,
          gender: 'Female',
          occupation: 'Artist',
        },
        {
          id: charBId,
          internalKey: 'char_b_memory',
          slug: 'char-b-memory',
          name: 'Nova',
          tagline: 'Companion B',
          avatarUrl: 'https://example.com/b.png',
          coverImageUrl: 'https://example.com/b_cover.png',
          archetype: 'Companion',
          backstory: 'Character B backstory.',
          age: 26,
          gender: 'Female',
          occupation: 'Engineer',
        },
      ],
    });
  });

  it('retrieves relevant memories ranked by hybrid multi-factor score', async () => {
    // 1. Seed multiple memories with varying importance & reinforcement
    const memMatch = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: charAId,
        scope: 'CHARACTER_SPECIFIC',
        category: 'GOAL',
        content: 'The user is building an AI startup platform.',
        importanceScore: 0.9,
        confidenceScore: 0.95,
        reinforcementCount: 3,
        status: 'ACTIVE',
      },
    });
    await MemoryEmbeddingService.saveMemoryEmbedding(memMatch.id, memMatch.content);

    const memIrrelevant = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: charAId,
        scope: 'CHARACTER_SPECIFIC',
        category: 'INTEREST',
        content: 'The user likes collecting vintage postage stamps.',
        importanceScore: 0.4,
        confidenceScore: 0.7,
        status: 'ACTIVE',
      },
    });
    await MemoryEmbeddingService.saveMemoryEmbedding(memIrrelevant.id, memIrrelevant.content);

    // 2. Query related to startup
    const result = await MemoryRetrieverService.retrieveContext({
      userId: testUserId,
      characterId: charAId,
      query: 'How is your tech startup coming along?',
    });

    expect(result.memories.length).toBeGreaterThan(0);
    expect(result.memories[0].id).toBe(memMatch.id);
    expect(result.formattedPromptBlock).toContain('AI startup platform');
  });

  it('enforces character privacy scoping: Character B cannot retrieve Character A private relationship memory', async () => {
    // Create Character A private relationship memory
    const memPrivateA = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: charAId,
        scope: 'CHARACTER_SPECIFIC',
        category: 'RELATIONSHIP',
        content: 'The user shared a deeply personal childhood story exclusively with Luna.',
        status: 'ACTIVE',
      },
    });
    await MemoryEmbeddingService.saveMemoryEmbedding(memPrivateA.id, memPrivateA.content);

    // Create Global user fact
    const memGlobal = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: null,
        scope: 'GLOBAL_USER',
        category: 'PERSONAL_FACT',
        content: 'The user speaks fluent English and Hindi.',
        status: 'ACTIVE',
      },
    });
    await MemoryEmbeddingService.saveMemoryEmbedding(memGlobal.id, memGlobal.content);

    // 1. Retrieve as Character A -> should see both
    const resultA = await MemoryRetrieverService.retrieveContext({
      userId: testUserId,
      characterId: charAId,
      query: 'Tell me about our past conversations.',
    });
    const idsA = resultA.memories.map(m => m.id);
    expect(idsA).toContain(memPrivateA.id);
    expect(idsA).toContain(memGlobal.id);

    // 2. Retrieve as Character B -> should ONLY see global memory, NOT Character A private memory
    const resultB = await MemoryRetrieverService.retrieveContext({
      userId: testUserId,
      characterId: charBId,
      query: 'Tell me about childhood stories and languages spoken.',
    });
    const idsB = resultB.memories.map(m => m.id);
    expect(idsB).not.toContain(memPrivateA.id);
    expect(idsB).toContain(memGlobal.id);
  });

  it('enforces token budget limits and retrieval deduplication', async () => {
    for (let i = 0; i < 10; i++) {
      const mem = await prisma.memory.create({
        data: {
          userId: testUserId,
          scope: 'GLOBAL_USER',
          category: 'PREFERENCE',
          content: `User preference item number ${i}: prefers light mode UI theme option ${i}`,
          importanceScore: 0.8,
          confidenceScore: 0.9,
          status: 'ACTIVE',
        },
      });
      await MemoryEmbeddingService.saveMemoryEmbedding(mem.id, mem.content);
    }

    const result = await MemoryRetrieverService.retrieveContext({
      userId: testUserId,
      characterId: charAId,
      query: 'What UI theme preferences does the user have?',
      maxMemories: 3,
      maxTokens: 100,
    });

    expect(result.memories.length).toBeLessThanOrEqual(3);
    expect(result.tokenCount).toBeLessThanOrEqual(100);
  });

  it('returns empty context when user memory is disabled', async () => {
    await prisma.userMemorySettings.create({
      data: {
        userId: testUserId,
        memoryEnabled: false,
      },
    });

    await prisma.memory.create({
      data: {
        userId: testUserId,
        scope: 'GLOBAL_USER',
        category: 'GOAL',
        content: 'User is learning TypeScript',
        status: 'ACTIVE',
      },
    });

    const result = await MemoryRetrieverService.retrieveContext({
      userId: testUserId,
      characterId: charAId,
      query: 'TypeScript programming',
    });

    expect(result.memories.length).toBe(0);
    expect(result.formattedPromptBlock).toBe('');
  });
});
