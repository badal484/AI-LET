/**
 * WhatsApp-style dates and times, in the phone's own timezone.
 * Formatted by hand (not Intl) so every device shows exactly the same labels.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

/** Local calendar day, e.g. "2026-9-30" — two messages share a divider when this matches. */
export function dayKey(value: string | number | Date): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Whole calendar days between two moments (0 = same day, 1 = yesterday), DST-safe. */
function daysBetween(earlier: Date, later: Date): number {
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** "10:42 pm" */
export function messageTime(value: string | number | Date): string {
  const d = toDate(value);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Divider inside a chat: "Today", "Yesterday", "Monday", "12 September 2026". */
export function dayLabel(value: string | number | Date, now: Date = new Date()): string {
  const d = toDate(value);
  const days = daysBetween(d, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[d.getDay()]!;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Time in the chat list: "10:42 pm", "Yesterday", "Monday", "29/09/26". */
export function chatListTime(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const d = toDate(value);
  const days = daysBetween(d, now);
  if (days <= 0) return messageTime(d);
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[d.getDay()]!;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;
}

export interface DateDivider {
  kind: 'date';
  id: string;
  label: string;
}

/**
 * Adds a divider above the first message of each day. `messages` is newest-first (as an inverted
 * list renders it), so each divider goes right AFTER the oldest message of its day in the array.
 */
export function withDateDividers<T extends { createdAt?: string | null }>(messages: T[], now: Date = new Date()): Array<T | DateDivider> {
  const out: Array<T | DateDivider> = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;
    out.push(message);
    if (!message.createdAt) continue;
    const older = messages.slice(i + 1).find((m) => m.createdAt);
    if (!older || dayKey(older.createdAt!) !== dayKey(message.createdAt)) {
      out.push({ kind: 'date', id: `date-${dayKey(message.createdAt)}`, label: dayLabel(message.createdAt, now) });
    }
  }
  return out;
}

export const isDateDivider = (item: unknown): item is DateDivider => (item as DateDivider | null)?.kind === 'date';
