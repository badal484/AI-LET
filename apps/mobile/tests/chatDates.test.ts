import { describe, expect, it } from 'vitest';
import { chatListTime, dayLabel, messageTime, withDateDividers } from '../src/utils/chatDates.js';

// Local-time dates (the app always works in the phone's timezone).
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi);
const NOW = at(2026, 9, 30, 10, 0); // Wednesday 30 Sep 2026, 10:00 am

describe('WhatsApp-style dates', () => {
  it('formats message times as "10:42 pm"', () => {
    expect(messageTime(at(2026, 9, 30, 22, 42))).toBe('10:42 pm');
    expect(messageTime(at(2026, 9, 30, 0, 5))).toBe('12:05 am');
    expect(messageTime(at(2026, 9, 30, 12, 0))).toBe('12:00 pm');
  });

  it('labels days like WhatsApp', () => {
    expect(dayLabel(at(2026, 9, 30, 0, 1), NOW)).toBe('Today');
    expect(dayLabel(at(2026, 9, 29, 23, 59), NOW)).toBe('Yesterday');
    expect(dayLabel(at(2026, 9, 28), NOW)).toBe('Monday');
    expect(dayLabel(at(2026, 9, 24), NOW)).toBe('Thursday');
    expect(dayLabel(at(2026, 9, 23), NOW)).toBe('23 September 2026');
  });

  it('handles the new year', () => {
    expect(dayLabel(at(2026, 12, 31, 23, 0), at(2027, 1, 1, 0, 30))).toBe('Yesterday');
  });

  it('formats chat-list times', () => {
    expect(chatListTime(at(2026, 9, 30, 8, 7), NOW)).toBe('8:07 am');
    expect(chatListTime(at(2026, 9, 29), NOW)).toBe('Yesterday');
    expect(chatListTime(at(2026, 9, 27), NOW)).toBe('Sunday');
    expect(chatListTime(at(2026, 9, 2), NOW)).toBe('02/09/26');
    expect(chatListTime(null, NOW)).toBe('');
  });

  it('puts one divider above the first message of each day (newest-first list)', () => {
    const msgs = [
      { id: 'd', createdAt: at(2026, 9, 30, 9).toISOString() },
      { id: 'c', createdAt: at(2026, 9, 30, 8).toISOString() },
      { id: 'b', createdAt: at(2026, 9, 29, 22).toISOString() },
      { id: 'a', createdAt: at(2026, 9, 28, 20).toISOString() },
    ];
    const out = withDateDividers(msgs, NOW).map((x) => ('kind' in x ? `[${x.label}]` : x.id));
    // Inverted list: reading bottom-up this is "[Monday] a [Yesterday] b [Today] c d".
    expect(out).toEqual(['d', 'c', '[Today]', 'b', '[Yesterday]', 'a', '[Monday]']);
  });

  it('flips "Today" to "Yesterday" after midnight', () => {
    const msgs = [{ id: 'x', createdAt: at(2026, 9, 30, 23).toISOString() }];
    expect(withDateDividers(msgs, at(2026, 10, 1, 0, 1)).map((x) => ('kind' in x ? x.label : x.id))).toEqual(['x', 'Yesterday']);
  });
});
