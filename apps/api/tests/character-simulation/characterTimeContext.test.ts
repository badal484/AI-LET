import { describe, it, expect } from 'vitest';
import { CharacterTimeContextService } from '../../src/modules/character-simulation/services/CharacterTimeContextService.js';

describe('CharacterTimeContextService - Authoritative Time & Quiet Hours', () => {
  const timeService = CharacterTimeContextService.getInstance();

  it('determines time of day and weekday based on timezone', () => {
    // 2026-09-24 14:00 UTC = 19:30 in Asia/Kolkata (evening)
    const fixedNow = new Date('2026-09-24T14:00:00.000Z');
    const ctx = timeService.getTimeContext('Asia/Kolkata', null, fixedNow);

    expect(ctx.timezone).toBe('Asia/Kolkata');
    expect(ctx.timeOfDay).toBe('evening');
    expect(ctx.dayOfWeek).toBe('Thursday');
    expect(ctx.localDate).toBe('2026-09-24');
  });

  it('calculates elapsed interaction duration accurately', () => {
    const fixedNow = new Date('2026-09-24T14:00:00.000Z');
    const threeDaysAgo = new Date('2026-09-21T14:00:00.000Z');

    const ctx = timeService.getTimeContext('UTC', threeDaysAgo, fixedNow);
    expect(ctx.elapsedSinceLastInteractionSeconds).toBe(3 * 24 * 60 * 60);
  });

  it('evaluates overnight quiet hours correctly', () => {
    // 23:30 UTC -> inside quiet hours 22:00 - 08:00
    const lateNight = new Date('2026-09-24T23:30:00.000Z');
    expect(timeService.isInsideQuietHours('22:00', '08:00', 'UTC', lateNight)).toBe(true);

    // 03:00 UTC -> inside quiet hours
    const earlyMorning = new Date('2026-09-24T03:00:00.000Z');
    expect(timeService.isInsideQuietHours('22:00', '08:00', 'UTC', earlyMorning)).toBe(true);

    // 14:00 UTC -> outside quiet hours
    const afternoon = new Date('2026-09-24T14:00:00.000Z');
    expect(timeService.isInsideQuietHours('22:00', '08:00', 'UTC', afternoon)).toBe(false);
  });
});
