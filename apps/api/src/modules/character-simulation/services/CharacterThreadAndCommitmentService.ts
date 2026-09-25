import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  OpenConversationalThreadItem,
  ThreadStatus,
  CharacterCommitmentItem,
  CommitmentStatus,
} from '@ai-companion/types';

export interface CreateThreadInput {
  userId: string;
  characterId: string;
  conversationId?: string | null;
  topic: string;
  contextSnippet?: string | null;
  priority?: number;
  sourceMessageId?: string | null;
  ttlHours?: number;
}

export interface CreateCommitmentInput {
  userId: string;
  characterId: string;
  conversationId?: string | null;
  commitmentType: string;
  description: string;
  sourceMessageId?: string | null;
  ttlHours?: number;
  maxAttempts?: number;
}

export class CharacterThreadAndCommitmentService {
  private static instance: CharacterThreadAndCommitmentService;

  private constructor() {}

  public static getInstance(): CharacterThreadAndCommitmentService {
    if (!CharacterThreadAndCommitmentService.instance) {
      CharacterThreadAndCommitmentService.instance = new CharacterThreadAndCommitmentService();
    }
    return CharacterThreadAndCommitmentService.instance;
  }

  // =========================================================================
  // THREAD OPERATIONS
  // =========================================================================

  /**
   * Creates an unresolved conversation thread with TTL.
   */
  public async createThread(input: CreateThreadInput): Promise<OpenConversationalThreadItem> {
    if (!input.topic || input.topic.trim().length === 0) {
      throw new ValidationError('Thread topic is required.');
    }

    const ttlHours = input.ttlHours ?? 72; // Default 3 days TTL
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const created = await prisma.openConversationalThread.create({
      data: {
        userId: input.userId,
        characterId: input.characterId,
        conversationId: input.conversationId || null,
        topic: input.topic.trim(),
        contextSnippet: input.contextSnippet?.trim() || null,
        status: 'OPEN',
        priority: input.priority ?? 0.5,
        sourceMessageId: input.sourceMessageId || null,
        expiresAt,
      },
    });

    logger.info(`CharacterThreadService: created thread '${created.id}' ("${created.topic}") for user '${input.userId}'`);
    return this.mapThread(created);
  }

  /**
   * Lists active open threads for a user-character pair.
   */
  public async listActiveThreads(userId: string, characterId: string): Promise<OpenConversationalThreadItem[]> {
    const now = new Date();
    const threads = await prisma.openConversationalThread.findMany({
      where: {
        userId,
        characterId,
        status: { in: ['OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_SYSTEM'] },
        expiresAt: { gt: now },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return threads.map((t) => this.mapThread(t));
  }

  /**
   * Resolves or dismisses an open thread.
   */
  public async resolveThread(threadId: string, userId: string, status: 'RESOLVED' | 'DISMISSED' = 'RESOLVED'): Promise<OpenConversationalThreadItem> {
    const existing = await prisma.openConversationalThread.findFirst({
      where: { id: threadId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Thread '${threadId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.openConversationalThread.update({
      where: { id: threadId },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });

    logger.info(`CharacterThreadService: resolved thread '${threadId}' as '${status}'`);
    return this.mapThread(updated);
  }

  // =========================================================================
  // COMMITMENT OPERATIONS
  // =========================================================================

  /**
   * Creates a character commitment with verification guards.
   */
  public async createCommitment(input: CreateCommitmentInput): Promise<CharacterCommitmentItem> {
    if (!input.description || input.description.trim().length === 0) {
      throw new ValidationError('Commitment description is required.');
    }

    // Guard against trivial or rhetorical commitments
    const lower = input.description.toLowerCase();
    if (
      lower.includes('remember this forever') ||
      lower.includes('never forget') ||
      lower.includes('always be here')
    ) {
      throw new ValidationError(
        'Rhetorical or hyperbolic statements cannot be stored as actionable commitments.'
      );
    }

    const ttlHours = input.ttlHours ?? 48; // Default 48h TTL
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const created = await prisma.characterCommitment.create({
      data: {
        userId: input.userId,
        characterId: input.characterId,
        conversationId: input.conversationId || null,
        commitmentType: input.commitmentType || 'FOLLOW_UP',
        description: input.description.trim(),
        sourceMessageId: input.sourceMessageId || null,
        status: 'PENDING',
        maxAttempts: input.maxAttempts ?? 3,
        attemptsMade: 0,
        expiresAt,
      },
    });

    logger.info(`CharacterCommitmentService: created commitment '${created.id}' ("${created.description}") for user '${input.userId}'`);
    return this.mapCommitment(created);
  }

  /**
   * Lists pending commitments for a user-character pair.
   */
  public async listPendingCommitments(userId: string, characterId: string): Promise<CharacterCommitmentItem[]> {
    const now = new Date();
    const commitments = await prisma.characterCommitment.findMany({
      where: {
        userId,
        characterId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return commitments.map((c) => this.mapCommitment(c));
  }

  /**
   * Fulfills or cancels a commitment.
   */
  public async updateCommitmentStatus(
    commitmentId: string,
    userId: string,
    status: 'FULFILLED' | 'CANCELLED' | 'EXPIRED'
  ): Promise<CharacterCommitmentItem> {
    const existing = await prisma.characterCommitment.findFirst({
      where: { id: commitmentId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Commitment '${commitmentId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.characterCommitment.update({
      where: { id: commitmentId },
      data: {
        status,
        fulfilledAt: status === 'FULFILLED' ? new Date() : undefined,
      },
    });

    logger.info(`CharacterCommitmentService: commitment '${commitmentId}' updated to '${status}'`);
    return this.mapCommitment(updated);
  }

  /**
   * Fulfills a commitment directly.
   */
  public async fulfillCommitment(commitmentId: string, userId: string): Promise<CharacterCommitmentItem> {
    return this.updateCommitmentStatus(commitmentId, userId, 'FULFILLED');
  }

  /**
   * Records an attempt to fulfill a commitment, exhausting it if maxAttempts reached.
   */
  public async recordCommitmentAttempt(commitmentId: string, userId: string): Promise<CharacterCommitmentItem> {
    const existing = await prisma.characterCommitment.findFirst({
      where: { id: commitmentId, userId },
    });

    if (!existing) {
      throw new NotFoundError(`Commitment '${commitmentId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const nextAttempts = existing.attemptsMade + 1;
    const isExhausted = nextAttempts >= existing.maxAttempts;

    const updated = await prisma.characterCommitment.update({
      where: { id: commitmentId },
      data: {
        attemptsMade: nextAttempts,
        status: isExhausted ? 'EXHAUSTED' : existing.status,
      },
    });

    return this.mapCommitment(updated);
  }

  private mapThread(record: any): OpenConversationalThreadItem {
    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      topic: record.topic,
      contextSnippet: record.contextSnippet,
      status: record.status as ThreadStatus,
      priority: record.priority,
      sourceMessageId: record.sourceMessageId,
      expiresAt: record.expiresAt.toISOString(),
      resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapCommitment(record: any): CharacterCommitmentItem {
    return {
      id: record.id,
      userId: record.userId,
      characterId: record.characterId,
      conversationId: record.conversationId,
      commitmentType: record.commitmentType,
      description: record.description,
      sourceMessageId: record.sourceMessageId,
      status: record.status as CommitmentStatus,
      maxAttempts: record.maxAttempts,
      attemptsMade: record.attemptsMade,
      expiresAt: record.expiresAt.toISOString(),
      fulfilledAt: record.fulfilledAt ? record.fulfilledAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
