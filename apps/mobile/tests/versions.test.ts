import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src/utils/versions.js';

describe('compareVersions', () => {
  it('orders versions number by number', () => {
    expect(compareVersions('0.1.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });
});
