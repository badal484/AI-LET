import { ApiClient } from './client.js';
import type {
  RelationshipState,
  UserRelationshipSettingsData,
  ApiSuccessResponse,
} from '@ai-companion/types';

export class RelationshipApi {
  /**
   * Retrieves user relationship & personalization settings
   */
  public static async getSettings(): Promise<UserRelationshipSettingsData> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<UserRelationshipSettingsData>>(
      '/relationships/settings/personalization',
    );
    return response.data.data;
  }

  /**
   * Updates user relationship & personalization settings
   */
  public static async updateSettings(
    settings: Partial<UserRelationshipSettingsData>,
  ): Promise<UserRelationshipSettingsData> {
    const client = ApiClient.getInstance();
    const response = await client.patch<ApiSuccessResponse<UserRelationshipSettingsData>>(
      '/relationships/settings/personalization',
      settings,
    );
    return response.data.data;
  }

  /**
   * Retrieves active relationship status with a specific character
   */
  public static async getRelationship(characterId: string): Promise<RelationshipState> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<RelationshipState>>(
      `/relationships/${characterId}`,
    );
    return response.data.data;
  }

  /**
   * Resets dynamic relationship progression for a specific character back to baseline
   */
  public static async resetRelationship(characterId: string): Promise<RelationshipState> {
    const client = ApiClient.getInstance();
    const response = await client.post<ApiSuccessResponse<RelationshipState>>(
      `/relationships/${characterId}/reset`,
    );
    return response.data.data;
  }

  /**
   * Lists user's active relationships with companion characters
   */
  public static async listRelationships(params?: {
    page?: number;
    limit?: number;
    stage?: string;
  }): Promise<{ items: any[]; pagination: any }> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<any[]>>('/relationships', { params });
    return {
      items: response.data.data || [],
      pagination: response.data.meta,
    };
  }
}
