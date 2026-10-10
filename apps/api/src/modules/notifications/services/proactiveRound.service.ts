import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { getSetting } from '../../console/appSettings.js';
import { REAL_USERS } from '../../console/overview.service.js';
import { personaPackFor } from '../../conversations/human/personaPacks/index.js';
import { kindTextFirstCheck } from '../../conversations/human/textFirst.js';
import { UserProfileService } from '../../memory/services/userProfile.service.js';
import { NotificationService } from './notification.service.js';
import { NotificationDeliveryEngine } from './NotificationDeliveryEngine.js';
import { ProactiveGeneratorService } from './proactiveGenerator.service.js';

/**
 * Characters texting first — one decision per person, not one per chat.
 *
 * Every round (worker, every 15 minutes) each person gets at most one message, and only when:
 *   - the admin switch is on and they haven't turned "messages from characters" off,
 *   - it's inside the admin's time window and one of THEIR usual chatting hours (learned from when they
 *     write; a sensible evening default until we know), never in their quiet hours,
 *   - they are under today's budget (admin setting, across all characters) and the last one was 4+ h ago,
 *   - they haven't been ignoring us: after 1, 2, 3, 4 unanswered texts we wait 1, 3, 7, 14 days; after 5
 *     we stop until they come back on their own,
 *   - no crisis or emergency moment in the last 3 days (a playful "hey!" then would be wrong).
 * Then the one character with the best reason writes, in their own voice (proactiveGenerator, which also
 * applies each chat's own kindness rules): a big day of theirs first (birthday, interview, exam), then the
 * character they're closest to and spoke with most recently.
 */

const ROUND_USERS = 300;
const MIN_GAP_MS = 4 * 3600_000;
const BACKOFF_DAYS = [1, 3, 7, 14];
const STOP_AFTER_IGNORED = 5;

/** Days to wait after `streak` unanswered texts (null = stop until they come back on their own). */
export function backoffDays(streak: number): number | null {
  if (streak <= 0) return 0;
  if (streak >= STOP_AFTER_IGNORED) return null;
  return BACKOFF_DAYS[streak - 1]!;
}
const CRISIS_PAUSE_MS = 3 * 86_400_000;
const DEFAULT_HOURS = [10, 13, 18, 19, 20, 21];
const STAGE_WEIGHT: Record<string, number> = {
  STRANGER: 0,
  ACQUAINTANCE: 1,
  FRIEND: 2,
  CLOSE_FRIEND: 3,
  CONFIDANT: 4,
  ROMANTIC_PARTNER: 4,
};

export type RoundSkip =
  | 'off'
  | 'opted_out'
  | 'crisis_pause'
  | 'outside_window'
  | 'not_their_hour'
  | 'quiet_hours'
  | 'budget'
  | 'too_soon'
  | 'ignored_backoff'
  | 'ignored_stop'
  | 'active_now'
  | 'no_candidate';

function localHour(tz: string, at = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(at)) % 24;
  } catch {
    return localHour('Asia/Kolkata', at);
  }
}

/** Midnight today in their time zone, as a Date. */
function localMidnight(tz: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(now.getTime() - ((get('hour') % 24) * 3600 + get('minute') * 60 + get('second')) * 1000);
}

/** The hours they usually write in (their time zone), from the last 30 days. */
export async function usualHours(userId: string, tz: string): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ h: number; n: number }>>(
    `SELECT extract(hour FROM m.created_at AT TIME ZONE $2)::int h, count(*)::int n
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = $1::uuid AND m.role = 'user' AND m.created_at > now() - interval '30 days'
      GROUP BY 1`,
    userId,
    tz,
  ).catch(() => []);
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total < 8) return DEFAULT_HOURS;
  // Their busiest hours, plus the hour just before each (a nudge right before they'd open the app anyway).
  const top = [...rows].sort((a, b) => b.n - a.n).filter((r, i) => i < 4 || r.n >= total * 0.12).map((r) => r.h);
  return [...new Set(top.flatMap((h) => [h, (h + 23) % 24]))].sort((a, b) => a - b);
}

