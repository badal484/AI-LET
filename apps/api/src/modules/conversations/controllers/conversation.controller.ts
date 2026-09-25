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
