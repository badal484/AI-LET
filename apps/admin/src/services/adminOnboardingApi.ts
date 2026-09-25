import type {
  ActivationFunnelOverview,
  OnboardingDropoffMetrics,
  CharacterActivationRankItem,
  RetentionCohortMetrics,
  OnboardingStepConfigItem,
} from '@ai-companion/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Admin API Request Failed');
  }

  return data.data;
}

export const adminOnboardingApi = {
  getAnalytics: async (): Promise<{
    overview: ActivationFunnelOverview;
    dropoffMetrics: OnboardingDropoffMetrics[];
    characterLeaderboard: CharacterActivationRankItem[];
    retentionCohorts: RetentionCohortMetrics[];
  }> => {
    return fetchWithAuth('/admin/onboarding/analytics');
  },

  listStepConfigs: async (): Promise<OnboardingStepConfigItem[]> => {
    return fetchWithAuth('/admin/onboarding/configs');
  },

  upsertStepConfig: async (input: {
    stepKey: string;
    title: string;
    subtitle?: string;
    isRequired: boolean;
    displayOrder: number;
    version: number;
    configData: Record<string, unknown>;
    isEnabled: boolean;
  }): Promise<OnboardingStepConfigItem> => {
    return fetchWithAuth('/admin/onboarding/configs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
