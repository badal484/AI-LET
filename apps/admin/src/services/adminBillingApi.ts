import type {
  AdminBillingOverview,
  BillingPlan,
  BillingWebhookEventSummary,
  BillingAuditLog,
  BillingReconciliationRecord,
  EffectiveEntitlementsResponse,
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

export class AdminBillingApi {
  public static async getOverview(): Promise<AdminBillingOverview> {
    return authFetch<AdminBillingOverview>('/admin/billing/overview', {
      method: 'GET',
    });
  }

  public static async listPlans(): Promise<BillingPlan[]> {
    return authFetch<BillingPlan[]>('/admin/billing/plans', {
      method: 'GET',
    });
  }

  public static async createPlan(input: {
    productId: string;
    code: string;
    name: string;
    tagline: string;
    description: string;
    trialDays?: number;
    isPopular?: boolean;
    entitlements: string[];
    usageLimits?: Array<{ meterUnit: string; limitAmount: number; period: string }>;
  }): Promise<BillingPlan> {
    return authFetch<BillingPlan>('/admin/billing/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async updatePlan(
    planId: string,
    input: {
      name?: string;
      tagline?: string;
      description?: string;
      trialDays?: number;
      isPopular?: boolean;
      isActive?: boolean;
      entitlements?: string[];
      usageLimits?: Array<{ meterUnit: string; limitAmount: number; period: string }>;
    },
  ): Promise<BillingPlan> {
    return authFetch<BillingPlan>(`/admin/billing/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  public static async createPrice(input: {
    productId: string;
    planId?: string;
    currency: string;
    amountMinorUnits: number;
    billingInterval?: string;
    billingIntervalCount?: number;
    provider: string;
    providerPriceId: string;
    country?: string;
  }): Promise<any> {
    return authFetch('/admin/billing/prices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async listSubscriptions(params: {
    page?: number;
    limit?: number;
    status?: string;
    planCode?: string;
  } = {}): Promise<{
    items: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.planCode) query.set('planCode', params.planCode);

    return authFetch(`/admin/billing/subscriptions?${query.toString()}`, {
      method: 'GET',
    });
  }

  public static async manualGrantEntitlement(input: {
    userId: string;
    entitlementKey: string;
    durationDays?: number;
    reason: string;
  }): Promise<any> {
    return authFetch('/admin/billing/entitlements/grant', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async manualRevokeEntitlement(input: {
    userId: string;
    entitlementKey: string;
    reason: string;
  }): Promise<any> {
    return authFetch('/admin/billing/entitlements/revoke', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async manualGrantCredits(input: {
    userId: string;
    amount: number;
    isPromotional?: boolean;
    reason: string;
  }): Promise<any> {
    return authFetch('/admin/billing/credits/grant', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async processRefund(input: {
    transactionId: string;
    reason: string;
    revokeEntitlements?: boolean;
    reverseCredits?: boolean;
  }): Promise<any> {
    return authFetch('/admin/billing/refunds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public static async listWebhooks(params: { page?: number; limit?: number; status?: string } = {}): Promise<{
    items: BillingWebhookEventSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);

    return authFetch(`/admin/billing/webhooks?${query.toString()}`, {
      method: 'GET',
    });
  }

  public static async retryWebhook(id: string): Promise<{ success: boolean; message: string }> {
    return authFetch('/admin/billing/webhooks/retry', {
      method: 'POST',
      body: JSON.stringify({ webhookEventId: id }),
    });
  }

  public static async getReconciliationMismatches(): Promise<{
    mismatches: BillingReconciliationRecord[];
    count: number;
  }> {
    const records = await authFetch<BillingReconciliationRecord[]>('/admin/billing/reconciliation', {
      method: 'GET',
    });
    return { mismatches: records, count: records.length };
  }

  public static async runReconciliation(provider?: string): Promise<{
    checkedCount: number;
    mismatchesFound: number;
    reconciledCount: number;
  }> {
    return authFetch('/admin/billing/reconciliation/run', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  public static async listAuditLogs(params: { page?: number; limit?: number; action?: string } = {}): Promise<{
    items: BillingAuditLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.action) query.set('action', params.action);

    const items = await authFetch<BillingAuditLog[]>(`/admin/billing/audit?${query.toString()}`, {
      method: 'GET',
    });
    const limit = params.limit ?? items.length;
    return { items, pagination: { page: 1, limit, total: items.length, totalPages: 1 } };
  }

  public static async simulateBilling(input: {
    planCode: string;
    customEntitlements?: string[];
    simulatedUsage?: Record<string, number>;
  }): Promise<{
    effectiveEntitlements: EffectiveEntitlementsResponse;
    usageEvaluation: Record<string, { limit: number; consumed: number; allowed: boolean }>;
  }> {
    return authFetch('/admin/billing/simulator', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}
