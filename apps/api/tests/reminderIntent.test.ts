import { describe, expect, it } from 'vitest';
import { ReminderIntent, zonedToUtc } from '../src/modules/notifications/services/reminderIntent.service.js';

describe('reminders from chat', () => {
  it('spots requests for a reminder (English and Hinglish), not other messages', () => {
    for (const t of ['remind me at 5 to drink water', 'kal 7 baje yaad dilana run pe jaana hai', 'please set an alarm for 6', 'mujhe yaad dila dena dawai']) {
      expect(ReminderIntent.mightAsk(t), t).toBe(true);
    }
    for (const t of ['kaisi ho?', 'I remember that day', 'yaad hai woh din?']) {
      expect(ReminderIntent.mightAsk(t), t).toBe(false);
    }
  });

  it('turns their local time into the right moment', () => {
    expect(zonedToUtc('2026-10-11T07:00', 'Asia/Kolkata')?.toISOString()).toBe('2026-10-11T01:30:00.000Z');
    expect(zonedToUtc('2026-07-01T09:00', 'Europe/London')?.toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedToUtc('not a time', 'Asia/Kolkata')).toBeNull();
  });
});
