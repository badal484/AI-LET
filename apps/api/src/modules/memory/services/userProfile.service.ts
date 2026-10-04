import { prisma } from '../../../infrastructure/database/prisma.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { logger } from '../../../config/logger.js';
import { backgroundAIRoute } from '../../ai/routing/aiRoutes.js';
import type { AIProviderName } from '@ai-companion/types';

/**
 * "Who they are": what a user has told ONE character about themselves, kept as a short card the
 * character always sees (not left to relevance ranking), plus dated events — a sister's wedding on
 * the 15th, their birthday — so the character can ask "didi ki shaadi kaisi rahi?" afterwards.
 */
export interface ProfileEvent {
  what: string;
  /** YYYY-MM-DD. For yearly events (birthdays) only the month and day matter. */
  date: string;
  kind: 'once' | 'yearly';
  /** Set once the character has been told to ask about it (once) / the year she wished them (yearly). */
  handledAt?: string;
}

/**
 * A task a mentor gave them ("send 5 proposals") and how it went, so progress survives across days:
 * "teen workout ho gaye is hafte — best streak yet".
 */
export interface ProfileTask {
  what: string;
  /** YYYY-MM-DD the task was given. */
  given: string;
  result?: TaskResult;
  /** Their own words, short ("5 bheje, 1 reply aaya"). */
  note?: string;
  /** YYYY-MM-DD they reported on it. */
  reported?: string;
  /** YYYY-MM-DD the character asked about it (so it isn't asked twice). */
  asked?: string;
  /** YYYY-MM-DD a newer task took its place before they reported on it (no longer open). */
  replaced?: string;
}
export type TaskResult = 'done' | 'partly' | 'skipped';
const RESULTS: TaskResult[] = ['done', 'partly', 'skipped'];
const MAX_TASKS = 8;

export interface UserProfile {
  name?: string;
  nickname?: string;
  city?: string;
  work?: string;
  people: Array<{ relation: string; name?: string; note?: string }>;
  likes: string[];
  dislikes: string[];
  goals: string[];
  health: string[];
  jokes: string[];
  facts: string[];
  events: ProfileEvent[];
  /** Mentors only: the tasks they gave, oldest first. */
  tasks: ProfileTask[];
  /** Mentors only: what they're building together (a tool, a channel, a business) — so every session can pick up where it left off. */
  project?: ProfileProject;
  /** Stories and memories SHE has already told this user ("Kartik broke her chai cup") — so she never
   * retells them and can refer back ("yaad hai maine bataya tha…"). */
  herShared?: string[];
  /** How they like to talk — learned from the chat, so she talks their way, not hers. */
  style?: ProfileStyle;
  /** Mentors only: full courses they're taking (one per language), the newest-updated one is active. */
  courses?: ProfileCourse[];
}

export interface ProfileStyle {
  /** The tone they enjoy: "flirty", "caring", "funny", "deep", "quick and short"… */
  tone?: string;
  /** Topics that light them up (long replies, emojis, questions back). */
  enjoys: string[];
  /** Topics they answer with one word or ignore — her work, her day, a subject she keeps raising. */
  boredBy: string[];
  /** How they write: "short Hinglish, lots of emojis". */
  writes?: string;
}

/** Where they are in a course (see conversations/human/course.ts). */
export interface ProfileCourse {
  /** Curriculum id ("javascript"). */
  id: string;
  /** Current lesson, numbered across the whole course (1…N). */
  lesson: number;
  /** Topic numbers of the current lesson already taught and practised. */
  covered: number[];
  /** intake = asking their level; teach; quiz = lesson check asked; project = level project; complete. */
  stage: 'intake' | 'teach' | 'quiz' | 'project' | 'complete';
  /** Lessons finished (passed, or skipped after a check). */
  done: number[];
  /** What they told about their level and time ("knows HTML, 1 hr a day"). */
  about?: string;
  started: string;
  updated: string;
}

export interface ProfileProject {
  goal: string;
  /** Tools / language / platform ("Python + OpenAI API", "YouTube cooking channel"). */
  stack?: string;
  /** Steps finished, oldest first. */
  done: string[];
  next?: string;
  /** YYYY-MM-DD of the last change. */
  updated: string;
}