/** How many of our latest text-first messages (any character) went unanswered, newest first, and when the last was sent. */
export async function ignoredStreak(userId: string): Promise<{ streak: number; lastAt: Date | null }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ at: Date; replied: boolean }>>(
    `SELECT m.created_at at,
            EXISTS (SELECT 1 FROM messages r WHERE r.conversation_id = m.conversation_id AND r.role = 'user' AND r.created_at > m.created_at) replied
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = $1::uuid AND m.is_proactive AND m.source = 'proactive'
      ORDER BY m.created_at DESC LIMIT ${STOP_AFTER_IGNORED + 1}`,
    userId,
  ).catch(() => []);
  let streak = 0;
  for (const r of rows) {
    if (r.replied) break;
    streak++;
  }
  return { streak, lastAt: rows[0]?.at ?? null };
}

interface Candidate {
  characterId: string;
  conversationId: string;
  score: number;
  bigDay: boolean;
}

/** Their chats a character could text first in, best reason first. */
async function candidatesFor(userId: string, tz: string, muted: string[]): Promise<Candidate[]> {
  const convs = await prisma.$queryRawUnsafe<Array<{ conversationId: string; characterId: string; slug: string; stage: string | null; lastUserAt: Date }>>(
    `SELECT c.id::text "conversationId", c.character_id::text "characterId", ch.slug, rs.stage::text stage,
            (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user') "lastUserAt"
       FROM conversations c
       JOIN characters ch ON ch.id = c.character_id AND ch.status = 'PUBLISHED' AND ch.deleted_at IS NULL
       LEFT JOIN relationships rs ON rs.user_id = c.user_id AND rs.character_id = c.character_id
      WHERE c.user_id = $1::uuid AND c.deleted_at IS NULL AND c.hidden_at IS NULL
      ORDER BY 5 DESC NULLS LAST LIMIT 8`,
    userId,
  ).catch(() => []);
  const out: Candidate[] = [];
  for (const c of convs) {
    if (!c.lastUserAt || muted.includes(c.characterId) || !personaPackFor(c.slug)) continue;
    const bigDay = await UserProfileService.hasBigDay(userId, c.characterId, tz).catch(() => false);
    const kind = await kindTextFirstCheck({ userId, characterId: c.characterId, conversationId: c.conversationId, timeZone: tz, bigDay });
    if (!kind.ok) continue;
    const daysAgo = (Date.now() - c.lastUserAt.getTime()) / 86_400_000;
    out.push({
      characterId: c.characterId,
      conversationId: c.conversationId,
      bigDay,
      score: (bigDay ? 100 : 0) + (STAGE_WEIGHT[c.stage ?? 'STRANGER'] ?? 0) * 5 + Math.max(0, 10 - daysAgo * 3),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Decides for one person; sends at most one message. */
export async function decideFor(userId: string, opts: { dryRun?: boolean; now?: Date } = {}): Promise<{ sent: boolean; skip?: RoundSkip; characterId?: string; reason?: string }> {
  const now = opts.now ?? new Date();
  const prefs = await NotificationService.getUserPreferences(userId);
  if (!prefs.pushEnabled || !prefs.proactivityEnabled || !prefs.characterMessageCategoryEnabled) return { sent: false, skip: 'opted_out' };
  const tz = prefs.timezone && prefs.timezone !== 'UTC' ? prefs.timezone : 'Asia/Kolkata';

  const crisis = await prisma.safetyMoment.count({ where: { userId, kind: { in: ['crisis', 'emergency'] }, createdAt: { gte: new Date(now.getTime() - CRISIS_PAUSE_MS) } } });
  if (crisis) return { sent: false, skip: 'crisis_pause' };

  const hour = localHour(tz, now);
  const [start, end] = [await getSetting('proactive.startHour'), await getSetting('proactive.endHour')];
  if (hour < start || hour >= end) return { sent: false, skip: 'outside_window' };
  if (prefs.quietHoursEnabled && NotificationDeliveryEngine.isWithinQuietHours(tz, prefs.quietHoursStart || '22:30', prefs.quietHoursEnd || '08:00')) {
    return { sent: false, skip: 'quiet_hours' };
  }
  if (!(await usualHours(userId, tz)).includes(hour)) return { sent: false, skip: 'not_their_hour' };

  const lastUserMessage = await prisma.message.findFirst({
    where: { role: 'user', conversation: { userId } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastUserMessage && now.getTime() - lastUserMessage.createdAt.getTime() < 30 * 60_000) return { sent: false, skip: 'active_now' };

  const budget = await getSetting('proactive.dailyBudget');
  const sentToday = await prisma.message.count({
    where: { isProactive: true, source: 'proactive', createdAt: { gte: localMidnight(tz, now) }, conversation: { userId } },
  });
  if (sentToday >= budget) return { sent: false, skip: 'budget' };

  const { streak, lastAt } = await ignoredStreak(userId);
  if (lastAt && now.getTime() - lastAt.getTime() < MIN_GAP_MS) return { sent: false, skip: 'too_soon' };
  const wait = backoffDays(streak);
  if (wait === null) return { sent: false, skip: 'ignored_stop' };
  if (wait > 0 && lastAt && now.getTime() - lastAt.getTime() < wait * 86_400_000) return { sent: false, skip: 'ignored_backoff' };

  const candidates = await candidatesFor(userId, tz, (prefs.mutedCharacterIds as string[] | undefined) ?? []);
  // The best reason first; if that character decides there's nothing kind to say, the next one may.
  for (const c of candidates.slice(0, 2)) {
    const r = await ProactiveGeneratorService.processProactiveOutreach({ userId, characterId: c.characterId, dryRun: opts.dryRun });
    if (r.isExecuted && r.decision === 'SEND') return { sent: true, characterId: c.characterId, reason: c.bigDay ? 'big_day' : 'memory' };
  }
  // No memory gave a topic. The checks above already decided a message is welcome now, and these characters
  // have their own lives to share (persona packs: their day, their story, a small moment), so the closest
  // one sends a light hello in their own voice.
  const top = candidates[0];
  if (top) {
    const r = await ProactiveGeneratorService.processProactiveOutreach({
      userId,
      characterId: top.characterId,
      dryRun: opts.dryRun,
      forcedIntent: 'INVITE_LIGHT_CONVERSATION',
    });
    if (r.isExecuted && r.decision === 'SEND') return { sent: true, characterId: top.characterId, reason: 'light_hello' };
  }
  return { sent: false, skip: 'no_candidate' };
}

/** One round over everyone who could get a message now. */
export async function runProactiveRound(opts: { dryRun?: boolean } = {}): Promise<{ users: number; sent: number; skipped: Partial<Record<RoundSkip, number>> }> {
  const skipped: Partial<Record<RoundSkip, number>> = {};
  if (!(await getSetting('proactive.enabled'))) return { users: 0, sent: 0, skipped: { off: 1 } };
  // People who chatted in the last 30 days and have a phone that takes notifications; least recently texted first.
  const users = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT u.id::text id FROM users u
      WHERE u.status = 'ACTIVE' AND ${REAL_USERS}
        AND EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = u.id AND d.is_active AND d.push_token IS NOT NULL
                     AND d.push_permission_status IN ('AUTHORIZED','PROVISIONAL'))
        AND EXISTS (SELECT 1 FROM conversations c JOIN messages m ON m.conversation_id = c.id
                     WHERE c.user_id = u.id AND m.role = 'user' AND m.created_at > now() - interval '30 days')
      ORDER BY (SELECT max(m.created_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                 WHERE c.user_id = u.id AND m.is_proactive) ASC NULLS FIRST
      LIMIT ${ROUND_USERS}`,
  );
  let sent = 0;
  for (const u of users) {
    try {
      const r = await decideFor(u.id, opts);
      if (r.sent) sent++;
      else if (r.skip) skipped[r.skip] = (skipped[r.skip] ?? 0) + 1;
    } catch (err) {
      logger.warn('Text-first decision failed', { userId: u.id, error: err instanceof Error ? err.message : err });
    }
  }
  return { users: users.length, sent, skipped };
}
