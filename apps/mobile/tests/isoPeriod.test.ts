import { describe, expect, it } from 'vitest';
import { isoDays } from '../src/utils/isoPeriod.js';

/** The paywall states the intro offer's length from Play's billing period — it must read it right. */
describe('isoDays', () => {
  it('reads Play billing periods', () => {
    expect(isoDays('P1D')).toBe(1);
    expect(isoDays('P3D')).toBe(3);
    expect(isoDays('P1W')).toBe(7);
    expect(isoDays('P1M')).toBe(30);
    expect(isoDays('P1W2D')).toBe(9);
  });
  it('never returns less than one day for odd input', () => {
    expect(isoDays('')).toBe(1);
    expect(isoDays('nonsense')).toBe(1);
    expect(isoDays('P0D')).toBe(1);
  });
});