const LISTS = ['likes', 'dislikes', 'goals', 'health', 'jokes', 'facts'] as const;
const MAX_ITEMS = 8;
const MAX_LEN = 120;

export const emptyProfile = (): UserProfile => ({ people: [], likes: [], dislikes: [], goals: [], health: [], jokes: [], facts: [], events: [], tasks: [] });

const clip = (s: unknown): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/\s+/g, ' ').replace(/\*\*|`/g, '').trim();
  return t ? t.slice(0, MAX_LEN) : undefined;
};
const same = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeProfile(raw: unknown): UserProfile {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  for (const k of ['name', 'nickname', 'city', 'work'] as const) p[k] = clip(r[k]);
  if (Array.isArray(r['people']))
    p.people = r['people']
      .map((x: any) => ({ relation: clip(x?.relation) ?? '', name: clip(x?.name), note: clip(x?.note) }))
      .filter((x) => x.relation)
      .slice(-MAX_ITEMS);
  for (const k of LISTS) if (Array.isArray(r[k])) p[k] = (r[k] as unknown[]).map(clip).filter((x): x is string => Boolean(x)).slice(-MAX_ITEMS);
  if (Array.isArray(r['events']))
    p.events = r['events']
      .map((x: any) => ({ what: clip(x?.what) ?? '', date: String(x?.date ?? ''), kind: x?.kind === 'yearly' ? ('yearly' as const) : ('once' as const), handledAt: clip(x?.handledAt) }))
      .filter((x) => x.what && DATE.test(x.date))
      .slice(-12);
  if (Array.isArray(r['tasks']))
    p.tasks = r['tasks']
      .map((x: any) => ({
        what: clip(x?.what) ?? '',
        given: String(x?.given ?? ''),
        result: RESULTS.includes(x?.result) ? (x.result as TaskResult) : undefined,
        note: clip(x?.note),
        reported: DATE.test(String(x?.reported ?? '')) ? String(x.reported) : undefined,
        asked: DATE.test(String(x?.asked ?? '')) ? String(x.asked) : undefined,
        replaced: DATE.test(String(x?.replaced ?? '')) ? String(x.replaced) : undefined,
      }))
      .filter((x) => x.what && DATE.test(x.given))
      .slice(-MAX_TASKS);
  const proj = r['project'] as Record<string, unknown> | undefined;
  const goal = clip(proj?.['goal']);
  if (goal) {
    p.project = {
      goal,
      stack: clip(proj?.['stack']),
      done: Array.isArray(proj?.['done']) ? (proj!['done'] as unknown[]).map(clip).filter((x): x is string => Boolean(x)).slice(-MAX_ITEMS) : [],
      next: clip(proj?.['next']),
      updated: DATE.test(String(proj?.['updated'] ?? '')) ? String(proj!['updated']) : '',
    };
  }
  if (Array.isArray(r['herShared'])) {
    const told = (r['herShared'] as unknown[]).map(clip).filter((x): x is string => Boolean(x)).slice(-16);
    if (told.length) p.herShared = told;
  }
  const st = r['style'] as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') {
    const items = (x: unknown) => (Array.isArray(x) ? x.map(clip).filter((v): v is string => Boolean(v)).slice(-6) : []);
    const style: ProfileStyle = { tone: clip(st['tone']), enjoys: items(st['enjoys']), boredBy: items(st['boredBy']), writes: clip(st['writes']) };
    if (style.tone || style.writes || style.enjoys.length || style.boredBy.length) p.style = style;
  }
  if (Array.isArray(r['courses'])) {
    const nums = (x: unknown) => (Array.isArray(x) ? [...new Set(x.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 500))].sort((a, b) => a - b) : []);
    const STAGES: ProfileCourse['stage'][] = ['intake', 'teach', 'quiz', 'project', 'complete'];
    const courses = r['courses']
      .map((x: any) => ({
        id: typeof x?.id === 'string' ? x.id.slice(0, 40) : '',
        lesson: Number.isInteger(x?.lesson) && x.lesson > 0 ? (x.lesson as number) : 1,
        covered: nums(x?.covered),
        stage: STAGES.includes(x?.stage) ? (x.stage as ProfileCourse['stage']) : 'teach',
        done: nums(x?.done),
        about: clip(x?.about),
        started: DATE.test(String(x?.started ?? '')) ? String(x.started) : '',
        updated: DATE.test(String(x?.updated ?? '')) ? String(x.updated) : '',
      }))
      .filter((x) => x.id)
      .slice(-10);
    if (courses.length) p.courses = courses;
  }
  return p;
}

/** The task they still owe an answer on (the newest one without a result). */
export function openTask(profile: UserProfile): ProfileTask | undefined {
  return [...profile.tasks].reverse().find((t) => !t.result && !t.replaced);
}

// "batao your target role" is a question for right now, not a task for later.
const QUESTION_TASK = /\b(batana|batao|bataana|bataiye|tell me)\s*$|\bdetails? (share|batana)|\bshare karna\s*$/i;

const words = (t: string) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
/** "resume ka project section rewrite karna" ≈ "resume ka project section numbers ke saath rewrite karna". */
export function similarTask(a: string, b: string): boolean {
  if (same(a, b)) return true;
  const x = words(a);
  const y = words(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size) >= 0.75 && shared >= 2;
}

/** The same entry in other words ("missed me at 3pm" ≈ "said he missed her at 3 pm"). */
export function nearDuplicate(a: string, b: string): boolean {
  if (same(a, b)) return true;
  const stems = (t: string) => new Set((t.toLowerCase().match(/\p{L}{3,}/gu) ?? []).filter((w) => !['the', 'and', 'her', 'his', 'she', 'him', 'you', 'for', 'with', 'said', 'that'].includes(w)).map((w) => w.slice(0, 4)));
  const x = stems(a);
  const y = stems(b);
  const small = Math.min(x.size, y.size);
  if (!small) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / small >= 0.6 && shared >= (small <= 2 ? 1 : 2);
}

/** A mentor just gave this task: it becomes the open one (an older unanswered task stays unanswered). */
export function addTask(profile: UserProfile, what: string, today: string): void {
  const task = clip(what.replace(/\s+/g, ' '));
  if (!task) return;
  const open = openTask(profile);
  // Re-stating the open task in other words (often while asking about it) isn't a new task.
  if (open && similarTask(open.what, task)) return;
  if (QUESTION_TASK.test(task)) return;
  // The mentor moved on: an older task they never reported on is no longer the open one.
  for (const t of profile.tasks) if (!t.result && !t.replaced) t.replaced = today;
  profile.tasks = [...profile.tasks, { what: task, given: today }].slice(-MAX_TASKS);
}

/** How they did on a task, from what they told the character. Only an open task can get a result. */
export function recordTaskResult(
  profile: UserProfile,
  update: { what?: string; result?: string; note?: string },
  today: string,
  /** The task given in this very exchange: it can't have a result yet. */
  justGiven?: string,
): boolean {
  if (!RESULTS.includes(update.result as TaskResult)) return false;
  const what = clip(update.what);
  // A task replaced today can still get its result: they usually report on it in the same message
  // that makes the mentor give the next task (which marks the old one replaced first).
  const pending = profile.tasks.filter((t) => !t.result && (!t.replaced || t.replaced === today) && !(justGiven && same(t.what, justGiven)));
  // Models paraphrase: an exact match first, else the only (or newest) open task.
  const task = (what && pending.find((t) => same(t.what, what))) || pending[pending.length - 1];
  if (!task) return false;
  task.replaced = undefined;
  task.result = update.result as TaskResult;
  task.note = clip(update.note) ?? task.note;
  task.reported = today;
  return true;
}

const RESULT_WORDS: Record<TaskResult, string> = { done: 'did it', partly: 'did part of it', skipped: "didn't do it" };

/**
 * "Your coaching with them": the open task and their track record, so a mentor can follow up on the
 * right thing, notice a streak and celebrate real numbers. Empty when they never got a task.
 */
export function formatProgress(profile: UserProfile, today: string): string {
  const p = normalizeProfile(profile);
  if (!p.tasks.length) return '';
  const ago = (date: string) => {
    const d = dayDiff(today, date);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  };
  const lines: string[] = [];
  const open = openTask(p);
  if (open)
    lines.push(
      dayDiff(today, open.given) <= 0
        ? `- Task you gave today: "${open.what}" — too soon to ask about it; give them time to do it (ask next time you talk on another day).`
        : `- Open task: "${open.what}" (given ${ago(open.given)}) — they haven't told you how it went yet.`,
    );
  const done = p.tasks.filter((t) => t.result);
  if (done.length) {
    lines.push(
      `- Before that: ${done
        .slice(-5)
        .map((t) => `"${t.what}" — ${RESULT_WORDS[t.result!]}${t.note ? ` (${t.note})` : ''}, ${ago(t.reported ?? t.given)}`)
        .join('; ')}`,
    );
    let streak = 0;
    for (const t of [...done].reverse()) {
      if (t.result !== 'done') break;
      streak++;
    }
    if (streak >= 2) lines.push(`- They've done their last ${streak} tasks in a row — notice it and celebrate it.`);
    const skipped = done.slice(-3).filter((t) => t.result === 'skipped').length;
    if (skipped >= 2) lines.push('- They skipped a few tasks lately: no guilt — make the next task smaller and easier to start.');
  }
  return lines.join('\n');
}

