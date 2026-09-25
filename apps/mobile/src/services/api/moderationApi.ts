import { ApiClient } from './client.js';
import type { CharacterReportCreateInput } from '@ai-companion/validation';

export class ModerationApi {
  /**
   * Submits a confidential user report against a character.
   */
  public static async submitReport(
    input: CharacterReportCreateInput,
  ): Promise<{ reportId: string; status: string }> {
    const client = ApiClient.getInstance();
    const res = await client.post<{
      success: boolean;
      data: { reportId: string; status: string };
    }>('/moderation/reports', input);
    return res.data.data;
  }
}
