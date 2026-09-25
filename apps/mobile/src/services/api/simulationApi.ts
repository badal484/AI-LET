import { ApiClient } from './client.js';
import type {
  CharacterGoalItem,
  OpenConversationalThreadItem,
  CharacterCommitmentItem,
  CharacterContinuityContext,
  ApiSuccessResponse,
} from '@ai-companion/types';

export class SimulationApi {
  /**
   * Retrieves active continuity context for a character (open threads, commitments, active goals)
   */
  public static async getContinuity(characterId: string): Promise<CharacterContinuityContext> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<CharacterContinuityContext>>(
      `/simulation/continuity/${characterId}`,
    );
    return response.data.data;
  }

  /**
   * Lists goals for a character
   */
  public static async listGoals(
    characterId: string,
    params?: { status?: string },
  ): Promise<CharacterGoalItem[]> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<CharacterGoalItem[]>>(
      `/simulation/goals/${characterId}`,
      { params },
    );
    return response.data.data;
  }

  /**
   * Transitions a goal's status and/or records progress (server: PATCH /simulation/goals/:goalId).
   */
  public static async updateGoal(
    goalId: string,
    updates: { targetStatus?: string; progress?: number; reason?: string },
  ): Promise<CharacterGoalItem> {
    const client = ApiClient.getInstance();
    const response = await client.patch<ApiSuccessResponse<CharacterGoalItem>>(
      `/simulation/goals/${goalId}`,
      updates,
    );
    return response.data.data;
  }

  /**
   * Dismisses or deletes a goal
   */
  public static async deleteGoal(goalId: string): Promise<{ message: string }> {
    const client = ApiClient.getInstance();
    const response = await client.delete<ApiSuccessResponse<{ message: string }>>(
      `/simulation/goals/${goalId}`,
    );
    return response.data.data;
  }

  /**
   * Lists open conversational threads for a character
   */
  public static async listThreads(characterId: string): Promise<OpenConversationalThreadItem[]> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<OpenConversationalThreadItem[]>>(
      `/simulation/threads/${characterId}`,
    );
    return response.data.data;
  }

  /**
   * Lists character commitments
   */
  public static async listCommitments(characterId: string): Promise<CharacterCommitmentItem[]> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<CharacterCommitmentItem[]>>(
      `/simulation/commitments/${characterId}`,
    );
    return response.data.data;
  }
}