/** What the model sends back: only what changed. */
export interface ProfilePatch {
  set?: Partial<Record<'name' | 'nickname' | 'city' | 'work', string>>;
  people?: Array<{ relation: string; name?: string; note?: string }>;
  add?: Partial<Record<(typeof LISTS)[number], string[]>>;
  remove?: string[];
  events?: Array<{ what: string; date: string; kind?: 'once' | 'yearly' }>;
  /** How an open task went, from what they said ("haan 5 proposals bhej diye"). */
  tasks?: Array<{ what?: string; result?: string; note?: string }>;
  style?: { tone?: string; enjoys?: string[]; bored_by?: string[]; boredBy?: string[]; writes?: string };
  her_shared?: string[];
  /** Choices the user made in a project they're building with her (Nandini's dream home): "a glass house in the mountains". */
  project_choices?: string[];
}

/** Models don't always use the exact shape: people/events nested in "add", lists at the top level. */
export function normalizePatch(raw: unknown): ProfilePatch {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, any>;
  const add: Record<string, unknown> = { ...(r['add'] ?? {}) };
  const set: Record<string, unknown> = { ...(r['set'] ?? {}) };
  for (const k of LISTS) if (Array.isArray(r[k])) add[k] = [...((add[k] as unknown[]) ?? []), ...r[k]];
  for (const k of ['name', 'nickname', 'city', 'work']) {
    if (typeof r[k] === 'string') set[k] = r[k];
    if (typeof add[k] === 'string') set[k] = add[k];
  }
  const people = [...(Array.isArray(r['people']) ? r['people'] : []), ...(Array.isArray(add['people']) ? (add['people'] as unknown[]) : [])];
  const events = [...(Array.isArray(r['events']) ? r['events'] : []), ...(Array.isArray(add['events']) ? (add['events'] as unknown[]) : [])];
  const remove = [...(Array.isArray(r['remove']) ? r['remove'] : []), ...(Array.isArray(add['remove']) ? (add['remove'] as unknown[]) : [])];
  const tasks = [...(Array.isArray(r['tasks']) ? r['tasks'] : []), ...(Array.isArray(add['tasks']) ? (add['tasks'] as unknown[]) : [])];
  return {
    set: set as ProfilePatch['set'],
    add: add as ProfilePatch['add'],
    people: people as ProfilePatch['people'],
    events: events as ProfilePatch['events'],
    remove: remove as string[],
    tasks: tasks as ProfilePatch['tasks'],
    style: r['style'] && typeof r['style'] === 'object' ? (r['style'] as ProfilePatch['style']) : undefined,
    her_shared: Array.isArray(r['her_shared']) ? (r['her_shared'] as string[]) : undefined,
    project_choices: Array.isArray(r['project_choices']) ? (r['project_choices'] as string[]) : undefined,
  };
}

