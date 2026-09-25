import { ApiClient } from './client.js';
import type {
  CreateVoiceSessionRequest,
  CreateVoiceSessionResponse,
  VoiceSessionDetail,
  VoiceSessionSummary,
  UserVoicePreferenceData,
} from '@ai-companion/types';

export class VoiceApi {
  public static async createSession(
    input: CreateVoiceSessionRequest
  ): Promise<CreateVoiceSessionResponse> {
    const client = ApiClient.getInstance();
    const res = await client.post<{ success: boolean; data: CreateVoiceSessionResponse }>(
      '/voice/sessions',
      input
    );
    return res.data.data;
  }

  public static async getSession(sessionId: string): Promise<VoiceSessionDetail> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: VoiceSessionDetail }>(
      `/voice/sessions/${sessionId}`
    );
    return res.data.data;
  }

  public static async endSession(sessionId: string, reason: string = 'completed'): Promise<VoiceSessionSummary> {
    const client = ApiClient.getInstance();
    const res = await client.post<{ success: boolean; data: VoiceSessionSummary }>(
      `/voice/sessions/${sessionId}/end`,
      { reason }
    );
    return res.data.data;
  }

  public static async getPreferences(): Promise<UserVoicePreferenceData> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: UserVoicePreferenceData }>(
      '/voice/preferences'
    );
    return res.data.data;
  }

  public static async updatePreferences(
    updates: Partial<UserVoicePreferenceData>
  ): Promise<UserVoicePreferenceData> {
    const client = ApiClient.getInstance();
    const res = await client.put<{ success: boolean; data: UserVoicePreferenceData }>(
      '/voice/preferences',
      updates
    );
    return res.data.data;
  }
}
