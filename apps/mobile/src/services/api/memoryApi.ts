import { ApiClient } from './client.js';
import type {
  MemoryDetail,
  MemoryItem,
  UserMemorySettingsData,
  UpdateUserMemorySettingsInput,
  ApiSuccessResponse,
} from '@ai-companion/types';
import type { MemoryListQueryInput, UpdateMemoryInput } from '@ai-companion/validation';

export interface MemoryListResponse {
  items: MemoryDetail[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const memoryApi = {
  /**
   * Retrieves paginated active memories for the user.
   */
  async listMemories(query?: MemoryListQueryInput): Promise<MemoryListResponse> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<MemoryDetail[]>>('/memories', {
      params: query,
    });
    return {
      items: res.data.data || [],
      total: res.data.meta?.total || 0,
      page: res.data.meta?.page || 1,
      limit: res.data.meta?.limit || 20,
      hasMore: res.data.meta?.hasMore || false,
    };
  },

  /**
   * Retrieves single memory detail.
   */
  async getMemory(id: string): Promise<MemoryDetail> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<MemoryDetail>>(`/memories/${id}`);
    return res.data.data;
  },

  /**
   * Updates a specific memory.
   */
  async updateMemory(id: string, input: UpdateMemoryInput): Promise<MemoryItem> {
    const client = ApiClient.getInstance();
    const res = await client.patch<ApiSuccessResponse<MemoryItem>>(`/memories/${id}`, input);
    return res.data.data;
  },

  /**
   * Soft-deletes a single memory.
   */
  async deleteMemory(id: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/memories/${id}`);
  },

  /**
   * Wipes all user memories ("Forget Everything").
   */
  async forgetAllMemories(): Promise<{ deletedCount: number }> {
    const client = ApiClient.getInstance();
    const res = await client.delete<ApiSuccessResponse<{ message: string; deletedCount: number }>>('/memories');
    return res.data.data;
  },

  /**
   * Retrieves user memory settings.
   */
  async getSettings(): Promise<UserMemorySettingsData> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<UserMemorySettingsData>>('/memories/settings');
    return res.data.data;
  },

  /**
   * Updates user memory settings.
   */
  async updateSettings(input: UpdateUserMemorySettingsInput): Promise<UserMemorySettingsData> {
    const client = ApiClient.getInstance();
    const res = await client.patch<ApiSuccessResponse<UserMemorySettingsData>>('/memories/settings', input);
    return res.data.data;
  },
};
