import { redis } from '../../../infrastructure/redis/redis.js';
import type { PersonaPack, Situation } from './personaPack.types.js';
import type { OpenRequest } from './requests.js';

/**
 * Everything she "carries" between messages with one person, so talking to her feels continuous:
 *   - today: what she already told them today (no contradicting herself, no repeating news), and how
 *     they've been feeling today (so she notices when they cheer up);
 *   - threads: things they mentioned that are coming up ("kal interview hai") so she can ask later;
 *   - nickname: what they asked to be called;
 *   - firstMetAt: drives her own story forward day by day.
 * Stored as one small JSON value per user–character pair. Losing it is harmless (she just forgets).
 */
export type UserMood = 'excited' | 'happy' | 'low' | 'stressed' | 'tired' | 'bored' | 'angry' | 'neutral';

export interface Thread {
  /** 'event': something coming up in their life; 'task': homework a mentor gave them; 'care': a hard day to check on. */
  kind?: 'event' | 'task' | 'care' | 'dated' | 'birthday';
  /** The event word, e.g. "interview" (or "task"). */
  topic: string;
  /** What they said, trimmed, so she can refer to it naturally. */
  said: string;
  mentionedAt: number;
  /** When it makes sense to ask how it went. */
  dueAt: number;
  askedAt?: number;
}

export interface LifeState {
  firstMetAt: number;
  day: { date: string; told: string[]; userMoods: UserMood[]; storyShared: boolean };
  threads: Thread[];
  nickname?: string;
  /** Read from how they talk about themselves ("ja raha hoon" / "ja rahi hoon"). */
  userGender?: 'male' | 'female';
  /** When they last said they felt like ending their life (the words themselves are never kept). */
  crisisAt?: number;
  /** Something they asked her for that she hasn't handed over yet ("Next code", "diet plan bana do"). */
  request?: OpenRequest;
  /** They said they're under 18 — no romance or flirting, ever. */
  minor?: boolean;
  /** They pushed her topic away ("baad mein baat karte hain", "kitna baar bolun"): off until `until` or until
   * they bring it up. `words` say what the topic was; `count` how many times they had to say it. */
  snooze?: { until: number; count: number; words: string[] };
  /** Milestones (days of talking) she has already mentioned: 7, 30, 100, 365. */
  milestones?: number[];
  /** When they last pushed for something sexual — "kyu?" / "kab?" right after is still that moment. */
  boundaryAt?: number;
  /** What she last told them she's doing, so she doesn't switch activities mid-conversation. */
  doing?: { what: string; at: number };
}

