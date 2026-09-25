import { describe, it, expect } from 'vitest';
import { SimulationConflictResolver } from '../../src/modules/character-simulation/services/SimulationConflictResolver.js';

describe('SimulationConflictResolver - Authority Hierarchy Resolution', () => {
  const resolver = SimulationConflictResolver.getInstance();

  it('prefers EXPLICIT_USER_STATEMENT over MODEL_INFERENCE', () => {
    const res = resolver.resolveConflict('STATE_VS_MESSAGE', {
      authority: 'MODEL_INFERENCE',
      value: 'User enjoys hiking on weekends',
    }, {
      authority: 'EXPLICIT_USER_STATEMENT',
      value: 'User hates outdoor activities',
    });

    expect(res.winningAuthority).toBe('EXPLICIT_USER_STATEMENT');
    expect(res.resolvedValue).toBe('User hates outdoor activities');
    expect(res.item.conflictType).toBe('STATE_VS_MESSAGE');
  });

  it('prefers CURRENT_SYSTEM_STATE over VALIDATED_MEMORY', () => {
    const res = resolver.resolveConflict('STATE_VS_MEMORY', {
      authority: 'CURRENT_SYSTEM_STATE',
      value: 'Goal Status: COMPLETED',
    }, {
      authority: 'VALIDATED_MEMORY',
      value: 'Goal Status: IN_PROGRESS',
    });

    expect(res.winningAuthority).toBe('CURRENT_SYSTEM_STATE');
    expect(res.resolvedValue).toBe('Goal Status: COMPLETED');
  });
});
