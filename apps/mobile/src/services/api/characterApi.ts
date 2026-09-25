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

  /**
   * Create personalized custom AI companion.
   */
  public static async createCustomCompanion(input: {
    name: string;
    tagline?: string;
    category?: string;
    archetype?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    domainFocus?: string;
    personalityPrompt?: string;
    traits?: {
      warmth?: number;
      playfulness?: number;
      sarcasm?: number;
      empathy?: number;
      confidence?: number;
    };
    language?: 'hinglish' | 'en' | 'hi';
    rules?: string[];
    greeting?: string;
  }): Promise<{ character: CharacterSummary; conversationId: string }> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<{ character: CharacterSummary; conversationId: string }>>(
      '/characters/custom',
      input,
    );
    return res.data.data;
  }
}
