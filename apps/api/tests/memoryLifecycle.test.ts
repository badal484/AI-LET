import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { MemoryCrudService } from '../src/modules/memory/services/memoryCrud.service.js';
import { UserMemorySettingsService } from '../src/modules/memory/services/userMemorySettings.service.js';

describe('Phase 5: Memory Lifecycle & Privacy Management', () => {
  const testUserId = '11111111-1111-4111-a111-111111111111';
  const otherUserId = '44444444-4444-4444-a444-444444444444';
  const testCharacterId = '22222222-2222-4222-a222-222222222222';

  beforeEach(async () => {
    await prisma.memoryEmbedding.deleteMany();
    await prisma.memory.deleteMany();
    await prisma.userMemorySettings.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany({ where: { id: { in: [testUserId, otherUserId] } } });
    await prisma.character.deleteMany({ where: { id: testCharacterId } });

    // Seed test users
    await prisma.user.createMany({
      data: [
        {
          id: testUserId,
          email: 'lifecycle-test@example.com',
          normalizedEmail: 'lifecycle-test@example.com',
        },
        {
          id: otherUserId,
          email: 'other-user@example.com',
          normalizedEmail: 'other-user@example.com',
        },
      ],
    });

    await prisma.character.create({
      data: {
        id: testCharacterId,
        internalKey: 'lifecycle_char',
        slug: 'lifecycle-char',
        name: 'Lifecycle Companion',
        tagline: 'A character for testing lifecycle',
        avatarUrl: 'https://example.com/avatar.png',
        coverImageUrl: 'https://example.com/cover.png',
        archetype: 'Companion',
        backstory: 'A loyal test companion.',
        age: 24,
        gender: 'Female',
        occupation: 'Scientist',
      },
    });
  });

  it('allows user to list, update, and delete individual memories with strict ownership enforcement', async () => {
    // 1. Seed memories for test user and other user
    const mem1 = await prisma.memory.create({
      data: {
        userId: testUserId,
        characterId: testCharacterId,
        scope: 'CHARACTER_SPECIFIC',
        category: 'PREFERENCE',
        content: 'Prefers dark mode in all IDEs',
        status: 'ACTIVE',
      },
    });

    const otherMem = await prisma.memory.create({
      data: {
        userId: otherUserId,
        scope: 'GLOBAL_USER',
        category: 'GOAL',
        content: 'Other user secret goal',
        status: 'ACTIVE',
      },
    });

    // 2. List memories for test user -> should only see test user memory
    const list = await MemoryCrudService.listMemories(testUserId, { limit: 20 });
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(mem1.id);

    // 3. Update memory content
    const updated = await MemoryCrudService.updateMemory(testUserId, mem1.id, {
      content: 'Prefers dark mode with high contrast in all IDEs',
      category: 'PREFERENCE',
    });
    expect(updated.content).toBe('Prefers dark mode with high contrast in all IDEs');

    // 4. Test unauthorized access: User cannot update or delete other user memory
    await expect(
      MemoryCrudService.updateMemory(testUserId, otherMem.id, { content: 'Hacked' }),
    ).rejects.toThrow();

    await expect(
      MemoryCrudService.deleteMemory(testUserId, otherMem.id),
    ).rejects.toThrow();

    // 5. Delete individual memory
    await MemoryCrudService.deleteMemory(testUserId, mem1.id);
    const checkDeleted = await prisma.memory.findUnique({ where: { id: mem1.id } });
    expect(checkDeleted?.status).toBe('DELETED');
    expect(checkDeleted?.deletedAt).toBeDefined();
  });

  it('implements Forget Everything by wiping all user memories and removing vector embeddings', async () => {
    // Create 3 memories for test user and 1 for other user
    for (let i = 1; i <= 3; i++) {
      const m = await prisma.memory.create({
        data: {
          userId: testUserId,
          scope: 'GLOBAL_USER',
          category: 'PERSONAL_FACT',
          content: `Test user fact ${i}`,
          status: 'ACTIVE',
        },
      });
      await prisma.memoryEmbedding.create({
        data: {
          memoryId: m.id,
          modelName: 'mock',
          embedding: [0.1, 0.2, 0.3],
        },
      });
    }

    const otherM = await prisma.memory.create({
      data: {
        userId: otherUserId,
        scope: 'GLOBAL_USER',
        category: 'PERSONAL_FACT',
        content: 'Other user preserved fact',
        status: 'ACTIVE',
      },
    });
    await prisma.memoryEmbedding.create({
      data: {
        memoryId: otherM.id,
        modelName: 'mock',
        embedding: [0.4, 0.5, 0.6],
      },
    });

    // Execute Forget All Memories
    const wipeResult = await UserMemorySettingsService.forgetAllMemories(testUserId);
    expect(wipeResult.deletedCount).toBe(3);

    // Verify test user memories are soft-deleted and embeddings purged
    const activeTestMemories = await prisma.memory.findMany({
      where: { userId: testUserId, status: 'ACTIVE', deletedAt: null },
    });
    expect(activeTestMemories.length).toBe(0);

    const testEmbeddings = await prisma.memoryEmbedding.findMany({
      where: { memory: { userId: testUserId } },
    });
    expect(testEmbeddings.length).toBe(0);

    // Verify other user memories and embeddings remain intact
    const otherCheck = await prisma.memory.findMany({
      where: { userId: otherUserId, status: 'ACTIVE' },
    });
    expect(otherCheck.length).toBe(1);
  });

  it('manages user memory settings properly', async () => {
    // 1. Get default settings
    const initial = await UserMemorySettingsService.getSettings(testUserId);
    expect(initial.memoryEnabled).toBe(true);
    expect(initial.personalizationEnabled).toBe(true);
    expect(initial.allowSensitiveMemory).toBe(false);

    // 2. Update settings
    const updated = await UserMemorySettingsService.updateSettings(testUserId, {
      memoryEnabled: false,
      allowSensitiveMemory: true,
      excludedCharacterIds: [testCharacterId],
    });

    expect(updated.memoryEnabled).toBe(false);
    expect(updated.allowSensitiveMemory).toBe(true);
    expect(updated.excludedCharacterIds).toContain(testCharacterId);
  });
});
