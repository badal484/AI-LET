import type {
  CharacterModerationQueueItem,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '@ai-companion/types';
import type {
  ModerationDecisionInput,
} from '@ai-companion/validation';

const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

export class AdminModerationApi {
  public static async listQueue(params?: {
    status?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    page?: number;
    limit?: number;
  }): Promise<CharacterModerationQueueItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.riskLevel) query.append('riskLevel', params.riskLevel);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return adminRequest(`/admin/moderation/queue${qs}`, { method: 'GET' });
  }

  public static async getCaseDetail(caseId: string): Promise<any> {
    return adminRequest(`/admin/moderation/cases/${caseId}`, { method: 'GET' });
  }

  public static async reviewCase(caseId: string, input: ModerationDecisionInput): Promise<any> {
    return adminRequest(`/admin/moderation/cases/${caseId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async reviewAppeal(appealId: string, decision: 'UPHELD' | 'OVERTURNED', notes?: string): Promise<any> {
    return adminRequest(`/admin/moderation/appeals/${appealId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }
}
