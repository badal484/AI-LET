import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller.js';
import { ChatStreamController } from '../controllers/chatStream.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const conversationRouter: Router = Router();

// All conversation routes require active user authentication
conversationRouter.use(authenticateUser);

// 1. Conversation CRUD
conversationRouter.post('/', ConversationController.createConversation);
conversationRouter.get('/', ConversationController.listConversations);
conversationRouter.get('/:conversationId', ConversationController.getConversation);
conversationRouter.delete('/:conversationId', ConversationController.deleteConversation);

// 2. Messages & Real-Time Streaming
conversationRouter.get('/:conversationId/messages', ConversationController.getMessages);
conversationRouter.post('/:conversationId/messages', ChatStreamController.sendMessage);
conversationRouter.post('/:conversationId/generations/:messageId/cancel', ChatStreamController.cancelGeneration);
conversationRouter.post('/:conversationId/messages/:messageId/retry', ChatStreamController.retryMessage);

// 3. Message Feedback
conversationRouter.post('/:conversationId/messages/:messageId/feedback', ConversationController.submitFeedback);
