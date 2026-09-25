import { logger } from '../../../shared/utils/logger.js';
import type { SimulationConflictItem } from '@ai-companion/types';

export type ConflictSourceAuthority =
  | 'EXPLICIT_USER_STATEMENT'
  | 'CURRENT_SYSTEM_STATE'
  | 'VERIFIED_TOOL_RESULT'
  | 'RECENT_CONVERSATION'
  | 'VALIDATED_MEMORY'
  | 'SIMULATION_INFERENCE'
  | 'MODEL_INFERENCE';

const AUTHORITY_RANKS: Record<ConflictSourceAuthority, number> = {
  EXPLICIT_USER_STATEMENT: 7,
  CURRENT_SYSTEM_STATE: 6,
  VERIFIED_TOOL_RESULT: 5,
  RECENT_CONVERSATION: 4,
  VALIDATED_MEMORY: 3,
  SIMULATION_INFERENCE: 2,
  MODEL_INFERENCE: 1,
};

export class SimulationConflictResolver {
  private static instance: SimulationConflictResolver;

  private constructor() {}

  public static getInstance(): SimulationConflictResolver {
    if (!SimulationConflictResolver.instance) {
      SimulationConflictResolver.instance = new SimulationConflictResolver();
    }
    return SimulationConflictResolver.instance;
  }

  /**
   * Resolves a contradiction between two sources using strict hierarchy rules.
   */
  public resolveConflict<T>(
    conflictType: 'STATE_VS_MESSAGE' | 'STATE_VS_MEMORY' | 'STATE_VS_CREATOR' | 'VERSION_MISMATCH',
    sourceA: { authority: ConflictSourceAuthority; value: T; label?: string },
    sourceB: { authority: ConflictSourceAuthority; value: T; label?: string }
  ): { resolvedValue: T; winningAuthority: ConflictSourceAuthority; reason: string; item: SimulationConflictItem } {
    const rankA = AUTHORITY_RANKS[sourceA.authority] || 0;
    const rankB = AUTHORITY_RANKS[sourceB.authority] || 0;

    let winningAuthority: ConflictSourceAuthority;
    let resolvedValue: T;
    let reason: string;

    if (rankA >= rankB) {
      winningAuthority = sourceA.authority;
      resolvedValue = sourceA.value;
      reason = `Authority rank ${sourceA.authority} (${rankA}) supersedes ${sourceB.authority} (${rankB})`;
    } else {
      winningAuthority = sourceB.authority;
      resolvedValue = sourceB.value;
      reason = `Authority rank ${sourceB.authority} (${rankB}) supersedes ${sourceA.authority} (${rankA})`;
    }

    const item: SimulationConflictItem = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conflictType,
      sourceA: { type: sourceA.authority, value: sourceA.value },
      sourceB: { type: sourceB.authority, value: sourceB.value },
      resolvedValue,
      reason,
      resolvedAt: new Date().toISOString(),
    };

    logger.debug(`SimulationConflictResolver: resolved conflict (${conflictType}) -> chosen ${winningAuthority}`);
    return { resolvedValue, winningAuthority, reason, item };
  }
}
