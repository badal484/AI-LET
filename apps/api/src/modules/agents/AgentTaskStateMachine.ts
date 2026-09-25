import { AgentTaskStatus } from '@ai-companion/types';

export class AgentTaskStateMachine {
  /**
   * Legal state transitions map for AgentTask lifecycle
   */
  private static readonly VALID_TRANSITIONS: Record<AgentTaskStatus, readonly AgentTaskStatus[]> = {
    created: ['planning', 'cancelled', 'rejected'],
    planning: ['awaiting_confirmation', 'approved', 'executing', 'failed', 'cancelled', 'rejected'],
    awaiting_confirmation: ['approved', 'rejected', 'cancelled', 'expired', 'executing'],
    approved: ['executing', 'cancelled'],
    executing: ['waiting', 'paused', 'completed', 'failed', 'cancelled', 'awaiting_confirmation'],
    waiting: ['executing', 'failed', 'cancelled', 'expired'],
    paused: ['executing', 'cancelled'],
    completed: [], // Terminal
    failed: [],    // Terminal
    cancelled: [], // Terminal
    expired: [],   // Terminal
    rejected: [],  // Terminal
  };

  /**
   * Validates if transition from currentState to targetState is permitted.
   */
  public static canTransition(current: AgentTaskStatus, target: AgentTaskStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[current];
    return allowed ? allowed.includes(target) : false;
  }

  /**
   * Asserts valid state transition or throws a descriptive error.
   */
  public static assertTransition(current: AgentTaskStatus, target: AgentTaskStatus, taskId: string): void {
    if (!this.canTransition(current, target)) {
      throw new Error(
        `Illegal AgentTask state transition for task '${taskId}': cannot move from '${current}' to '${target}'.`
      );
    }
  }

  /**
   * Checks if a status is terminal.
   */
  public static isTerminal(status: AgentTaskStatus): boolean {
    return ['completed', 'failed', 'cancelled', 'expired', 'rejected'].includes(status);
  }
}
