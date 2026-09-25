import type { PublicCharacterDTO } from '@ai-companion/types';

export class CharactersResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Lists available public characters.
   */
  public async list(params?: { category?: string; search?: string; limit?: number; after?: string }): Promise<{
    data: PublicCharacterDTO[];
    hasMore: boolean;
    nextCursor?: string | null;
  }> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.after) query.set('after', params.after);

    const qs = query.toString();
    return this.requester(`/v1/characters${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  /**
   * Retrieves character profile by ID.
   */
  public async get(characterId: string): Promise<PublicCharacterDTO> {
    const res = await this.requester(`/v1/characters/${characterId}`, { method: 'GET' });
    return res.data;
  }
}
