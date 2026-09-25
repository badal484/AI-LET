import type {
  NotificationAnalyticsOverview,
  NotificationCampaignData,
  CampaignDryRunResult,
  ProactiveSimulationInput,
  ProactiveSimulationResult,
} from '@ai-companion/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Admin API Request Failed');
  }

  return data.data;
}

export interface ProactiveActionItem {
  id: string;
  characterId: string;
  character?: { name: string; avatarUrl?: string };
  intentType: string;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class AdminNotificationApi {
  /**
   * Retrieves platform-level notification and proactive analytics
   */
  public static async getAnalytics(): Promise<NotificationAnalyticsOverview> {
    return fetchWithAuth('/admin/notifications/analytics');
  }

  /**
   * Executes sandboxed dry-run proactive simulation
   */
  public static async simulateProactivity(
    input: ProactiveSimulationInput,
  ): Promise<ProactiveSimulationResult> {
    return fetchWithAuth('/admin/notifications/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Queries list of proactive actions
   */
  public static async listActions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    characterId?: string;
  }): Promise<{ items: ProactiveActionItem[]; total: number; page: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.characterId) query.append('characterId', params.characterId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth(`/admin/notifications/actions${queryString}`);
  }

  /**
   * Queries list of admin campaigns
   */
  public static async listCampaigns(): Promise<NotificationCampaignData[]> {
    return fetchWithAuth('/admin/notifications/campaigns');
  }

  /**
   * Creates a new campaign
   */
  public static async createCampaign(
    data: Partial<NotificationCampaignData>,
  ): Promise<NotificationCampaignData> {
    return fetchWithAuth('/admin/notifications/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Executes dry run for audience estimation
   */
  public static async dryRunCampaign(data: {
    targetAudience: string;
  }): Promise<CampaignDryRunResult> {
    return fetchWithAuth('/admin/notifications/campaigns/dry-run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Dispatches a campaign to recipients
   */
  public static async dispatchCampaign(
    campaignId: string,
  ): Promise<{ sentCount: number; failedCount: number }> {
    return fetchWithAuth(`/admin/notifications/campaigns/${campaignId}/send`, {
      method: 'POST',
    });
  }

  /**
   * Sends a test push notification
   */
  public static async sendTestPush(data: {
    targetUserId?: string;
    targetPushToken?: string;
    title: string;
    body: string;
    category?: string;
    deepLink?: string;
  }): Promise<{ sent: boolean; messageId?: string }> {
    return fetchWithAuth('/admin/notifications/test-push', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}


