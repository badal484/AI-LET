import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { MemoryDeduplicationService } from '../src/modules/memory/services/memoryDeduplication.service.js';
import { MemoryExtractionService } from '../src/modules/memory/services/memoryExtraction.service.js';

describe('Phase 5: Memory Deduplication & Conflict Engine', () => {
  const testUserId = '11111111-1111-4111-a111-111111111111';
  const testCharacterId = '22222222-2222-4222-a222-222222222222';
  const testConversationId = '33333333-3333-4333-a333-333333333333';

  beforeEach(async () => {
    await prisma.memoryEmbedding.deleteMany();
    await prisma.memory.deleteMany();
    await prisma.userMemorySettings.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.character.deleteMany({ where: { id: testCharacterId } });

    // Seed test user and character
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'dedupe-test@example.com',
        normalizedEmail: 'dedupe-test@example.com',
        profile: {
          create: {
            displayName: 'Dedupe Tester',
          },
        },
      },
    });

    await prisma.character.create({
      data: {
        id: testCharacterId,
        internalKey: 'dedupe_tester_char',
        slug: 'dedupe-tester-char',
        name: 'Dedupe Companion',
        tagline: 'A character for dedupe testing',
        avatarUrl: 'https://example.com/avatar.png',
        coverImageUrl: 'https://example.com/cover.png',
        archetype: 'Companion',
        backstory: 'A loyal test companion.',
        age: 24,
        gender: 'Female',
        occupation: 'Researcher',
      },
    });

    await prisma.conversation.create({
      data: {
        id: testConversationId,
        userId: testUserId,
        characterId: testCharacterId,
        title: 'Dedupe Test Chat',
      },
    });
  });

  it('detects duplicate user preference and increments reinforcement count instead of creating duplicates', async () => {
    // 1. Initial statement
    await MemoryExtractionService.processConversationMessage({
      userId: testUserId,
      characterId: testCharacterId,
      conversationId: testConversationId,
      userMessage: 'I love drinking black coffee every morning.',
    });

    const initialMemories = await prisma.memory.findMany({ where: { userId: testUserId } });
    expect(initialMemories.length).toBe(1);
    expect(initialMemories[0].reinforcementCount).toBe(1);

    // 2. Repeated statement in subsequent conversation
    await MemoryExtractionService.processConversationMessage({
      userId: testUserId,
      characterId: testCharacterId,
      conversationId: testConversationId,
      userMessage: 'I love drinking black coffee every morning.',
    });

    // Verify still exactly 1 record, but reinforced
    const updatedMemories = await prisma.memory.findMany({ where: { userId: testUserId } });
    expect(updatedMemories.length).toBe(1);
    expect(updatedMemories[0].id).toBe(initialMemories[0].id);
    expect(updatedMemories[0].reinforcementCount).toBe(2);
    expect(updatedMemories[0].confidenceScore).toBeGreaterThanOrEqual(initialMemories[0].confidenceScore);
  });

  it('marks older contradictory memory as SUPERSEDED with supersededById reference', async () => {
    // 1. Initial memory: Location in Delhi
    const mem1 = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: testCharacterId,
        scope: 'GLOBAL_USER',
        category: 'PERSONAL_FACT',
        memoryType: 'SEMANTIC_FACT',
        content: 'User lives in Delhi, India',
        status: 'ACTIVE',
      },
    });

    // 2. New contradictory memory: User moved to Bengaluru
    const decision = await MemoryDeduplicationService.evaluateDeduplication(
      testUserId,
      testCharacterId,
      'User lives in Bengaluru, India',
      'PERSONAL_FACT',
      'GLOBAL_USER',
    );

    // Apply creation & superseding
    const mem2 = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: testCharacterId,
        scope: 'GLOBAL_USER',
        category: 'PERSONAL_FACT',
        memoryType: 'SEMANTIC_FACT',
        content: 'User lives in Bengaluru, India',
        status: 'ACTIVE',
      },
    });

    await MemoryDeduplicationService.applySuperseding(mem2.id, [mem1.id]);

    // Verify mem1 is now superseded and links to mem2
    const checkMem1 = await prisma.memory.findUnique({ where: { id: mem1.id } });
    expect(checkMem1?.status).toBe('SUPERSEDED');
    expect(checkMem1?.supersededById).toBe(mem2.id);

    // Verify mem2 is active
    const checkMem2 = await prisma.memory.findUnique({ where: { id: mem2.id } });
    expect(checkMem2?.status).toBe('ACTIVE');
  });
});