export function applyPatch(profile: UserProfile, rawPatch: ProfilePatch, opts: { allowHealth?: boolean; today?: string; justGivenTask?: string } = {}): UserProfile {
  const patch = normalizePatch(rawPatch);
  const p = normalizeProfile(profile);
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    const val = clip(v);
    if (val && ['name', 'nickname', 'city', 'work'].includes(k)) p[k as 'name'] = val;
  }
  for (const person of patch.people ?? []) {
    const relation = clip(person?.relation);
    if (!relation) continue;
    const name = clip(person.name);
    const existing = p.people.find((x) => same(x.relation, relation) && (!name || !x.name || same(x.name, name)));
    if (existing) {
      existing.name = name ?? existing.name;
      existing.note = clip(person.note) ?? existing.note;
    } else p.people.push({ relation, name, note: clip(person.note) });
  }
  p.people = p.people.slice(-MAX_ITEMS);
  for (const k of LISTS) {
    if (k === 'health' && !opts.allowHealth) continue;
    for (const item of patch.add?.[k] ?? []) {
      const v = clip(item);
      if (v && !p[k].some((x) => same(x, v))) p[k].push(v);
    }
    p[k] = p[k].slice(-MAX_ITEMS);
  }
  for (const gone of patch.remove ?? []) {
    const g = clip(gone);
    if (!g) continue;
    for (const k of LISTS) p[k] = p[k].filter((x) => !same(x, g));
    p.people = p.people.filter((x) => !same(`${x.relation} ${x.name ?? ''}`.trim(), g) && !(x.name && same(x.name, g)));
  }
  for (const e of patch.events ?? []) {
    const what = clip(e?.what);
    if (!what || !DATE.test(String(e.date))) continue;
    const kind = e.kind === 'yearly' ? 'yearly' : 'once';
    const existing = p.events.find((x) => same(x.what, what));
    if (existing) {
      if (existing.date !== e.date) existing.handledAt = undefined;
      existing.date = e.date;
      existing.kind = kind;
    } else p.events.push({ what, date: e.date, kind });
  }
  p.events = p.events.slice(-12);
  for (const t of patch.tasks ?? []) if (t && typeof t === 'object') recordTaskResult(p, t, opts.today ?? localToday().date, opts.justGivenTask);
  // Only into a project that exists (started by her invite); a new goal is never made up here.
  if (p.project) {
    for (const item of patch.project_choices ?? []) {
      const v = clip(item);
      if (v && !p.project.done.some((x) => nearDuplicate(x, v))) p.project.done = [...p.project.done, v].slice(-MAX_ITEMS);
    }
  }
  for (const item of patch.her_shared ?? []) {
    const v = clip(item);
    if (v && !(p.herShared ?? []).some((x) => same(x, v))) p.herShared = [...(p.herShared ?? []), v].slice(-16);
  }
  if (patch.style) {
    const st: ProfileStyle = p.style ?? { enjoys: [], boredBy: [] };
    st.tone = clip(patch.style.tone) ?? st.tone;
    st.writes = clip(patch.style.writes) ?? st.writes;
    const list = (x: unknown) => (Array.isArray(x) ? x.map(clip).filter((v): v is string => Boolean(v)) : []);
    // A topic they now enjoy is no longer boring, and the other way round.
    for (const t of list(patch.style.enjoys)) {
      st.boredBy = st.boredBy.filter((x) => !same(x, t));
      if (!st.enjoys.some((x) => same(x, t))) st.enjoys.push(t);
    }
    for (const t of list(patch.style.bored_by ?? patch.style.boredBy)) {
      st.enjoys = st.enjoys.filter((x) => !same(x, t));
      if (!st.boredBy.some((x) => same(x, t))) st.boredBy.push(t);
    }
    st.enjoys = st.enjoys.slice(-6);
    st.boredBy = st.boredBy.slice(-6);
    if (st.tone || st.writes || st.enjoys.length || st.boredBy.length) p.style = st;
  }
  return p;
}

