import type {
  AdminAnalyticsOverviewData,
  AIUnitEconomicsSummary,
  AIModelPricingItem,
  AIModelPricingCreateInput,
  ExperimentItem,
  ExperimentCreateInput,
  ExperimentUpdateInput,
  ExperimentAnalysisResult,
  AnalyticsAlertItem,
  CharacterDailyMetricItem,
  CreatorDailyMetricItem,
  CohortRetentionItem,
  OnboardingFunnelStep,
  AttributionChannelSummary,
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
    throw new Error(errorData.error?.message || errorData.message || errorData.error?.message || `API Error: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export const adminAnalyticsApi = {
  getOverview: async (): Promise<AdminAnalyticsOverviewData> => {
    return authFetch<AdminAnalyticsOverviewData>('/admin/analytics/overview');
  },

  getGrowth: async (): Promise<{
    onboardingFunnel: OnboardingFunnelStep[];
    attributionChannels: AttributionChannelSummary[];
    cohortRetention: CohortRetentionItem[];
  }> => {
    return authFetch<{
      onboardingFunnel: OnboardingFunnelStep[];
      attributionChannels: AttributionChannelSummary[];
      cohortRetention: CohortRetentionItem[];
    }>('/admin/analytics/growth');
  },

  getRetention: async (): Promise<{ cohorts: CohortRetentionItem[] }> => {
    return authFetch<{ cohorts: CohortRetentionItem[] }>('/admin/analytics/retention');
  },

  getAIEconomics: async (days = 30): Promise<AIUnitEconomicsSummary> => {
    return authFetch<AIUnitEconomicsSummary>(`/admin/analytics/ai-economics?days=${days}`);
  },

  getPricing: async (): Promise<AIModelPricingItem[]> => {
    return authFetch<AIModelPricingItem[]>('/admin/analytics/pricing');
  },

  createPricing: async (data: AIModelPricingCreateInput): Promise<AIModelPricingItem> => {
    return authFetch<AIModelPricingItem>('/admin/analytics/pricing', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCharacters: async (): Promise<CharacterDailyMetricItem[]> => {
    return authFetch<CharacterDailyMetricItem[]>('/admin/analytics/characters');
  },

  getCreators: async (): Promise<CreatorDailyMetricItem[]> => {
    return authFetch<CreatorDailyMetricItem[]>('/admin/analytics/creators');
  },

  getExperiments: async (): Promise<ExperimentItem[]> => {
    return authFetch<ExperimentItem[]>('/admin/analytics/experiments');
  },

  createExperiment: async (data: ExperimentCreateInput): Promise<ExperimentItem> => {
    return authFetch<ExperimentItem>('/admin/analytics/experiments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateExperiment: async (id: string, data: ExperimentUpdateInput): Promise<ExperimentItem> => {
    return authFetch<ExperimentItem>(`/admin/analytics/experiments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getExperimentAnalysis: async (id: string): Promise<ExperimentAnalysisResult> => {
    return authFetch<ExperimentAnalysisResult>(`/admin/analytics/experiments/${id}/analysis`);
  },

  getAlerts: async (status?: string): Promise<AnalyticsAlertItem[]> => {
    const url = status ? `/admin/analytics/alerts?status=${status}` : '/admin/analytics/alerts';
    return authFetch<AnalyticsAlertItem[]>(url);
  },

  acknowledgeAlert: async (id: string): Promise<AnalyticsAlertItem> => {
    return authFetch<AnalyticsAlertItem>(`/admin/analytics/alerts/${id}/acknowledge`, {
      method: 'PATCH',
    });
  },

  triggerAggregation: async (): Promise<any> => {
    return authFetch<any>('/admin/analytics/aggregate/trigger', {
      method: 'POST',
    });
  },
};
