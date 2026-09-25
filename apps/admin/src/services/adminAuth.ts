import { AdminPrincipal, ApiSuccessResponse, ApiErrorResponse } from '@ai-companion/types';

const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

let memoryAdminToken: string | null = null;

export function setMemoryAdminToken(token: string | null): void {
  memoryAdminToken = token;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (memoryAdminToken) {
    headers['Authorization'] = `Bearer ${memoryAdminToken}`;
  }

  const response = await fetch(`${ADMIN_API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // sends and receives cookies
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = (data as ApiErrorResponse)?.error;
    throw new Error(errorData?.message || `Request failed with status ${response.status}`);
  }

  return (data as ApiSuccessResponse<T>).data;
}

export interface AdminLoginResponseData {
  admin: {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
  token: string;
  sessionToken: string;
  expiresIn: number;
}

export class AdminAuthService {
  static async login(email: string, password: string, mfaCode?: string): Promise<AdminLoginResponseData> {
    const data = await request<AdminLoginResponseData>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaCode }),
    });
    setMemoryAdminToken(data.token);
    return data;
  }

  static async getMe(): Promise<{ admin: AdminPrincipal }> {
    return request<{ admin: AdminPrincipal }>('/admin/me', {
      method: 'GET',
    });
  }

  static async logout(): Promise<void> {
    try {
      await request('/admin/logout', {
        method: 'POST',
      });
    } finally {
      setMemoryAdminToken(null);
    }
  }

  static async listUsers(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/admin/users${queryString}`, { method: 'GET' });
  }

  static async updateUserStatus(userId: string, status: string, reason?: string) {
    return request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  static async getAuditLogs(params?: { page?: number; limit?: number; action?: string; actorId?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.action) query.append('action', params.action);
    if (params?.actorId) query.append('actorId', params.actorId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/admin/audit-logs${queryString}`, { method: 'GET' });
  }

  static async listCreators(params?: { search?: string; verificationStatus?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.verificationStatus && params.verificationStatus !== 'ALL') query.append('verificationStatus', params.verificationStatus);
    if (params?.limit) query.append('limit', String(params.limit));
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<any[]>(`/admin/creators${queryString}`, { method: 'GET' });
  }

  static async setCreatorVerification(creatorId: string, verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'PARTNER', reason?: string) {
    return request<{ id: string; username: string; verificationStatus: string }>(`/admin/creators/${creatorId}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus, reason }),
    });
  }
}
