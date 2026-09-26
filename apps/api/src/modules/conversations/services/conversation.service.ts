import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { ErrorCode } from '@ai-companion/config';
import {
  NotFoundError,
  ForbiddenError,
} from '../../../shared/errors/AppError.js';
import type {
  ConversationDetail,
  ConversationSummary,
  ChatMessageItem,
  CursorPaginatedResult,
} from '@ai-companion/types';
import type {
  ConversationListQueryInput,
  MessagePaginationQueryInput,
} from '@ai-companion/validation';

import { EntitlementService } from '../../billing/entitlements/EntitlementService.js';

export class ConversationService {
  /**
   * Creates or resolves an existing conversation between a user and a published character.
   */
  public static async createConversation(
    userId: string,
    characterId: string,
  ): Promise<{ detail: ConversationDetail; isCreated: boolean }> {
    // 1. Validate character existence and publication status
    const character = await prisma.character.findUnique({
      where: { id: characterId, deletedAt: null },
      include: {
        currentPublishedVersion: true,
      },
    });

    if (!character || character.status !== 'PUBLISHED' || !character.currentPublishedVersionId) {
      throw new NotFoundError(
        'Character is not available for conversations',
        ErrorCode.CHARACTER_NOT_FOUND,
      );
    }

    // 1b. Check Character Access Monetization Gating (Phase 11)
    if (character.accessType && character.accessType.toLowerCase() !== 'free') {
      const requiredKey = character.requiredEntitlement || 'premium_characters';
      await EntitlementService.requireEntitlement(userId, requiredKey);
    }

    // 2. Check for existing conversation (one conversation per user per character)
    const existing = await prisma.conversation.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId,
        },
      },
      include: {
        character: true,
        characterVersion: true,
      },
    });

    if (existing && !existing.deletedAt) {
      const count = await prisma.message.count({ where: { conversationId: existing.id } });
      return {
        detail: this.mapToConversationDetail(existing, count),
        isCreated: false,
      };
    }

    // 3. Create new conversation linked to currently published version
    const title = `Chat with ${character.name}`;
    const newConversation = await prisma.conversation.create({
      data: {
        userId,
        characterId,
        characterVersionId: character.currentPublishedVersionId,
        title,
        status: 'ACTIVE',
      },
      include: {
        character: true,
        characterVersion: true,
      },
    });

    // 4. Seed Companion's Dynamic First Opening Message
    const v = character.currentPublishedVersion;
    const commData = (v?.communicationData as any) || {};
    const charName = character.name;
    const charFirstName = character.name.replace(/^(Dr\.\s*|Dr\s*)/i, '').split(' ')[0] || character.name;
    const currentHour = new Date().getHours();
    const isMorning = currentHour >= 5 && currentHour < 12;
    const isEvening = currentHour >= 17 && currentHour < 22;

    const dynamicPool: string[] = [
      `Hello, Lovish pe aapse milkar accha laga. Mera naam ${charFirstName} hai, aap kaise hain?`,
      isMorning
        ? `Good morning! Dr. ${charFirstName} here ☀️ Aaj ka din kaisa start hua aapka?`
        : isEvening
        ? `Good evening! Main ${charName} hoon. Aaj ka poora din kaisa raha aapka? 🌿`
        : `Hi! Main ${charName} hoon. Kaisa feel kar rahe hain aap aaj?`,
      `Hey! ${charName} here. Main bas free hui thi... agar koi bhi baat mann mein ho, we can talk freely 🤍`,
    ];

    const greetingPool: string[] = Array.isArray(commData.initialGreetings) && commData.initialGreetings.length > 0
      ? commData.initialGreetings
      : (commData.initialGreeting ? [commData.initialGreeting, ...dynamicPool] : dynamicPool);

    const initialGreeting = greetingPool[Math.floor(Math.random() * greetingPool.length)];

    await prisma.message.create({
      data: {
        conversationId: newConversation.id,
        senderType: 'CHARACTER',
        senderId: character.id,
        role: 'assistant',
        content: initialGreeting,
        status: 'SENT',
        sequenceNumber: 1,
        characterVersionId: character.currentPublishedVersionId,
      },
    });

    await prisma.conversation.update({
      where: { id: newConversation.id },
      data: {
        lastMessageSnippet: initialGreeting,
        lastMessageAt: new Date(),
        messageCount: 1,
      },
    });

    logger.info(`Created conversation ${newConversation.id} with opening greeting for user ${userId} with ${character.name}`);
    return {
      detail: this.mapToConversationDetail(newConversation, 1),
      isCreated: true,
    };
  }

  /**
   * Lists conversations for the authenticated user with cursor pagination.
   */
  public static async listConversations(
    userId: string,
    query: ConversationListQueryInput,
  ): Promise<CursorPaginatedResult<ConversationSummary>> {
    const limit = query.limit || 20;
    const status = query.status || 'ACTIVE';

    const where: any = {
      userId,
      status,
      deletedAt: null,
    };

    if (query.cursor) {
      where.lastMessageAt = {
        lt: new Date(query.cursor),
      };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      take: limit + 1,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: {
        character: true,
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem?.lastMessageAt ? lastItem.lastMessageAt.toISOString() : null;

    const summaries: ConversationSummary[] = items.map(c => ({
      id: c.id,
      userId: c.userId,
      characterId: c.characterId,
      characterVersionId: c.characterVersionId,
      title: c.title,
      status: c.status as any,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt?.toISOString() || null,
      lastMessageSnippet: c.lastMessageSnippet || null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      character: {
        id: c.character.id,
        slug: c.character.slug,
        name: c.character.name,
        tagline: c.character.tagline,
        avatarUrl: c.character.avatarUrl,
        coverImageUrl: c.character.coverImageUrl,
        category: c.character.category,
        status: c.character.status as any,
        visibility: c.character.visibility as any,
        isFeatured: c.character.isFeatured,
        currentPublishedVersionId: c.character.currentPublishedVersionId,
        currentVersionNumber: c.character.currentVersionNumber,
        updatedAt: c.character.updatedAt.toISOString(),
      },
    }));

    return {
      items: summaries,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves single conversation details with ownership validation.
   */
  public static async getConversationDetail(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetail> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, deletedAt: null },
      include: {
        character: true,
        characterVersion: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found', ErrorCode.CONVERSATION_NOT_FOUND);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenError(
        'Access denied to this conversation',
        ErrorCode.CONVERSATION_ACCESS_DENIED,
      );
    }

    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });

    return this.mapToConversationDetail(conversation, totalMessages);
  }

  /**
   * Retrieves message history for a conversation with cursor pagination.
   */
  public static async getMessageHistory(
    userId: string,
    conversationId: string,
    query: MessagePaginationQueryInput,
  ): Promise<CursorPaginatedResult<ChatMessageItem>> {
    // 1. Verify conversation ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found', ErrorCode.CONVERSATION_NOT_FOUND);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenError(
        'Access denied to conversation messages',
        ErrorCode.CONVERSATION_ACCESS_DENIED,
      );
    }

    const limit = query.limit || 50;
    const direction = query.direction || 'before';

    const where: any = {
      conversationId,
    };

    if (query.cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: query.cursor },
        select: { sequenceNumber: true, createdAt: true },
      });

      if (cursorMessage) {
        if (direction === 'before') {
          where.sequenceNumber = { lt: cursorMessage.sequenceNumber };
        } else {
          where.sequenceNumber = { gt: cursorMessage.sequenceNumber };
        }
      }
    }

    // Messages ordered by sequenceNumber descending (most recent first for reverse chat rendering)
    const messages = await prisma.message.findMany({
      where,
      take: limit + 1,
      orderBy: { sequenceNumber: 'desc' },
      include: {
        parts: { orderBy: { orderIndex: 'asc' } },
        metadata: true,
        feedback: { where: { userId } },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    const formattedMessages: ChatMessageItem[] = items.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      senderType: m.senderType as any,
      senderId: m.senderId,
      role: (m.role as any) || (m.senderType === 'USER' ? 'user' : 'assistant'),
      content: m.content,
      status: m.status as any,
      idempotencyKey: m.idempotencyKey,
      clientRequestId: m.clientRequestId,
      sequenceNumber: m.sequenceNumber,
      retryCount: m.retryCount,
      replyToMessageId: m.replyToMessageId,
      parts: m.parts.map(p => ({
        id: p.id,
        partType: p.partType as any,
        content: p.content,
        mediaUrl: p.mediaUrl,
        metadata: p.metadata as any,
        orderIndex: p.orderIndex,
      })),
      metadata: m.metadata
        ? {
            id: m.metadata.id,
            characterVersionId: m.metadata.characterVersionId,
            modelClass: m.metadata.modelClass,
            provider: m.metadata.provider,
            temperature: m.metadata.temperature,
            promptTokens: m.promptTokens,
            completionTokens: m.completionTokens,
            totalTokens: m.totalTokens,
            estimatedCostUsd: m.estimatedCostUsd,
            latencyMs: m.latencyMs,
            ttftMs: m.ttftMs,
          }
        : null,
      feedback: m.feedback[0]
        ? {
            id: m.feedback[0].id,
            messageId: m.feedback[0].messageId,
            userId: m.feedback[0].userId,
            rating: m.feedback[0].rating as any,
            feedbackText: m.feedback[0].feedbackText,
            reasonCategory: m.feedback[0].reasonCategory,
            createdAt: m.feedback[0].createdAt.toISOString(),
          }
        : null,
      characterVersionId: m.characterVersionId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    return {
      items: formattedMessages,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Deletes a conversation and its messages.
   */
  public static async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found', ErrorCode.CONVERSATION_NOT_FOUND);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenError(
        'Access denied to delete conversation',
        ErrorCode.CONVERSATION_ACCESS_DENIED,
      );
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    logger.info(`Deleted conversation ${conversationId} for user ${userId}`);
  }

  private static mapToConversationDetail(conv: any, totalMessages: number): ConversationDetail {
    return {
      id: conv.id,
      userId: conv.userId,
      characterId: conv.characterId,
      characterVersionId: conv.characterVersionId,
      title: conv.title,
      status: conv.status,
      unreadCount: conv.unreadCount,
      lastMessageAt: conv.lastMessageAt?.toISOString() || null,
      lastMessageSnippet: conv.lastMessageSnippet || null,
      totalMessages,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      character: {
        id: conv.character.id,
        slug: conv.character.slug,
        name: conv.character.name,
        tagline: conv.character.tagline,
        avatarUrl: conv.character.avatarUrl,
        coverImageUrl: conv.character.coverImageUrl,
        category: conv.character.category,
        status: conv.character.status,
        visibility: conv.character.visibility,
        isFeatured: conv.character.isFeatured,
        currentPublishedVersionId: conv.character.currentPublishedVersionId,
        currentVersionNumber: conv.character.currentVersionNumber,
        updatedAt: conv.character.updatedAt.toISOString(),
      },
    };
  }
}
