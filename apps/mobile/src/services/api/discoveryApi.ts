import { ApiClient } from './client.js';
import type {
  HomeFeedResponse,
  SearchCharacterQueryParams,
  SearchCharacterResult,
  PublicCharacterDetailedProfile,
  CharacterCategorySummary,
  CuratedCollectionSummary,
  CharacterCatalogItem,
  UserDiscoveryPreferencesData,
} from '@ai-companion/types';

export class DiscoveryApi {
  /**
   * Retrieves unified home feed.
   */
  public static async getHomeFeed(refresh: boolean = false): Promise<HomeFeedResponse> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: HomeFeedResponse }>('/home', {
      params: refresh ? { refresh: true } : undefined,
    });
    return res.data.data;
  }

  /**
   * Searches characters with query, categories, and tags.
   */
  public static async searchCharacters(
    params: SearchCharacterQueryParams,
  ): Promise<SearchCharacterResult> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: SearchCharacterResult }>(
      '/discovery/search',
      {
        params: {
          q: params.q,
          category: params.category,
          tags: params.tags?.join(','),
          accessType: params.accessType,
          cursor: params.cursor,
          limit: params.limit,
          sort: params.sort,
        },
      },
    );
    return res.data.data;
  }

  /**
   * Retrieves sanitized public profile of a character.
   */
  public static async getCharacterProfile(
    idOrSlug: string,
  ): Promise<PublicCharacterDetailedProfile> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: PublicCharacterDetailedProfile }>(
      `/discovery/characters/${idOrSlug}`,
    );
    return res.data.data;
  }

  /**
   * Retrieves all categories.
   */
  public static async getCategories(): Promise<CharacterCategorySummary[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: CharacterCategorySummary[] }>(
      '/discovery/categories',
    );
    return res.data.data;
  }

  /**
   * Retrieves category details and characters.
   */
  public static async getCategoryBySlug(
    slug: string,
  ): Promise<{ category: CharacterCategorySummary; characters: CharacterCatalogItem[] }> {
    const client = ApiClient.getInstance();
    const res = await client.get<{
      success: boolean;
      data: { category: CharacterCategorySummary; characters: CharacterCatalogItem[] };
    }>(`/discovery/categories/${slug}`);
    return res.data.data;
  }

  /**
   * Retrieves curated collections.
   */
  public static async getCollections(): Promise<CuratedCollectionSummary[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: CuratedCollectionSummary[] }>(
      '/discovery/collections',
    );
    return res.data.data;
  }

  /**
   * Retrieves single collection by slug.
   */
  public static async getCollectionBySlug(slug: string): Promise<CuratedCollectionSummary> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: CuratedCollectionSummary }>(
      `/discovery/collections/${slug}`,
    );
    return res.data.data;
  }

  /**
   * Favorites or unfavorites a character.
   */
  public static async toggleFavorite(
    characterId: string,
    isFavorite: boolean,
  ): Promise<{ characterId: string; isFavorite: boolean }> {
    const client = ApiClient.getInstance();
    if (isFavorite) {
      const res = await client.post<{
        success: boolean;
        data: { characterId: string; isFavorite: boolean };
      }>(`/discovery/favorites/${characterId}`);
      return res.data.data;
    } else {
      const res = await client.delete<{
        success: boolean;
        data: { characterId: string; isFavorite: boolean };
      }>(`/discovery/favorites/${characterId}`);
      return res.data.data;
    }
  }

  /**
   * Lists user favorites.
   */
  public static async listFavorites(): Promise<CharacterCatalogItem[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: CharacterCatalogItem[] }>(
      '/discovery/favorites',
    );
    return res.data.data;
  }

  /**
   * Retrieves user discovery preferences.
   */
  public static async getPreferences(): Promise<UserDiscoveryPreferencesData> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: UserDiscoveryPreferencesData }>(
      '/discovery/preferences',
    );
    return res.data.data;
  }

  /**
   * Updates user discovery preferences.
   */
  public static async updatePreferences(
    prefs: Partial<UserDiscoveryPreferencesData>,
  ): Promise<UserDiscoveryPreferencesData> {
    const client = ApiClient.getInstance();
    const res = await client.put<{ success: boolean; data: UserDiscoveryPreferencesData }>(
      '/discovery/preferences',
      prefs,
    );
    return res.data.data;
  }

  /**
   * Resets personalization signals and recommendations.
   */
  public static async resetPersonalization(): Promise<void> {
    const client = ApiClient.getInstance();
    await client.post('/discovery/reset-personalization');
  }

  /**
   * Registers a negative preference signal (e.g. HIDE_CHARACTER, HIDE_CREATOR, NOT_INTERESTED).
   */
  public static async recordNegativeSignal(signal: {
    signalType: 'HIDE_CHARACTER' | 'HIDE_CREATOR' | 'NOT_INTERESTED';
    characterId?: string;
    creatorProfileId?: string;
    reason?: string;
  }): Promise<void> {
    const client = ApiClient.getInstance();
    await client.post('/discovery/controls/negative-signal', signal);
  }

  /**
   * Retrieves instant autocomplete suggestions.
   */
  public static async getSuggestions(q: string, limit = 8): Promise<any[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: any[] }>('/search/suggestions', {
      params: { q, limit },
    });
    return res.data.data;
  }

  /**
   * Retrieves recent search history.
   */
  public static async getRecentSearches(): Promise<any[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: any[] }>('/search/recent');
    return res.data.data;
  }

  /**
   * Deletes a recent search query.
   */
  public static async deleteRecentSearch(id: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/search/recent/${id}`);
  }

  /**
   * Clears all recent searches.
   */
  public static async clearRecentSearches(): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete('/search/recent');
  }

  /**
   * Retrieves top similar characters.
   */
  public static async getSimilarCharacters(characterId: string, limit = 6): Promise<CharacterCatalogItem[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: { items: CharacterCatalogItem[] } }>(
      `/discovery/similar/${characterId}`,
      { params: { limit } },
    );
    return res.data.data.items;
  }

  /**
   * Sends batch impression or interaction events.
   */
  public static async recordEvents(events: any[]): Promise<void> {
    const client = ApiClient.getInstance();
    await client.post('/discovery/events', { events });
  }
}