/** Today's date (YYYY-MM-DD) and weekday where they live. */
export function localToday(timeZone?: string | null, now = new Date()): { date: string; weekday: string } {
  const tz = timeZone || 'Asia/Kolkata';
  try {
    return {
      date: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now),
      weekday: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now),
    };
  } catch {
    return { date: now.toISOString().slice(0, 10), weekday: '' };
  }
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const pretty = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Days from today until a yearly date's next occurrence (0 = today). */
function untilYearly(date: string, today: string): number {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = dayDiff(`${y}${date.slice(4)}`, today);
    if (d >= 0) return d;
  }
  return 400;
}

/** The card the character sees on every reply. */
export function formatProfile(profile: UserProfile, today: string): string {
  const p = normalizeProfile(profile);
  const lines: string[] = [];
  const who = [p.name && `name ${p.name}`, p.nickname && `likes being called "${p.nickname}"`, p.city && `lives in ${p.city}`, p.work && p.work]
    .filter(Boolean)
    .join('; ');
  if (who) lines.push(`- ${who}`);
  if (p.people.length) lines.push(`- People in their life: ${p.people.map((x) => [x.relation, x.name && `(${x.name})`, x.note && `— ${x.note}`].filter(Boolean).join(' ')).join('; ')}`);
  const list = (label: string, items: string[]) => items.length && lines.push(`- ${label}: ${items.join('; ')}`);
  list('Likes', p.likes);
  list('Dislikes', p.dislikes);
  list('Goals', p.goals);
  list('Health things they shared', p.health);
  list('Your inside jokes together', p.jokes);
  list('Other things they told you', p.facts);
  const upcoming = p.events
    .map((e) => ({ e, d: e.kind === 'yearly' ? untilYearly(e.date, today) : dayDiff(e.date, today) }))
    .filter(({ d }) => d >= -3 && d <= 45)
    .sort((a, b) => a.d - b.d)
    .map(({ e, d }) => `${e.what} — ${d === 0 ? 'TODAY' : d === 1 ? 'tomorrow' : d < 0 ? `${-d} day(s) ago` : `on ${pretty(e.kind === 'yearly' ? `${today.slice(0, 4)}${e.date.slice(4)}` : e.date)} (in ${d} days)`}`);
  if (upcoming.length) lines.push(`- Dates coming up / just passed: ${upcoming.join('; ')}`);
  if (p.herShared?.length)
    lines.push(`- Stories you've already told them: ${p.herShared.join('; ')} — don't retell these (you may refer back to them or tell what happened next). Anything else about you is NEW to them: never say "maine bataya tha" about it`);
  if (p.style) {
    const s = p.style;
    const parts = [
      s.tone && `they enjoy a ${s.tone} vibe — lean into it`,
      s.enjoys.length && `topics that light them up: ${s.enjoys.join(', ')}`,
      s.boredBy.length && `topics that bore them (don't bring these up): ${s.boredBy.join(', ')}`,
      s.writes && `they write ${s.writes} — match their length and style`,
    ].filter(Boolean);
    if (parts.length) lines.push(`- TALK THEIR WAY: ${parts.join('; ')}`);
  }
  return lines.join('\n');
}

