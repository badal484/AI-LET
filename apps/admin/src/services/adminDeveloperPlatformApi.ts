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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `API Error: ${res.statusText}`);
  return json.data !== undefined ? json.data : json;
}

export type DeveloperProjectStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';

export interface DeveloperPlatformOverview {
  projects: number;
  activeProjects: number;
  activeKeys: number;
  activeWebhooks: number;
  deliveries24h: number;
  delivered24h: number;
  failed24h: number;
  deliverySuccessRate24h: number | null;
  monthToDateSpendUsd: number;
}

export interface DeveloperProjectRow {
  id: string;
  userId: string;
  name: string;
  slug: string;
  status: DeveloperProjectStatus;
  environment: string;
  createdAt: string;
  activeKeys: number;
  activeWebhooks: number;
  oauthApps: number;
  monthToDateSpendUsd: number;
}

export interface DeveloperProjectDetail {
  id: string;
  userId: string;
  name: string;
  slug: string;
  status: DeveloperProjectStatus;
  environment: string;
  allowedOrigins: string[];
  createdAt: string;
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; keyType: string; scopes: string[]; environment: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string }>;
  webhooks: Array<{ id: string; url: string; description: string | null; eventTypes: string[]; environment: string; active: boolean; failureCount: number; createdAt: string }>;
  oauthApps: Array<{ id: string; name: string; clientId: string; clientType: string; isPublicClient: boolean; createdAt: string }>;
  recentDeliveries: Array<{ id: string; endpointId: string; eventType: string; status: string; statusCode: number | null; durationMs: number | null; attemptNumber: number; createdAt: string; deliveredAt: string | null }>;
}

export const adminDeveloperPlatformApi = {
  getOverview: () => authFetch<DeveloperPlatformOverview>('/admin/developer-platform/overview'),
  listProjects: (status?: string) =>
    authFetch<DeveloperProjectRow[]>(`/admin/developer-platform/projects${status && status !== 'ALL' ? `?status=${status}` : ''}`),
  getProject: (id: string) => authFetch<DeveloperProjectDetail>(`/admin/developer-platform/projects/${id}`),
  setProjectStatus: (id: string, status: DeveloperProjectStatus, reason: string) =>
    authFetch<{ id: string; name: string; status: DeveloperProjectStatus }>(`/admin/developer-platform/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),
};
