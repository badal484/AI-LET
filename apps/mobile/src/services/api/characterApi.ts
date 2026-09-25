import { ApiClient } from './client.js';
import type { CharacterSummary, ApiSuccessResponse } from '@ai-companion/types';

export class CharacterApi {
  /**
   * List public published characters for explore/discovery.
   */
  public static async listCharacters(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<{ items: CharacterSummary[]; meta?: any }> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<CharacterSummary[]>>('/characters', {
      params,
    });
    return {
      items: res.data.data,
      meta: res.data.meta,
    };
  }

  /**
   * Get single public character details.
   */
  public static async getCharacter(idOrSlug: string): Promise<CharacterSummary> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<CharacterSummary>>(`/characters/${idOrSlug}`);
    return res.data.data;
  }
}
