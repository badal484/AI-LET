import type { DeveloperUsageRecordItem } from '@ai-companion/types';

export class UsageResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Retrieves usage records and budget summary for the active project.
   */
  public async get(params?: { startDate?: string; endDate?: string }): Promise<{
    data: DeveloperUsageRecordItem[];
    summary: {
      totalRequests: number;
      totalTokens: number;
      totalCostUsd: number;
      monthlyBudgetUsd: number | null;
      budgetPercentUsed: number;
      hardLimitExceeded: boolean;
    };
  }> {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString();
    return this.requester(`/v1/usage${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }
}