/**
 * Events that need her attention now: a one-off event that has just happened (ask how it went), or a
 * yearly date that is today (wish them). Marks them handled so she brings each up only once.
 */
export function takeDueEvents(profile: UserProfile, today: string): { due: Array<{ event: ProfileEvent; kind: 'followup' | 'birthday' }>; changed: boolean } {
  const due: Array<{ event: ProfileEvent; kind: 'followup' | 'birthday' }> = [];
  for (const e of profile.events) {
    if (e.kind === 'once') {
      const since = dayDiff(today, e.date);
      if (since >= 1 && since <= 7 && !e.handledAt) {
        due.push({ event: e, kind: 'followup' });
        e.handledAt = today;
      }
    } else if (e.date.slice(5) === today.slice(5) && e.handledAt?.slice(0, 4) !== today.slice(0, 4)) {
      due.push({ event: e, kind: 'birthday' });
      e.handledAt = today;
    }
  }
  return { due, changed: due.length > 0 };
}

export class UserProfileService {
  public static async load(userId: string, characterId: string): Promise<UserProfile> {
    try {
      const row = await prisma.userCharacterProfile.findUnique({ where: { userId_characterId: { userId, characterId } }, select: { data: true } });
      return normalizeProfile(row?.data);
    } catch (err) {
      logger.warn(`Profile load failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      return emptyProfile();
    }
  }

  public static async save(userId: string, characterId: string, profile: UserProfile): Promise<void> {
    const data = normalizeProfile(profile) as unknown as object;
    await prisma.userCharacterProfile.upsert({
      where: { userId_characterId: { userId, characterId } },
      create: { userId, characterId, data },
      update: { data },
    });
  }

  private static readonly PROMPT = `You keep a short profile of what a USER has told a chat CHARACTER about the USER's own life.
You get the current profile (JSON), today's date, and the latest exchange. Reply with ONLY a JSON patch of what changed:
{"set":{"name":"","nickname":"","city":"","work":""},"people":[{"relation":"sister","name":"Pooja","note":"getting married"}],"add":{"likes":[],"dislikes":[],"goals":[],"health":[],"jokes":[],"facts":[]},"remove":[],"events":[{"what":"sister Pooja's wedding","date":"YYYY-MM-DD","kind":"once"}],"tasks":[{"what":"send 5 proposals","result":"partly","note":"sent 3, 1 reply"}],"her_shared":["her brother Kartik broke her chai cup"],"style":{"tone":"flirty","enjoys":["cricket"],"bored_by":["her work"],"writes":"short Hinglish, lots of emojis"}}
("people", "events", "tasks", "her_shared", "project_choices" and "style" are top-level keys, not inside "add".)
Rules:
- Facts come ONLY from what the USER says about the USER (their job, city, family and friends with names, likes, goals, plans). The CHARACTER's lines are context only: anything the character says about itself (its job, home, family, activities, stories) is NEVER a user fact. If the user is just quoting or asking about the character, add nothing.
- "jokes": a running joke or playful nickname the two of them now share (may start from either side), written as "you two joke that …".
- "health": only health things the user chose to share (e.g. "has PCOS", "knee injury").
- Events: plans and big dates in the user's life with a real date. Convert relative dates using today's date and weekday ("kal" = tomorrow, "parso" = day after, "agle Sunday", "2 hafte baad" = 14 days, "15 tareekh" = the next 15th). Birthdays/anniversaries: kind "yearly". If no date can be worked out, don't add an event.
- "remove": exact items from the current profile that the user said are no longer true.
- "tasks": only for a task in the profile's "tasks" list that has no "result" yet, and only when the USER clearly reports on it: "done" (did it), "partly" (did some of it), or "skipped" (didn't do it / won't). Answering a question or chatting about the topic is NOT a report. Copy "what" exactly from the profile and put their numbers or details in "note" (under 12 words). Never invent new tasks and never change a task that already has a result.
- "goals": what they are working towards (e.g. "first freelance client by December", "lose 5 kg", "frontend job"), kept up to date.
- Don't store: moods of the moment, greetings, what they ate today, anything about the chat or the AI itself, flirting, or anything sexual.
- "her_shared": STORIES the CHARACTER told about her own life in her reply — a memory, something that happened, her past, a family story (e.g. "her ex Siddharth and the long distance", "Kartik broke her chai cup", "Kartik is failing maths"). NOT her looks, likes, opinions or small facts (height, hair, favourite food), and not small talk ("she's drinking chai"). Usually nothing — add only real stories. This is the only place the character's own words are recorded.
- "project_choices": only if the profile has a "project" they're building together and this exchange adds to it — for a dream home, the USER's choice ("glass house in the mountains"); for "the case of us", a sweet or funny moment worth recording as evidence ("said he missed her at 3 pm", "worst pickup line about coffee"). A few words each. Otherwise leave it out.
- "style": how THEY like to talk, judged from how they react — "tone" (the vibe they enjoy: flirty, caring, funny, deep, quick and short…), "enjoys" (topics they answer with energy: long replies, emojis, questions back), "bored_by" (topics the CHARACTER raised that they answered with one word, "oo", "ok", or ignored — e.g. "her work", "her design projects"), "writes" (e.g. "short Hinglish, few emojis"). Only when the exchange really shows it.
- Keep each item short (under 12 words), in English. Leave out keys with nothing new. If nothing changed, reply {}.`;

  /** One update at a time per user–character pair, so quick messages don't overwrite each other. */
  private static queues = new Map<string, Promise<void>>();

  /** Background: update the card from the latest exchange. Never throws. */
  public static updateFromExchange(params: Parameters<typeof UserProfileService.runUpdate>[0]): Promise<void> {
    const key = `${params.userId}:${params.characterId}`;
    const next = (this.queues.get(key) ?? Promise.resolve()).then(() => this.runUpdate(params));
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  private static async runUpdate(params: {
    userId: string;
    characterId: string;
    userMessage: string;
    assistantMessage?: string;
    previousAssistantMessage?: string;
    timeZone?: string | null;
    /** A task the character gave in this reply — the user hasn't had a chance to do it yet. */
    justGivenTask?: string;
  }): Promise<void> {
    try {
      const text = params.userMessage.trim();
      // Nothing to learn from "ok", "hmm", emojis — unless it answers an open task ("done ✅", "ho gaya").
      const short = text.split(/\s+/).length < 3 && !/\d/.test(text);
      if (short && !(await this.hasOpenTask(params.userId, params.characterId))) return;
      const settings = await prisma.userMemorySettings.findUnique({ where: { userId: params.userId } });
      if (settings && !settings.memoryEnabled) return;
      const excluded = Array.isArray(settings?.excludedCharacterIds) ? (settings!.excludedCharacterIds as string[]) : [];
      if (excluded.includes(params.characterId)) return;

      const profile = await this.load(params.userId, params.characterId);
      const today = localToday(params.timeZone);
      const exchange = [
        params.previousAssistantMessage ? `CHARACTER (before): "${params.previousAssistantMessage.slice(0, 400)}"` : '',
        `USER: "${text.slice(0, 800)}"`,
        params.assistantMessage ? `CHARACTER (reply): "${params.assistantMessage.slice(0, 400)}"` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const route = backgroundAIRoute();
      const model = route.provider === 'mistral' ? process.env['MISTRAL_PROFILE_MODEL'] || 'mistral-small-latest' : route.model;
      // One retry: a lost update loses a task result or a birthday (quota spikes are common).
      const call = () =>
        AIOrchestrator.executeText(
        route.provider as AIProviderName,
        model,
        [
          { role: 'system', content: this.PROMPT },
          {
            role: 'user',
            content: `Today is ${today.weekday}, ${today.date}.\nCurrent profile: ${JSON.stringify({
              ...profile,
              tasks: profile.tasks.filter((t) => (!t.replaced || t.replaced === today.date) && !(params.justGivenTask && same(t.what, params.justGivenTask))),
            })}\nLatest exchange:\n${exchange}`,
          },
        ],
        { temperature: 0.1, maxTokens: 500 },
      );
      const res = await call().catch(async (err) => {
        logger.warn(`Profile update retrying: ${err instanceof Error ? err.message : 'Unknown'}`);
        await new Promise((r) => setTimeout(r, 4000));
        return call();
      });
      const json = res.content.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return;
      const patch = JSON.parse(json) as ProfilePatch;
      if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) return;
      // Apply to the latest saved card (another process may have updated it meanwhile).
      const latest = await this.load(params.userId, params.characterId);
      const next = applyPatch(latest, patch, { allowHealth: settings?.allowSensitiveMemory ?? false, today: today.date, justGivenTask: params.justGivenTask });
      if (JSON.stringify(next) !== JSON.stringify(latest)) await this.save(params.userId, params.characterId, next);
    } catch (err) {
      logger.warn(`Profile update failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  /** A short reply still matters if it answers an open task ("done ✅") or is a choice in a shared project ("glass house"). */
  private static async hasOpenTask(userId: string, characterId: string): Promise<boolean> {
    const profile = await this.load(userId, characterId);
    return Boolean(openTask(profile) || profile.project?.next);
  }

  /**
   * Change the card in line with the background updates (same queue), so a task recorded now isn't
   * lost when an update that started earlier saves its older copy. Never throws.
   */
  public static mutate(userId: string, characterId: string, change: (profile: UserProfile) => boolean | void): Promise<void> {
    const key = `${userId}:${characterId}`;
    const next = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
      try {
        const profile = await this.load(userId, characterId);
        if (change(profile) !== false) await this.save(userId, characterId, profile);
      } catch (err) {
        logger.warn(`Profile change failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    });
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  /** Is there a birthday today or a just-passed event to ask about? (Doesn't mark anything.) */
  public static async hasBigDay(userId: string, characterId: string, timeZone?: string | null): Promise<boolean> {
    const profile = await this.load(userId, characterId);
    return takeDueEvents(structuredClone(profile), localToday(timeZone).date).due.length > 0;
  }

  /** Forget everything this character knows about them (used with "delete my memories"). */
  public static async clear(userId: string, characterId?: string): Promise<void> {
    await prisma.userCharacterProfile.deleteMany({ where: { userId, ...(characterId ? { characterId } : {}) } });
  }
}
