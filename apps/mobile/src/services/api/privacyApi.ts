import { ApiClient } from './client.js';
import type { ApiSuccessResponse } from '@ai-companion/types';

// ---------------------------------------------------------------------------
// Types (inline since Phase 16 types may not yet be in the shared package)
// ---------------------------------------------------------------------------

export interface PrivacySettings {
  id: string;
  userId: string;
  showOnlineStatus: boolean;
  allowAnalytics: boolean;
  allowPersonalization: boolean;
  allowMemoryRetention: boolean;
  dataRetentionDays: number | null;
  allowProactiveMessaging: boolean;
  marketingEmailsEnabled: boolean;
  updatedAt: string;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl: string | null;
  expiresAt: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface BlockedItem {
  id: string;
  blockType: 'USER' | 'CHARACTER' | 'CREATOR';
  targetId: string;
  targetDisplayName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Privacy API
// ---------------------------------------------------------------------------

export const privacyApi = {
  /**
   * GET /privacy/settings — fetch current privacy settings.
   */
  async getSettings(): Promise<PrivacySettings> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<PrivacySettings>>('/privacy/settings');
    return res.data.data;
  },

  /**
   * PATCH /privacy/settings — update one or more privacy fields.
   */
  async updateSettings(updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const client = ApiClient.getInstance();
    const res = await client.patch<ApiSuccessResponse<PrivacySettings>>('/privacy/settings', updates);
    return res.data.data;
  },

  /**
   * POST /privacy/export — request a GDPR-compliant data export.
   */
  async requestExport(): Promise<DataExportRequest> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<DataExportRequest>>('/privacy/export', {});
    return res.data.data;
  },

  /**
   * GET /privacy/export/:id — poll the status of an export request.
   */
  async getExportStatus(id: string): Promise<DataExportRequest> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<DataExportRequest>>(`/privacy/export/${id}`);
    return res.data.data;
  },

  /**
   * POST /privacy/purge-memories — irreversibly delete all conversation memories.
   */
  async purgeMemories(): Promise<{ deletedCount: number }> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<{ deletedCount: number }>>('/privacy/purge-memories', {});
    return res.data.data;
  },

  /**
   * POST /privacy/delete-account — schedule account deletion.
   */
  async requestAccountDeletion(reason?: string): Promise<{ scheduledAt: string }> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<{ scheduledAt: string }>>('/privacy/delete-account', { reason });
    return res.data.data;
  },

  // ---------------------------------------------------------------------------
  // Block / Mute Management
  // ---------------------------------------------------------------------------

  /**
   * GET /safety/blocks — list all blocked users / characters / creators.
   */
  async getBlocks(): Promise<BlockedItem[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<BlockedItem[]>>('/safety/blocks');
    return res.data.data ?? [];
  },

  /**
   * DELETE /safety/blocks/:id — remove a block.
   */
  async removeBlock(id: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/safety/blocks/${id}`);
  },
};
