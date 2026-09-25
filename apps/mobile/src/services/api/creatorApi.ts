import { ApiClient } from './client.js';
import type { CreatorPublicProfile } from '@ai-companion/types';

export class CreatorApi {
  /**
   * Retrieves public creator profile and their published characters.
   */
  public static async getPublicProfile(username: string): Promise<CreatorPublicProfile> {
    const client = ApiClient.getInstance();
    const res = await client.get<{ success: boolean; data: CreatorPublicProfile }>(
      `/creators/${username}`,
    );
    return res.data.data;
  }

  /**
   * Toggles following or unfollowing a creator.
   */
  public static async toggleFollow(
    username: string,
    follow?: boolean,
  ): Promise<{ isFollowing: boolean; totalFollowers: number }> {
    const client = ApiClient.getInstance();
    const res = await client.post<{
      success: boolean;
      data: { isFollowing: boolean; totalFollowers: number };
    }>(`/creators/${username}/follow`, { follow });
    return res.data.data;
  }
}
