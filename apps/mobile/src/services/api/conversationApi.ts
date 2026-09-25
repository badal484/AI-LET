import { ApiClient } from './client.js';
import type {
  ConversationDetail,
  ConversationSummary,
  ChatMessageItem,
  CursorPaginatedResult,
  ApiSuccessResponse,
  MessageFeedbackData,
} from '@ai-companion/types';

export class ConversationApi {
  /**
   * Creates or gets a conversation with a character.
   */
  public static async createConversation(characterId: string): Promise<ConversationDetail> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<ConversationDetail>>('/conversations', {
      characterId,
    });
    return res.data.data;
  }

  /**
   * Lists active conversations for the authenticated user.
   */
  public static async listConversations(params?: {
    cursor?: string;
    limit?: number;
    status?: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
  }): Promise<CursorPaginatedResult<ConversationSummary>> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<ConversationSummary[]>>('/conversations', {
      params,
    });
    return {
      items: res.data.data,
      nextCursor: (res.data.meta as any)?.cursor || null,
      hasMore: (res.data.meta as any)?.hasMore || false,
    };
  }

  /**
   * Retrieves single conversation details.
   */
  public static async getConversation(conversationId: string): Promise<ConversationDetail> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<ConversationDetail>>(
      `/conversations/${conversationId}`,
    );
    return res.data.data;
  }

  /**
   * Retrieves message history for a conversation with cursor pagination.
   */
  public static async getMessages(
    conversationId: string,
    params?: {
      cursor?: string;
      limit?: number;
      direction?: 'before' | 'after';
    },
  ): Promise<CursorPaginatedResult<ChatMessageItem>> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<ChatMessageItem[]>>(
      `/conversations/${conversationId}/messages`,
      { params },
    );
    return {
      items: res.data.data,
      nextCursor: (res.data.meta as any)?.cursor || null,
      hasMore: (res.data.meta as any)?.hasMore || false,
    };
  }

  /**
   * Cancels an active in-flight generation.
   */
  public static async cancelGeneration(
    conversationId: string,
    messageId: string,
    reason?: string,
  ): Promise<{ messageId: string; status: string }> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<{ messageId: string; status: string }>>(
      `/conversations/${conversationId}/generations/${messageId}/cancel`,
      { reason },
    );
    return res.data.data;
  }

  /**
   * Submits user rating & feedback on an assistant message.
   */
  public static async submitFeedback(
    conversationId: string,
    messageId: string,
    rating: 'THUMBS_UP' | 'THUMBS_DOWN',
    feedbackText?: string,
  ): Promise<MessageFeedbackData> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<MessageFeedbackData>>(
      `/conversations/${conversationId}/messages/${messageId}/feedback`,
      { rating, feedbackText },
    );
    return res.data.data;
  }

  /**
   * Deletes a conversation.
   */
  public static async deleteConversation(conversationId: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/conversations/${conversationId}`);
  }
}
