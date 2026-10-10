import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversation.service.js';
import { MessageFeedbackService } from '../services/messageFeedback.service.js';
import {
  createConversationSchema,
  conversationListQuerySchema,
  messagePaginationQuerySchema,
  messageFeedbackSchema,
} from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { Realtime } from '../../../infrastructure/realtime/realtime.js';

export class ConversationController {
  public static async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const input = createConversationSchema.parse(req.body);
      const result = await ConversationService.createConversation(userId, input.characterId);

      ApiResponse.success(res, result.detail, result.isCreated ? 201 : 200);
    } catch (err) {
      next(err);
    }
  }

  public static async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const query = conversationListQuerySchema.parse(req.query);
      const result = await ConversationService.listConversations(userId, query);

      ApiResponse.success(res, result.items, 200, {
        hasMore: result.hasMore,
        cursor: result.nextCursor || undefined,
      } as any);
    } catch (err) {
      next(err);
    }
  }

  public static async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const result = await ConversationService.getConversationDetail(userId, conversationId);

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const query = messagePaginationQuerySchema.parse(req.query);
      const result = await ConversationService.getMessageHistory(userId, conversationId, query);
      // Opening the chat (its newest page) reads everything: clear the Chats-list badge.
      if (!query.cursor) {
        const cleared = await prisma.conversation
          .updateMany({ where: { id: conversationId, userId, unreadCount: { gt: 0 } }, data: { unreadCount: 0 } })
          .catch(() => ({ count: 0 }));
        // Read on one phone = read on the others (badge and tab count update).
        if (cleared.count) {
          const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { characterId: true } });
          if (conv) Realtime.publish(userId, { type: 'conversation.updated', conversationId, characterId: conv.characterId });
        }
      }

      ApiResponse.success(res, result.items, 200, {
        hasMore: result.hasMore,
        cursor: result.nextCursor || undefined,
      } as any);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      await ConversationService.deleteConversation(userId, conversationId);

      ApiResponse.success(res, { deleted: true }, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async clearChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const removeFromList = req.body?.removeFromList === true;
      await ConversationService.clearChat(userId, conversationId, removeFromList);
      ApiResponse.success(res, { cleared: true, removedFromList: removeFromList }, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async startFresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      await ConversationService.startFresh(userId, conversationId);
      ApiResponse.success(res, { startedFresh: true }, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id || (req as any).userPrincipal?.userId;
      const conversationId = req.params['conversationId'] as string;
      const messageId = req.params['messageId'] as string;
      const input = messageFeedbackSchema.parse(req.body);
      const result = await MessageFeedbackService.submitFeedback(userId, conversationId, messageId, input);

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
