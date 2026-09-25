import type {
  CharacterAdminDetail,
  CharacterVersionSnapshot,
  VersionDiffResult,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '@ai-companion/types';
import type {
  CreateCharacterRequestInput,
  UpdateCharacterMetadataInput,
  UpdateCharacterVersionInput,
} from '@ai-companion/validation';

const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

async function characterAdminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export class AdminCharacterApi {
  public static async listCharacters(params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<{ characters: any[]; total: number; page: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return characterAdminRequest(`/admin/characters${qs}`, { method: 'GET' });
  }

  public static async createCharacter(input: CreateCharacterRequestInput): Promise<CharacterAdminDetail> {
    return characterAdminRequest('/admin/characters', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async getCharacterDetail(id: string): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${id}`, { method: 'GET' });
  }

  public static async updateCharacterMetadata(
    id: string,
    input: UpdateCharacterMetadataInput,
  ): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  public static async createVersionDraft(
    characterId: string,
    baseVersionId?: string,
    changeSummary?: string,
  ): Promise<CharacterVersionSnapshot> {
    return characterAdminRequest(`/admin/characters/${characterId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ baseVersionId, changeSummary }),
    });
  }

  public static async getVersion(
    characterId: string,
    versionId: string,
  ): Promise<CharacterVersionSnapshot> {
    return characterAdminRequest(`/admin/characters/${characterId}/versions/${versionId}`, {
      method: 'GET',
    });
  }

  public static async updateVersionDraft(
    characterId: string,
    versionId: string,
    input: UpdateCharacterVersionInput,
  ): Promise<CharacterVersionSnapshot> {
    return characterAdminRequest(`/admin/characters/${characterId}/versions/${versionId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  public static async publishVersion(
    characterId: string,
    versionId: string,
    validationOverride: boolean = false,
  ): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${characterId}/versions/${versionId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ validationOverride }),
    });
  }

  public static async rollbackVersion(
    characterId: string,
    targetVersionId: string,
    reason: string,
  ): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${characterId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ targetVersionId, reason }),
    });
  }

  public static async unpublishCharacter(characterId: string): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${characterId}/unpublish`, {
      method: 'POST',
    });
  }

  public static async archiveCharacter(characterId: string): Promise<CharacterAdminDetail> {
    return characterAdminRequest(`/admin/characters/${characterId}/archive`, {
      method: 'POST',
    });
  }

  public static async testInteraction(
    characterId: string,
    versionId: string,
    data: {
      userMessage: string;
      simulatedRelationshipStage?: string;
      simulatedLanguage?: string;
      userContext?: { userName: string };
    },
  ): Promise<{
    response: string;
    latencyMs: number;
    totalTokens: number;
    modelUsed: string;
    compiledPrompt?: string;
    promptSections?: Record<string, string>;
  }> {
    return characterAdminRequest(`/admin/characters/${characterId}/versions/${versionId}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async compareVersions(
    characterId: string,
    v1: string,
    v2: string,
  ): Promise<VersionDiffResult> {
    return characterAdminRequest(`/admin/characters/${characterId}/diff?v1=${v1}&v2=${v2}`, {
      method: 'GET',
    });
  }

  public static async simulateRelationship(data: {
    characterId: string;
    characterVersionId?: string;
    initialState?: any;
    userMessage: string;
    assistantResponse: string;
  }): Promise<any> {
    return characterAdminRequest('/admin/relationships/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getRelationshipAnalytics(): Promise<any> {
    return characterAdminRequest('/admin/relationships/analytics', {
      method: 'GET',
    });
  }

  public static async simulateProactivity(data: {
    characterId: string;
    characterVersionId?: string;
    mockLocalTime?: string;
    userTimezone?: string;
    simulateRecentInteractionHours?: number;
    userMessageContext?: string;
  }): Promise<any> {
    return characterAdminRequest('/admin/proactivity/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getProactivityAnalytics(): Promise<any> {
    return characterAdminRequest('/admin/proactivity/analytics', {
      method: 'GET',
    });
  }
}

