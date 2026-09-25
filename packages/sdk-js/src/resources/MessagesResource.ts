import type { PublicMessageDTO, PublicStreamPayload } from '@ai-companion/types';

export class MessagesResource {
  constructor(
    private readonly requester: (path: string, options?: RequestInit) => Promise<any>,
    private readonly streamRequester: (
      path: string,
      options: RequestInit,
      onEvent: (event: PublicStreamPayload) => void
    ) => Promise<void>
  ) {}

  /**
   * Sends a message in a conversation and receives a complete response.
   */
  public async create(
    conversationId: string,
    params: { content: string; idempotencyKey?: string }
  ): Promise<PublicMessageDTO> {
    const headers: Record<string, string> = {};
    if (params.idempotencyKey) {
      headers['Idempotency-Key'] = params.idempotencyKey;
    }

    const res = await this.requester(`/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: params.content }),
    });
    return res.data;
  }

  /**
   * Streams assistant responses in real-time using Server-Sent Events.
   */
  public async createStream(
    conversationId: string,
    params: { content: string; idempotencyKey?: string },
    onEvent: (event: PublicStreamPayload) => void
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };
    if (params.idempotencyKey) {
      headers['Idempotency-Key'] = params.idempotencyKey;
    }

    await this.streamRequester(
      `/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: params.content }),
      },
      onEvent
    );
  }

  /**
   * Lists historical messages in a conversation.
   */
  public async list(
    conversationId: string,
    params?: { limit?: number; after?: string }
  ): Promise<{ data: PublicMessageDTO[]; hasMore: boolean; nextCursor?: string | null }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.after) query.set('after', params.after);

    const qs = query.toString();
    return this.requester(`/v1/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  }
}
