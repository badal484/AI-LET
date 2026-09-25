import type { PublicConversationDTO } from '@ai-companion/types';

export class ConversationsResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Starts a new conversation with a character.
   */
  public async create(params: { characterId: string; title?: string }): Promise<PublicConversationDTO> {
    const res = await this.requester('/v1/conversations', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  }

  /**
   * Retrieves conversation metadata by ID.
   */
  public async get(conversationId: string): Promise<PublicConversationDTO> {
    const res = await this.requester(`/v1/conversations/${conversationId}`, { method: 'GET' });
    return res.data;
  }

  /**
   * Lists conversations.
   */
  public async list(params?: { limit?: number; after?: string }): Promise<{
    data: PublicConversationDTO[];
    hasMore: boolean;
    nextCursor?: string | null;
  }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.after) query.set('after', params.after);

    const qs = query.toString();
    return this.requester(`/v1/conversations${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }
}
