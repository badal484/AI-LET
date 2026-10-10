import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { backgroundAIRoute } from '../../ai/routing/aiRoutes.js';

/**
 * "Remind me at 5 to drink water" / "kal 7 baje yaad dilana run pe jaana hai" → a reminder the character
 * delivers at that time, in their own voice (worker: ProactiveSchedulerService.processDueReminders).
 *
 * Cheap on purpose: a keyword check first; only messages that ask for a reminder get one tiny AI call to
 * read the exact what / when in the user's own time zone. The chat reply is then told about it, so the
 * character confirms it in their own words.
 */

const ASKS = /\b(remind(er)?|alarm|wake me|yaad\s*(dila|dilana|dilaana|dilaa|dila\s*dena|kara\s*dena|karwa\s*dena)|yaad\s*rakh(na|ke)?\s*(mujhe|muje)?\s*(bol|bata))/i;
const MAX_PENDING = 20;

export interface ReminderOutcome {
  /** Set: confirm it. needsTime: ask when. */
  kind: 'set' | 'needsTime';
  what?: string;
  /** e.g. "tomorrow at 7:00 am" (their time). */
  whenLabel?: string;
  at?: Date;
}

/** Wall-clock parts of a moment in a time zone. */
function partsIn(tz: string, d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' });
  const get = (t: string) => f.formatToParts(d).find((p) => p.type === t)?.value ?? '';
  return { y: +get('year'), m: +get('month'), d: +get('day'), h: +get('hour') % 24, min: +get('minute'), weekday: get('weekday') };
}

/** "2026-10-11T07:00" in a time zone → the real moment. */
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const p = partsIn(tz, new Date(guess));
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess; // the zone's offset at that moment
  return new Date(guess - offset);
}

function label(at: Date, tz: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at);
  if (day(at) === day(now)) return `today at ${time}`;
  if (day(at) === day(new Date(now.getTime() + 86_400_000))) return `tomorrow at ${time}`;
  return `${new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' }).format(at)} at ${time}`;
}

export const ReminderIntent = {
  mightAsk: (text: string) => ASKS.test(text),

  /** Reads the message; creates the reminder when it's clear. Never throws. */
  async handle(params: { userId: string; characterId: string; conversationId: string; text: string; timeZone?: string | null }): Promise<ReminderOutcome | null> {
    if (!ASKS.test(params.text)) return null;
    const tz = params.timeZone && params.timeZone !== 'UTC' ? params.timeZone : 'Asia/Kolkata';
    const now = new Date();
    const p = partsIn(tz, now);
    const nowLocal = `${p.weekday}, ${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')} ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
    try {
      const { provider, model } = backgroundAIRoute();
      const res = await AIOrchestrator.executeText(
        provider,
        model,
        [
          {
            role: 'system',
            content: `You read one chat message (English or Hinglish) and decide if the person asks to be reminded of something. Now it is ${nowLocal} in their time zone. Reply with JSON only:
{"remind": true, "what": "<what to remind, short, in their words>", "at": "YYYY-MM-DDTHH:MM" (their local time)}  — when they ask and say when ("at 5" = the next 5 o'clock that makes sense, "kal" = tomorrow, "subah" = morning ~8, "shaam" = evening ~6, "raat" = night ~9, "in 2 hours" = now + 2h)
{"remind": true, "what": "...", "at": null}  — they ask but give no time
{"remind": false}  — anything else (talking about reminders, asking the character to remember a fact, etc.)`,
          },
          { role: 'user', content: params.text.slice(0, 600) },
        ],
        { temperature: 0, maxTokens: 80 },
      );
      const json = JSON.parse((res.content.match(/\{[\s\S]*\}/) ?? ['{}'])[0]) as { remind?: boolean; what?: string; at?: string | null };
      if (!json.remind || !json.what?.trim()) return null;
      const what = json.what.trim().slice(0, 140);
      if (!json.at) return { kind: 'needsTime', what };
      const at = zonedToUtc(json.at, tz);
      if (!at || at.getTime() < now.getTime() + 30_000 || at.getTime() > now.getTime() + 366 * 86_400_000) return { kind: 'needsTime', what };

      const pending = await prisma.userReminder.count({ where: { userId: params.userId, status: 'PENDING' } });
      if (pending >= MAX_PENDING) return null;
      await prisma.userReminder.create({
        data: {
          userId: params.userId,
          characterId: params.characterId,
          title: what,
          content: what,
          targetTime: at,
          timezone: tz,
          status: 'PENDING',
        },
      });
      return { kind: 'set', what, at, whenLabel: label(at, tz, now) };
    } catch (err) {
      logger.warn('Reminder reading failed', { error: err instanceof Error ? err.message : err });
      return null;
    }
  },

  /** What the character is told for this reply. */
  promptNote(r: ReminderOutcome): string {
    return r.kind === 'set'
      ? ` [REMINDER SET] They asked you to remind them: "${r.what}" — it is set for ${r.whenLabel} their time, and you will text them then. Confirm it in one short, warm line in your own words (mention the time). Don't say "reminder set" like an app.`
      : ` [REMINDER] They want you to remind them about "${r.what}" but didn't say when. Ask them what time, in one short line.`;
  },
};