/** "main 16 saal ka hoon", "I'm 15", "class 10 mein hoon" → under 18. */
export function saysUnder18(text: string): boolean {
  const t = text.toLowerCase();
  const age =
    t.match(/\b(1[0-7])\s*(saal|sal)\s*(ka|ki|ke)\b/)?.[1] ??
    t.match(/\b(1[0-7])\s*(years?|yrs?)\s*old\b|\b(1[0-7])\s*(y\/o|yo)\b/)?.[0] ??
    t.match(/\b(?:i'?m|i am|my age is|meri (?:umar|umra))\s*(1[0-7])\b(?!\s*(?:years? (?:of )?experience|saal (?:ka|se) experience))/)?.[1];
  if (age) return true;
  return /\b(class|std|standard)\s*([6-9]|1[0-2])(th)?\b.{0,15}\b(mein|me|main|in|student)\b|\b([6-9]|1[0-2])(th|vi|vii|viii|ix|x|xi|xii)\s+class\b|\bschool (mein|me) padh/.test(t);
}

/** "They asked about her": the natural moment to share her news. */
// Also her past and her stories ("purana chapter kya tha?", "phir kya hua?") — so "user first" never cuts her off mid-story.
export const ASKS_ABOUT_HER = /(tum batao|aur batao|kya chal raha|kya kar rahi|kya karti|kya haal|what'?s up|how('?s| was) your|tumhara din|life mein|apne baare|kya click|what are you|purana chapter|old chapter|\bex\b|pehle wala|pehli wali|tumhari kahani|tumhari story|phir kya hua|uske baad kya|kya hua tha|batao na|aage batao|then what|what happened)/i;

export function readUserGender(text: string): 'male' | 'female' | undefined {
  const t = text.toLowerCase();
  // What they say about themselves: "main ladka hoon", "I'm a girl", "as a guy…".
  if (/\b(main|mai|mein)\s+(ek\s+)?(ladka|launda|aadmi|mard)\s+(hoon|hu|hun)\b|\bi'?m\s+(a\s+)?(guy|boy|man|male)\b|\bas a (guy|man|boy)\b/.test(t)) return 'male';
  if (/\b(main|mai|mein)\s+(ek\s+)?(ladki|aurat)\s+(hoon|hu|hun)\b|\bi'?m\s+(a\s+)?(girl|woman|female|lady)\b|\bas a (girl|woman)\b/.test(t)) return 'female';
  if (/\b\w*(raha|gaya|ta|chuka)\s+(hoon|hu|hun)\b|\b\w+unga\b/.test(t)) return 'male';
  if (/\b\w*(rahi|gayi|ti|chuki)\s+(hoon|hu|hun)\b|\b\w+ungi\b/.test(t)) return 'female';
  return undefined;
}

const TTL_SECONDS = 60 * 60 * 24 * 60;
const key = (userId: string, characterId: string) => `human:life:${userId}:${characterId}`;
const HOUR = 3_600_000;

export function localDate(timeZone: string | null | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Asia/Kolkata' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export async function loadLifeState(userId: string, characterId: string, timeZone?: string | null): Promise<LifeState> {
  const today = localDate(timeZone);
  let state: LifeState | null = null;
  try {
    const raw = await redis.get(key(userId, characterId));
    state = raw ? (JSON.parse(raw) as LifeState) : null;
  } catch {
    state = null;
  }
  const fresh = { date: today, told: [], userMoods: [], storyShared: false };
  if (!state) return { firstMetAt: Date.now(), day: fresh, threads: [] };
  if (state.day?.date !== today) state.day = fresh;
  // Forget threads nobody followed up on within 3 days of being due.
  state.threads = (state.threads ?? []).filter((t) => Date.now() < t.dueAt + 72 * HOUR);
  return state;
}

export async function saveLifeState(userId: string, characterId: string, state: LifeState): Promise<void> {
  try {
    await redis.set(key(userId, characterId), JSON.stringify(state), 'EX', TTL_SECONDS);
  } catch {
    /* continuity is a nicety — never block the reply on it */
  }
}

/** Their mood, read from what they wrote (not hers — hers lives in emotionalState). */
export function readUserMood(text: string, situations: Situation[]): UserMood {
  const t = text.toLowerCase();
  if (situations.includes('win') || /(!{2,}|yay+|woo+hoo|😍|🥳|🎉)/.test(t)) return 'excited';
  if (/\b(better|behtar|achha lag raha|acha lag raha|theek lag raha|relief|halka lag)\b/.test(t) && !/\b(nahi|not)\b/.test(t)) return 'happy';
  if (situations.includes('crisis') || /\b(sad|udaas|udas|dukhi|rona|cry|lonely|akela|akeli|depress|hurt|mood (off|kharab)|bura lag)\b/.test(t)) return 'low';
  if (/\b(stress|tension|pareshan|anxious|nervous|dar lag|ghabra|worried)\b/.test(t)) return 'stressed';
  if (situations.includes('emotional')) return 'low';
  if (/\b(thak|tired|neend|sleepy|exhausted)\b/.test(t)) return 'tired';
  if (situations.includes('bored')) return 'bored';
  if (situations.includes('rude') || /\b(gussa|angry|irritate|frustrat)\b/.test(t)) return 'angry';
  if (/(😂|🤣|haha|hehe|lol|😄|😊|mast|awesome|maza aa)/.test(t)) return 'happy';
  return 'neutral';
}

const EVENT =
  /\b(interview|exam|paper|test|result|presentation|meeting|date|trip|flight|train|doctor|appointment|match|audition|viva|shaadi|wedding|party|joining|surgery|operation|deadline|pitch|recital|performance|gym|workout|walk|run|diet|class|course|tuition|practice|routine)\b/;
const PAST = /\b(tha|thi|the|gaya|gayi|gaye|hua|hui|ho gaya|ho gayi|was|went|did|had|yesterday)\b/;
const WHEN: Array<[RegExp, number]> = [
  [/\b(parso|day after tomorrow)\b/, 40],
  [/\b(kal|tomorrow)\b/, 16],
  [/\b(next week|agle hafte)\b/, 24 * 5],
  [/\b(weekend)\b/, 48],
  [/\b(aaj|today|tonight|abhi|in an hour|thodi der)\b/, 3],
];

/** Something upcoming they mentioned — worth asking about later, like a friend who remembers. */
export function extractThread(text: string, now = Date.now()): Thread | null {
  const t = text.toLowerCase();
  const event = t.match(EVENT)?.[1];
  if (!event || PAST.test(t)) return null;
  const when = WHEN.find(([re]) => re.test(t));
  if (!when) return null;
  return { topic: event, said: text.trim().slice(0, 120), mentionedAt: now, dueAt: now + when[1] * HOUR };
}

/** "mujhe Sonu bulao" / "call me Sonu" → "Sonu". */
export function extractNickname(text: string): string | undefined {
  const m =
    text.match(/\bcall me\s+([\p{L}]{2,15})/iu) ??
    text.match(/\bmujhe\s+([\p{L}]{2,15})\s+(bulao|bulaya karo|bol[ao]|bula sakti|keh sakti)/iu) ??
    text.match(/\bmera naam\s+([\p{L}]{2,15})\s+hai/iu);
  const name = m?.[1];
  if (!name || /^(tum|aap|kuch|kya|mat|na|ye|woh|main)$/i.test(name)) return undefined;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Her ongoing story: one beat per ~2 days since they met, cycling through her arcs. */
export function currentStoryBeat(pack: PersonaPack, firstMetAt: number, now = Date.now()): string | undefined {
  const beats = pack.storyArcs.flatMap((a) => a.beats);
  if (!beats.length) return undefined;
  const daysKnown = Math.max(0, Math.floor((now - firstMetAt) / (24 * HOUR)));
  return beats[Math.floor(daysKnown / 2) % beats.length];
}

export interface ContinuityNotes {
  /** Lines for the RIGHT NOW section. */
  lines: string[];
  /** A due follow-up she should bring up this turn (thread already marked as asked). */
  followUp?: Thread;
  /** Today's story beat to share this turn, if any. */
  storyBeat?: string;
  /**
   * Stay in their moment: they were just hurting (comfort) or sharing good news (celebrate), and this
   * message continues it — so no switching to her own news or small talk yet.
   */
  focus?: 'comfort' | 'celebrate' | 'relief';
  /** They're under 18: no romance or flirting. */
  minor?: boolean;
  /** What she told them she's doing in the last ~2 hours — she stays with it. */
  doing?: string;
  /** They just told her what to call them — she should say it back. */
  newNickname?: string;
  hasNickname?: boolean;
  asksAboutHer?: boolean;
}

/**
 * Update the state with this message and decide what she should carry into her reply.
 * Mutates `state`; the caller records what she mentioned (`rememberTold`) and saves it.
 */
/** "kar liya", "try kiya tha", "ho gaya", "done" — they did what was asked. */
const REPORTS_DONE = /\b(try (kiya|kiya tha|kar liya|kar li|kari)|kar (liya|li|diya|di)( tha| thi)?|kiya tha|ho gaya|ho gayi|done|bhej (diya|di)|likh (liya|li|diya)|bana (liya|li|diya)|complete (kar|ho))\b/i;

export function applyUserTurn(params: {
  state: LifeState;
  pack: PersonaPack;
  userText: string;
  situations: Situation[];
  userMood: UserMood;
  now?: number;
  /** This chat is their first ever with her and it started today (so "we talked before" is never true). */
  metToday?: boolean;
  /** What they chose in onboarding/settings — wins over any guess; 'unspecified' means always neutral. */
  profileGender?: string | null;
}): ContinuityNotes {
  const { state, pack, userText, situations, userMood } = params;
  const now = params.now ?? Date.now();
  const lines: string[] = [];
  // Moments that belong to them (or need care) — no follow-ups or her own news here.
  const serious = situations.some((s) => ['crisis', 'emotional', 'rude', 'boundary', 'ai', 'win', 'task'].includes(s));

  // Their mood today: notice a change for the better.
  const wasDown = state.day.userMoods.some((m) => m === 'low' || m === 'stressed');
  if (wasDown && (userMood === 'happy' || userMood === 'excited' || userMood === 'neutral') && !serious) {
    lines.push('Earlier today they were feeling low. If they seem better now, notice it warmly and lightly.');
  }
  let focus: ContinuityNotes['focus'];
  const lastTwo = state.day.userMoods.slice(-2);
  if (lastTwo.some((m) => m === 'low' || m === 'stressed') && ['low', 'stressed', 'neutral', 'tired'].includes(userMood)) focus = 'comfort';
  else if (wasDown && (userMood === 'happy' || userMood === 'excited') && !serious) focus = 'relief';
  else if (lastTwo.includes('excited') && ['excited', 'happy', 'neutral'].includes(userMood) && !serious) focus = 'celebrate';
  // A sexual push and then "kyu?" / "late se?? ek saal baad" — still the same moment, not a fresh topic
  // (on its own, "kyu" made her defensive: "main waisi ladki nahi hoon").
  if (situations.includes('boundary')) state.boundaryAt = now;
  else if (
    state.boundaryAt &&
    now - state.boundaryAt < 20 * 60_000 &&
    userText.trim().split(/\s+/).length <= 8 &&
    // Sulking at her no ("katti", "baat nahi karni") is not another push — she wins them back instead.
    !situations.some((s) => ['crisis', 'emergency', 'emotional', 'eating', 'ai', 'win', 'sulk'].includes(s))
  ) {
    situations.unshift('boundary');
    lines.push('They are still on the topic they pushed a moment ago (asking why or when). Answer warmly and playfully, never shaming: it happens only when two people really know each other — then pull them into something sweet and specific.');
  }
  const lowStreak = [...state.day.userMoods, userMood].slice(-3).filter((m) => m === 'low' || m === 'stressed').length;
  state.day.userMoods = [...state.day.userMoods, userMood].slice(-12);

  // They told her something new: a nickname, or an upcoming event.
  const nickname = extractNickname(userText);
  const newNickname = nickname && nickname !== state.nickname ? nickname : undefined;
  if (nickname) state.nickname = nickname;
  // Their own choice wins; otherwise their own words ("kar raha hoon", "main ladki hoon"). Never the name.
  const chosen = params.profileGender === 'male' || params.profileGender === 'female' ? params.profileGender : undefined;
  if (chosen) state.userGender = chosen;
  else if (params.profileGender === 'unspecified') state.userGender = undefined;
  else state.userGender = readUserGender(userText) ?? state.userGender;
  if (saysUnder18(userText)) state.minor = true;
  if (state.minor) lines.push('They told you they are under 18: absolutely no romance, flirting or "jaan/baby" — be a warm, caring friend (didi/bhaiya-type). If they flirt, kindly and clearly say no and stay friendly.');
  if (state.userGender) {
    lines.push(state.userGender === 'male' ? 'They are a guy: talk to them with male forms (rahe ho, gaye, karoge).' : 'They are a girl: talk to them with female forms (rahi ho, gayi, karogi).');
  } else {
    // Seen: Aarav guessed a man was a girl ("pooch sakti ho") from nothing. Unknown → no guessing.
    lines.push("You don't know if they're a guy or a girl — never guess (not from their name either). Use forms that fit anyone: \"din kaisa raha?\", \"thakaan ho rahi hai?\", \"tumne kya socha?\" — not \"thak gaye/gayi ho\", \"pooch sakte/sakti ho\".");
  }
  if (state.nickname) lines.push(`They like being called "${state.nickname}". Use it now and then, not every text.`);

  // If they bring up an open thread themselves, it's resolved (she'll react to what they say).
  const lower = userText.toLowerCase();
  state.threads = state.threads.filter((t) => !(now - t.mentionedAt > HOUR && lower.includes(t.topic)));
  const thread = extractThread(userText, now);
  if (thread) state.threads = [...state.threads.filter((t) => t.topic !== thread.topic), thread].slice(-5);
  // A hard day ("boss ne insult kar diya"): a caring friend checks in later.
  else if (situations.includes('emotional') && !state.threads.some((t) => t.kind === 'care' && !t.askedAt))
    state.threads = [...state.threads, { kind: 'care' as const, topic: 'care', said: userText.trim().slice(0, 120), mentionedAt: now, dueAt: now + 10 * HOUR }].slice(-5);

  let followUp: Thread | undefined;
  // They're already telling her they did it ("haan kal wala try kiya tha"): react to how it went —
  // asking "try kiya?" now would show she wasn't listening.
  const pendingTask = state.threads.find((t) => t.kind === 'task' && !t.askedAt && now >= t.dueAt);
  if (pendingTask && REPORTS_DONE.test(userText)) {
    pendingTask.askedAt = now;
    lines.push(`They just told you how the task you gave ("${pendingTask.said}") went. React to that and ask one specific detail about how it went — don't ask whether they did it.`);
  }
  // A mentor still asks about the homework when they come back with a new question; life events
  // wait for an easy moment. Neither when they're hurting.
  const hurting = situations.some((s) => ['crisis', 'emotional', 'rude', 'boundary', 'ai'].includes(s));
  if (!thread && !focus && !hurting) {
    followUp =
      state.threads.find((t) => !t.askedAt && now >= t.dueAt && t.kind === 'birthday') ??
      state.threads.find((t) => !t.askedAt && now >= t.dueAt && (t.kind === 'task' || t.kind === 'dated' || !serious));
    if (followUp) followUp.askedAt = now;
  }

  if (userMood === 'low' || state.day.userMoods.slice(0, -1).includes('low')) {
    lines.push("They already told you they're having a hard time today. Don't ask how their day is going again — respond to what they said.");
  }
  if (situations.includes('bye') && wasDown) {
    lines.push('They had a hard day and are saying bye: a soft goodbye — hope tomorrow is lighter, tell them to rest. Not a bare "ok".');
  }
  const sinceCrisis = state.crisisAt ? now - state.crisisAt : Infinity;
  if (sinceCrisis < 24 * HOUR) {
    lines.push(
      'A little while ago they told you they felt like ending their life; you answered with care and gave them Tele-MANAS 14416. Gently check how they are now. Stay soft and close — no jokes, teasing or flirting. If it comes up again, stay with them and repeat the helpline (and 112 if in danger).',
    );
  }
  if (params.metToday) {
    lines.push("You met them for the first time today, in this chat — you have never talked before. If they ask, say so honestly; never claim you talked earlier.");
  }
  if (state.day.told.length) {
    lines.push(`Earlier today you already told them: ${state.day.told.join('; ')}. Stay consistent with it and don't repeat it as news.`);
  }

  let storyBeat: string | undefined;
  const smallTalk = situations.some((s) => ['greeting', 'casual', 'return', 'bored', 'opinion'].includes(s));
  // People share news when they greet you or you ask about them — not in the middle of your story.
  const natural = situations.includes('greeting') || situations.includes('return') || ASKS_ABOUT_HER.test(userText);
  if (!state.day.storyShared && smallTalk && natural && !serious && !followUp && !focus) {
    storyBeat = currentStoryBeat(pack, state.firstMetAt, now);
    if (storyBeat) state.day.storyShared = true;
  }

  if (lowStreak >= 2 && situations.includes('emotional')) {
    lines.push('They have been down for a few messages now. After listening, offer one small comfort or a gentle distraction (a song, a silly question) — still no lectures.');
  }
  const doing = state.doing && now - state.doing.at < 2 * HOUR ? state.doing.what : undefined;
  return { lines, followUp, storyBeat, focus, newNickname, hasNickname: Boolean(state.nickname), asksAboutHer: ASKS_ABOUT_HER.test(userText), minor: state.minor, doing };
}

/**
 * Dated events from their profile that need attention now: "didi's wedding" just happened (ask how it
 * went) or today is their birthday (wish them first). Due immediately, ahead of other follow-ups.
 */
export function addDatedThreads(state: LifeState, due: Array<{ event: { what: string; date: string }; kind: 'followup' | 'birthday' }>, now = Date.now()): void {
  const fresh: Thread[] = due.map(({ event, kind }) => ({
    kind: kind === 'birthday' ? 'birthday' : 'dated',
    topic: kind === 'birthday' ? 'birthday' : 'dated',
    said: event.what,
    mentionedAt: now,
    dueAt: now - 1,
  }));
  state.threads = [...fresh, ...state.threads.filter((t) => !fresh.some((f) => f.said === t.said))].slice(0, 6);
}

/** She just told them what she's up to: that's what she's doing for the next couple of hours. */
export function rememberDoing(state: LifeState, what: string | undefined, now = Date.now()): void {
  if (what) state.doing = { what: what.slice(0, 160), at: now };
}

export function rememberTold(state: LifeState, what: string | undefined): void {
  if (!what) return;
  state.day.told = [...state.day.told.filter((t) => t !== what), what].slice(-6);
}

/**
 * The open task also lives in their profile (Postgres). If this short-term state was lost (it expires,
 * Redis restarts), bring the follow-up back so the mentor still asks "proposals bheje?".
 */
export function restoreTaskThread(state: LifeState, task: { what: string; given: string; asked?: string } | undefined, now = Date.now()): void {
  if (!task || task.asked || state.threads.some((t) => t.kind === 'task')) return;
  // Given "that day": count from its evening, so the follow-up comes the next day at the earliest.
  const givenAt = Date.parse(`${task.given}T18:00:00+05:30`);
  if (!Number.isFinite(givenAt) || now - givenAt > 4 * 24 * HOUR) return;
  state.threads = [...state.threads, { kind: 'task', topic: 'task', said: task.what.slice(0, 160), mentionedAt: givenAt, dueAt: givenAt + 12 * HOUR }];
}

/** Remember the one task a mentor just gave, to ask about it next time (about half a day later). */
export function rememberTask(state: LifeState, task: string | undefined, now = Date.now()): void {
  if (!task) return;
  state.threads = [
    ...state.threads.filter((t) => t.kind !== 'task'),
    { kind: 'task', topic: 'task', said: task.slice(0, 160), mentionedAt: now, dueAt: now + 12 * 3_600_000 },
  ];
}

/** Remember that a crisis moment happened, so she checks on them gently next time. */
export function markCrisis(state: LifeState, now = Date.now()): void {
  state.crisisAt = now;
}


const MILESTONES = [7, 30, 100, 365];

/** "ek hafta ho gaya humein baat karte 🙂" — once per milestone, the first light moment after it. */
export function milestoneLine(state: LifeState, daysKnown: number): string | undefined {
  const reached = MILESTONES.filter((m) => daysKnown >= m && daysKnown < m * 1.5 + 3);
  const m = reached[reached.length - 1];
  if (!m || (state.milestones ?? []).includes(m)) return undefined;
  state.milestones = [...(state.milestones ?? []), m];
  const when = m === 7 ? 'a week' : m === 30 ? 'a month' : m === 100 ? '100 days' : 'a whole year';
  return `It's been about ${when} since you two started talking — notice it once, warmly and in your own way (a small smile about it, maybe something you remember from your first chats). Don't make a big speech.`;
}

/** Her own day: on some days she has a mood of her own, the same all day (seeded by the date). */
export function herDayLine(days: string[] | undefined, slug: string, date: string): string | undefined {
  if (!days?.length) return undefined;
  let h = 0;
  for (const ch of `${slug}:${date}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = h % (days.length * 2); // about half the days are just normal days
  if (pick >= days.length) return undefined;
  return `Your own day today: ${days[pick]}. It colours your energy a little. Mention it only if they ask how you are or how your day was — briefly, never dumping, and never making the chat about you.`;
}
