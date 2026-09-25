import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterThreadAndCommitmentService } from '../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors/AppError.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    openConversationalThread: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    characterCommitment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('CharacterThreadAndCommitmentService - Threads & Commitments Lifecycle', () => {
  let service: CharacterThreadAndCommitmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CharacterThreadAndCommitmentService.getInstance();
  });

  describe('1. Open Conversational Threads', () => {
    it('creates an open conversational thread with calculated TTL', async () => {
      const mockThread = {
        id: 'thread-1',
        userId: 'user-1',
        characterId: 'char-1',
        conversationId: 'conv-1',
        topic: 'User new project launch',
        contextSnippet: 'User mentioned launching a new app tomorrow',
        status: 'OPEN',
        priority: 0.8,
        sourceMessageId: 'msg-1',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.openConversationalThread.create).mockResolvedValueOnce(mockThread as any);

      const result = await service.createThread({
        userId: 'user-1',
        characterId: 'char-1',
        conversationId: 'conv-1',
        topic: 'User new project launch',
        contextSnippet: 'User mentioned launching a new app tomorrow',
        priority: 0.8,
        ttlHours: 72,
      });

      expect(result.id).toBe('thread-1');
      expect(result.status).toBe('OPEN');
      expect(prisma.openConversationalThread.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          characterId: 'char-1',
          topic: 'User new project launch',
          status: 'OPEN',
          priority: 0.8,
        }),
      });
    });

    it('rejects empty or whitespace thread topic', async () => {
      await expect(
        service.createThread({
          userId: 'user-1',
          characterId: 'char-1',
          topic: '   ',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('resolves an open thread and sets resolvedAt', async () => {
      vi.mocked(prisma.openConversationalThread.findFirst).mockResolvedValueOnce({
        id: 'thread-1',
        userId: 'user-1',
        status: 'OPEN',
      } as any);

      vi.mocked(prisma.openConversationalThread.update).mockResolvedValueOnce({
        id: 'thread-1',
        userId: 'user-1',
        characterId: 'char-1',
        topic: 'User new project',
        status: 'RESOLVED',
        priority: 0.5,
        resolvedAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const resolved = await service.resolveThread('thread-1', 'user-1', 'RESOLVED');
      expect(resolved.status).toBe('RESOLVED');
      expect(prisma.openConversationalThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: {
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
        },
      });
    });
  });

  describe('2. Character Commitments & Anti-Hyperbole Guards', () => {
    it('creates legitimate character commitment', async () => {
      const mockCommitment = {
        id: 'com-1',
        userId: 'user-1',
        characterId: 'char-1',
        conversationId: 'conv-1',
        commitmentType: 'FOLLOW_UP',
        description: 'Ask user about how their presentation went',
        sourceMessageId: 'msg-99',
        status: 'PENDING',
        maxAttempts: 3,
        attemptsMade: 0,
        fulfilledAt: null,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.characterCommitment.create).mockResolvedValueOnce(mockCommitment as any);

      const result = await service.createCommitment({
        userId: 'user-1',
        characterId: 'char-1',
        commitmentType: 'FOLLOW_UP',
        description: 'Ask user about how their presentation went',
        sourceMessageId: 'msg-99',
      });

      expect(result.id).toBe('com-1');
      expect(result.status).toBe('PENDING');
      expect(result.description).toBe('Ask user about how their presentation went');
    });

    it('rejects hyperbolic or rhetorical commitments like "remember this forever"', async () => {
      const hyperbolicStatements = [
        'I promise to remember this forever and always',
        'I will never forget this moment',
        'I will always be here no matter what',
      ];

      for (const statement of hyperbolicStatements) {
        await expect(
          service.createCommitment({
            userId: 'user-1',
            characterId: 'char-1',
            commitmentType: 'FOLLOW_UP',
            description: statement,
          }),
        ).rejects.toThrow(/Rhetorical or hyperbolic statements cannot be stored/);
      }
    });

    it('records attempt and increments attemptsMade or marks EXHAUSTED', async () => {
      vi.mocked(prisma.characterCommitment.findFirst).mockResolvedValueOnce({
        id: 'com-1',
        userId: 'user-1',
        attemptsMade: 2,
        maxAttempts: 3,
        status: 'PENDING',
      } as any);

      vi.mocked(prisma.characterCommitment.update).mockResolvedValueOnce({
        id: 'com-1',
        userId: 'user-1',
        characterId: 'char-1',
        commitmentType: 'FOLLOW_UP',
        description: 'Ask about presentation',
        attemptsMade: 3,
        maxAttempts: 3,
        status: 'EXHAUSTED',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      } as any);

      const updated = await service.recordCommitmentAttempt('com-1', 'user-1');
      expect(updated.status).toBe('EXHAUSTED');
      expect(updated.attemptsMade).toBe(3);
    });

    it('fulfills a commitment and records fulfilledAt', async () => {
      vi.mocked(prisma.characterCommitment.findFirst).mockResolvedValueOnce({
        id: 'com-1',
        userId: 'user-1',
        status: 'PENDING',
      } as any);

      vi.mocked(prisma.characterCommitment.update).mockResolvedValueOnce({
        id: 'com-1',
        userId: 'user-1',
        characterId: 'char-1',
        commitmentType: 'FOLLOW_UP',
        description: 'Ask about presentation',
        status: 'FULFILLED',
        fulfilledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      } as any);

      const fulfilled = await service.fulfillCommitment('com-1', 'user-1');
      expect(fulfilled.status).toBe('FULFILLED');
    });
  });
});
