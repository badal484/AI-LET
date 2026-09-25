import { ApiClient } from './client.js';
import type { AnalyticsBatchIngestItem, ApiSuccessResponse } from '@ai-companion/types';

export interface AnalyticsIngestResponse {
  received: number;
  accepted: number;
  errors?: Array<{ id?: string; error: string }>;
}

export class AnalyticsApi {
  /**
   * Ingest a batch of sanitized analytics events into the high-volume ingestion pipeline.
   */
  public static async sendEvents(events: AnalyticsBatchIngestItem[]): Promise<AnalyticsIngestResponse> {
    if (!events || events.length === 0) {
      return { received: 0, accepted: 0 };
    }

    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<AnalyticsIngestResponse>>('/analytics/events', {
      events,
    });
    return res.data.data;
  }
}
