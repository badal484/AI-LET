export interface AgentTaskResponse {
  id: string;
  characterId: string;
  taskGoal: string;
  status: 'created' | 'planning' | 'awaiting_confirmation' | 'executing' | 'completed' | 'failed' | 'cancelled';
  requiredConfirmation?: {
    actionType: string;
    riskLevel: string;
    explanation: string;
  } | null;
  output?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export class AgentsResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Submits an agent task for a character with tool execution.
   */
  public async createTask(params: {
    characterId: string;
    goal: string;
    allowedTools?: string[];
  }): Promise<AgentTaskResponse> {
    const res = await this.requester('/v1/agent-tasks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  }

  /**
   * Retrieves agent task progress and status.
   */
  public async getTask(taskId: string): Promise<AgentTaskResponse> {
    const res = await this.requester(`/v1/agent-tasks/${taskId}`, { method: 'GET' });
    return res.data;
  }

  /**
   * Confirms a high-risk action awaiting user confirmation.
   */
  public async confirmTask(taskId: string, approved: boolean): Promise<AgentTaskResponse> {
    const res = await this.requester(`/v1/agent-tasks/${taskId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
    return res.data;
  }

  /**
   * Cancels an in-progress agent task.
   */
  public async cancelTask(taskId: string): Promise<AgentTaskResponse> {
    const res = await this.requester(`/v1/agent-tasks/${taskId}/cancel`, { method: 'POST' });
    return res.data;
  }
}
