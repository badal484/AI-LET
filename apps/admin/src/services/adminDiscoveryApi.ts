import type {
  CharacterCategorySummary,
  CharacterTagSummary,
  CuratedCollectionSummary,
  HomeFeedSection,
  DiscoveryAnalyticsOverview,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '@ai-companion/types';
import type {
  AdminCategoryUpsertInput,
  AdminTagUpsertInput,
  AdminCollectionUpsertInput,
  AdminHomeSectionConfigInput,
  AdminCharacterDiscoveryConfigInput,
  AdminRecommendationSimulatorInput,
} from '@ai-companion/validation';

const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

async function discoveryAdminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${ADMIN_API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = (data as ApiErrorResponse)?.error;
    throw new Error(errorData?.message || `Request failed with status ${response.status}`);
  }

  return (data as ApiSuccessResponse<T>).data;
}

export class AdminDiscoveryApi {
  // Categories
  public static async listCategories(): Promise<CharacterCategorySummary[]> {
    return discoveryAdminRequest('/admin/discovery/categories', { method: 'GET' });
  }

  public static async createCategory(input: AdminCategoryUpsertInput): Promise<CharacterCategorySummary> {
    return discoveryAdminRequest('/admin/discovery/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updateCategory(id: string, input: Partial<AdminCategoryUpsertInput>): Promise<CharacterCategorySummary> {
    return discoveryAdminRequest(`/admin/discovery/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async deleteCategory(id: string): Promise<void> {
    return discoveryAdminRequest(`/admin/discovery/categories/${id}`, { method: 'DELETE' });
  }

  // Tags
  public static async listTags(): Promise<CharacterTagSummary[]> {
    return discoveryAdminRequest('/admin/discovery/tags', { method: 'GET' });
  }

  public static async createTag(input: AdminTagUpsertInput): Promise<CharacterTagSummary> {
    return discoveryAdminRequest('/admin/discovery/tags', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updateTag(id: string, input: Partial<AdminTagUpsertInput>): Promise<CharacterTagSummary> {
    return discoveryAdminRequest(`/admin/discovery/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async deleteTag(id: string): Promise<void> {
    return discoveryAdminRequest(`/admin/discovery/tags/${id}`, { method: 'DELETE' });
  }

  // Collections
  public static async listCollections(): Promise<CuratedCollectionSummary[]> {
    return discoveryAdminRequest('/admin/discovery/collections', { method: 'GET' });
  }

  public static async createCollection(input: AdminCollectionUpsertInput): Promise<CuratedCollectionSummary> {
    return discoveryAdminRequest('/admin/discovery/collections', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updateCollection(id: string, input: Partial<AdminCollectionUpsertInput>): Promise<CuratedCollectionSummary> {
    return discoveryAdminRequest(`/admin/discovery/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async deleteCollection(id: string): Promise<void> {
    return discoveryAdminRequest(`/admin/discovery/collections/${id}`, { method: 'DELETE' });
  }

  // Home Section Configs
  public static async listHomeSections(): Promise<HomeFeedSection[]> {
    return discoveryAdminRequest('/admin/discovery/home-sections', { method: 'GET' });
  }

  public static async updateHomeSection(id: string, input: Partial<AdminHomeSectionConfigInput>): Promise<HomeFeedSection> {
    return discoveryAdminRequest(`/admin/discovery/home-sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  // Character Discovery Metadata
  public static async getCharacterDiscoveryConfig(characterId: string): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/characters/${characterId}/config`, { method: 'GET' });
  }

  public static async updateCharacterDiscoveryConfig(characterId: string, input: AdminCharacterDiscoveryConfigInput): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/characters/${characterId}/config`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  // Recommendations Simulator
  public static async simulateRecommendations(input: AdminRecommendationSimulatorInput): Promise<any[]> {
    return discoveryAdminRequest('/admin/discovery/recommendations/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Analytics
  public static async getAnalytics(): Promise<DiscoveryAnalyticsOverview> {
    return discoveryAdminRequest('/admin/discovery/analytics', { method: 'GET' });
  }

  // ---------------------------------------------------------------------------
  // Search Synonyms
  // ---------------------------------------------------------------------------
  public static async listSynonyms(language?: string): Promise<any[]> {
    const query = language ? `?language=${encodeURIComponent(language)}` : '';
    return discoveryAdminRequest(`/admin/discovery/synonyms${query}`, { method: 'GET' });
  }

  public static async createSynonym(input: any): Promise<any> {
    return discoveryAdminRequest('/admin/discovery/synonyms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updateSynonym(id: string, input: any): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/synonyms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async deleteSynonym(id: string): Promise<void> {
    return discoveryAdminRequest(`/admin/discovery/synonyms/${id}`, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Ranking Studio & Simulator
  // ---------------------------------------------------------------------------
  public static async listRankingConfigs(): Promise<any[]> {
    return discoveryAdminRequest('/admin/discovery/ranking-configs', { method: 'GET' });
  }

  public static async createRankingConfig(input: any): Promise<any> {
    return discoveryAdminRequest('/admin/discovery/ranking-configs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updateRankingConfig(id: string, input: any): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/ranking-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async publishRankingConfig(version: string): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/ranking-configs/${version}/publish`, {
      method: 'POST',
    });
  }

  public static async simulateRanking(input: any): Promise<any> {
    return discoveryAdminRequest('/admin/discovery/ranking-configs/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ---------------------------------------------------------------------------
  // Search Index Health & Maintenance
  // ---------------------------------------------------------------------------
  public static async getIndexHealth(): Promise<any> {
    return discoveryAdminRequest('/admin/discovery/index/health', { method: 'GET' });
  }

  public static async triggerReindex(characterIds?: string[]): Promise<any> {
    return discoveryAdminRequest('/admin/discovery/index/reindex', {
      method: 'POST',
      body: JSON.stringify({ characterIds }),
    });
  }

  // ---------------------------------------------------------------------------
  // Search Quality Metrics
  // ---------------------------------------------------------------------------
  public static async getSearchQuality(days = 30): Promise<any> {
    return discoveryAdminRequest(`/admin/discovery/search-quality?days=${days}`, { method: 'GET' });
  }
}

