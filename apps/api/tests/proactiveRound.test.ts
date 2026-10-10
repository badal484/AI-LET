import { describe, expect, it } from 'vitest';
import { backoffDays } from '../src/modules/notifications/services/proactiveRound.service.js';

describe('text-first back-off', () => {
  it('waits longer after each unanswered message, then stops', () => {
    expect([0, 1, 2, 3, 4].map(backoffDays)).toEqual([0, 1, 3, 7, 14]);
    expect(backoffDays(5)).toBeNull();
    expect(backoffDays(9)).toBeNull();
  });
});
