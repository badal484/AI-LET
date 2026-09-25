import type {
  VoicePreviewRequest,
  VoicePreviewResult,
  VoiceQualityMetrics,
  VoiceCostOverview,
} from '@ai-companion/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include', // admin session cookie (httpOnly)
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.message || `API Error: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export class AdminVoiceApi {
  public static async generatePreview(input: VoicePreviewRequest): Promise<VoicePreviewResult> {
    return authFetch<VoicePreviewResult>('/admin/voice/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async getAnalytics(): Promise<VoiceQualityMetrics> {
    return authFetch<VoiceQualityMetrics>('/admin/voice/analytics', {
      method: 'GET',
    });
  }

  public static async getCost(): Promise<VoiceCostOverview> {
    return authFetch<VoiceCostOverview>('/admin/voice/cost', {
      method: 'GET',
    });
  }

  public static async listSessions(params: { page?: number; limit?: number; characterId?: string; status?: string } = {}): Promise<{
    items: Array<{
      id: string;
      userId: string;
      userEmail: string;
      characterId: string;
      characterName: string;
      characterAvatarUrl?: string;
      status: string;
      voiceMode: string;
      language: string;
      provider: string;
      voiceId: string;
      totalDurationSeconds: number;
      turnsCount: number;
      interruptionCount: number;
      totalCostUsd: number;
      startedAt: string;
      endedAt?: string | null;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.characterId) query.set('characterId', params.characterId);
    if (params.status) query.set('status', params.status);

    return authFetch(`/admin/voice/sessions?${query.toString()}`, {
      method: 'GET',
    });
  }
}
