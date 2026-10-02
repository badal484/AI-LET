import type { ProfileCourse, UserProfile } from '../../memory/services/userProfile.service.js';
import { CURRICULA, curriculum, type Curriculum } from './courses/index.js';

/**
 * Courses: "JavaScript sikhao" is a promise to teach the whole language, zero to advanced, in order —
 * not a few snippets. The syllabus is fixed (courses/*.ts); the mentor teaches it topic by topic and keeps
 * the progress with a hidden last line the user never sees:
 *   [[course: covered=1,2]]   topics of the current lesson taught and practised
 *   [[course: quiz]]          lesson check questions asked (after every topic is covered)
 *   [[course: passed]]        they got the check right (or the level project works) → next lesson
 *   [[course: skip=3,4]]      lessons they already know (after a quick check)
 *   [[course: lesson=12]]     they insisted on jumping there
 *   [[course: level=knows HTML, 1 hr a day]]   what they told about their level and time
 *   [[course: start=python]]  a new course
 * The server only lets a lesson pass after all its topics and the check — so nothing is skipped by accident.
 */

export interface FlatLesson {
  n: number;
  title: string;
  topics: string[];
  level: number;
  levelTitle: string;
  lastOfLevel: boolean;
  project: string;
}

const flatCache = new Map<string, FlatLesson[]>();

export function lessonsOf(c: Curriculum): FlatLesson[] {
  const cached = flatCache.get(c.id);
  if (cached) return cached;
  const out: FlatLesson[] = [];
  c.levels.forEach((lv, li) =>
    lv.lessons.forEach((l, i) =>
      out.push({ n: out.length + 1, title: l.title, topics: l.topics, level: li, levelTitle: lv.title, lastOfLevel: i === lv.lessons.length - 1, project: lv.project }),
    ),
  );
  flatCache.set(c.id, out);
  return out;
}

const LEARN =
  /\b(sikha\w*|sikh(na|ni|ne|unga|ungi|enge)|seekh\w*|padha(o|do|na|oge|ye)|teach|learn\w*|course|syllabus|roadmap|tutorial|zero se|scratch|shuru se|basics? se|beginning se|shuru (karu|karun|karoon|kare|karna)|start (karu|karna|karte))\b/i;

/** "JavaScript sikhao", "python seekhna hai zero se", "teach me react" → which course (only ones this mentor teaches). */
export function detectCourseRequest(text: string, ids: string[]): string | undefined {
  if (!LEARN.test(text)) return undefined;
  return CURRICULA.find((c) => ids.includes(c.id) && c.match.test(text))?.id;
}

/** The course they're on now: the most recently touched one (kept last in the list). */
export function activeCourse(profile: UserProfile): ProfileCourse | undefined {
  const courses = profile.courses ?? [];
  return courses[courses.length - 1];
}

function touch(profile: UserProfile, course: ProfileCourse, today: string): void {
  course.updated = today;
  profile.courses = [...(profile.courses ?? []).filter((c) => c !== course), course];
}

/** Starts a course (or switches back to one they already have — progress is kept). */
export function startCourse(profile: UserProfile, id: string, today: string): UserProfile {
  if (!curriculum(id)) return profile;
  const existing = profile.courses?.find((c) => c.id === id);
  const course: ProfileCourse = existing ?? { id, lesson: 1, covered: [], stage: 'intake', done: [], started: today, updated: today };
  touch(profile, course, today);
  return profile;
}

export interface CoursePatch {
  start?: string;
  covered?: number[];
  quiz?: boolean;
  passed?: boolean;
  skip?: number[];
  goto?: number;
  about?: string;
}

const TAG = /\[\[\s*course\s*:\s*([^\]]{1,300})\]\]/gi;
const numbers = (s: string) => (s.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 500);

export function extractCourseTag(text: string): { text: string; patch?: CoursePatch } {
  let patch: CoursePatch | undefined;
  const cleaned = text.replace(TAG, (_m, body: string) => {
    const p: CoursePatch = { ...patch };
    for (const part of body.split('|')) {
      const m = /^\s*([a-z]+)\s*(?:[=:]\s*(.*?))?\s*$/i.exec(part);
      if (!m) continue;
      const key = m[1]!.toLowerCase();
      const value = (m[2] ?? '').trim();
      if (key === 'covered' || key === 'done') p.covered = [...(p.covered ?? []), ...numbers(value)];
      else if (key === 'quiz' || key === 'check') p.quiz = true;
      else if (key === 'passed' || key === 'pass') p.passed = true;
      else if (key === 'skip' || key === 'known') p.skip = [...(p.skip ?? []), ...numbers(value)];
      else if (key === 'lesson' || key === 'goto') p.goto = numbers(value)[0] ?? p.goto;
      else if ((key === 'level' || key === 'about') && value) p.about = value.slice(0, 120);
      else if (key === 'start' && value) p.start = value.toLowerCase().replace(/[^a-z-]/g, '');
    }
    patch = p;
    return '';
  });
  return { text: cleaned.trim(), patch };
}

function advance(course: ProfileCourse, total: number): void {
  let next = course.lesson + 1;
  while (next <= total && course.done.includes(next)) next++;
  course.covered = [];
  if (next > total) {
    course.stage = 'complete';
    return;
  }
  course.lesson = next;
  course.stage = 'teach';
}

/** Applies what the mentor marked. A lesson only passes after every topic and the check question(s). */
export function applyCoursePatch(profile: UserProfile, patch: CoursePatch, today: string): UserProfile {
  if (patch.start && curriculum(patch.start) && activeCourse(profile)?.id !== patch.start) startCourse(profile, patch.start, today);
  const course = activeCourse(profile);
  const c = course && curriculum(course.id);
  if (!course || !c) return profile;
  const lessons = lessonsOf(c);
  const total = lessons.length;
  const stageBefore = course.stage;
  // Their level is set once (from their answer), not rewritten by a stray tag mid-course.
  if (patch.about && (course.stage === 'intake' || !course.about)) {
    course.about = patch.about;
    if (course.stage === 'intake') course.stage = 'teach';
  }
  if (patch.goto && patch.goto <= total && patch.goto !== course.lesson) {
    course.lesson = patch.goto;
    course.covered = [];
    course.stage = 'teach';
  }
  if (patch.skip?.length) {
    course.done = [...new Set([...course.done, ...patch.skip.filter((n) => n <= total)])].sort((a, b) => a - b);
    if (course.done.includes(course.lesson) && course.stage !== 'complete') advance(course, total);
  }
  const current = lessons[course.lesson - 1];
  if (current && patch.covered?.length && course.stage !== 'complete') {
    course.covered = [...new Set([...course.covered, ...patch.covered.filter((n) => n <= current.topics.length)])].sort((a, b) => a - b);
    if (course.stage === 'intake') course.stage = 'teach';
  }
  const allCovered = Boolean(current) && current!.topics.every((_t, i) => course.covered.includes(i + 1));
  if (patch.quiz && allCovered && course.stage === 'teach') course.stage = 'quiz';
  if (patch.passed && current) {
    if (stageBefore === 'project') advance(course, total);
    // Passing needs the check to have been asked in an earlier reply — not asked and passed in one go.
    else if (stageBefore === 'quiz' && allCovered) {
      course.done = [...new Set([...course.done, course.lesson])].sort((a, b) => a - b);
      if (current.lastOfLevel) {
        course.stage = 'project';
        course.covered = [];
      } else advance(course, total);
    }
  }
  touch(profile, course, today);
  return profile;
}

function syllabus(c: Curriculum, course: ProfileCourse): string {
  const lessons = lessonsOf(c);
  return c.levels
    .map((lv, li) => {
      const ls = lessons.filter((l) => l.level === li);
      const allDone = ls.every((l) => course.done.includes(l.n));
      const mark = (l: FlatLesson) => (course.done.includes(l.n) ? '✅' : l.n === course.lesson && course.stage !== 'complete' ? '👉' : '');
      const body = allDone ? `✅ lessons ${ls[0]!.n}–${ls[ls.length - 1]!.n}` : ls.map((l) => `${mark(l)}${l.n}. ${l.title}`).join(' · ');
      return `Level ${li} — ${lv.title}: ${body} → project: ${lv.project}`;
    })
    .join('\n');
}

/** What the mentor must know this turn: the course, where they are, and exactly what to do now. */
export function courseLines(profile: UserProfile, opts: { newSession: boolean }): string[] {
  const course = activeCourse(profile);
  const c = course && curriculum(course.id);
  if (!course || !c) return [];
  const lessons = lessonsOf(c);
  const total = lessons.length;
  const cur = lessons[Math.min(course.lesson, total) - 1]!;
  const lines: string[] = [];
  const paused = (profile.courses ?? []).filter((x) => x !== course && curriculum(x.id));
  lines.push(
    `COURSE YOU ARE TEACHING THEM: ${c.name} — the complete course, zero to advanced: ${c.levels.length} levels, ${total} lessons. You are responsible for all of it, in order; nothing is skipped. Reference docs: ${c.docs}.` +
      (course.about ? ` They told you: ${course.about}.` : '') +
      (paused.length ? ` Paused (progress kept): ${paused.map((x) => `${curriculum(x.id)!.name} at lesson ${x.lesson}`).join(', ')}.` : ''),
  );
  lines.push(`SYLLABUS (✅ done, 👉 now):\n${syllabus(c, course)}`);

  if (course.stage === 'complete') {
    lines.push(
      `They have FINISHED the whole ${c.name} course 🎉. Celebrate it properly. Then help them use it: the final project polished and deployed, a portfolio, interview practice — or the next course (${CURRICULA.filter((x) => x.before && x.before.includes(c.name)).map((x) => x.name).join(', ') || 'another language you teach'}).`,
    );
    return lines;
  }

  const topicList = cur.topics
    .map((t, i) => {
      const n = i + 1;
      const done = course.covered.includes(n);
      const next = !done && cur.topics.findIndex((_x, j) => !course.covered.includes(j + 1)) === i;
      return `${done ? '✅' : next ? '👉' : '  '} ${n}. ${t}`;
    })
    .join('\n');
  lines.push(`NOW: Lesson ${cur.n}/${total} "${cur.title}" (Level ${cur.level}: ${cur.levelTitle}). Its topics — every one gets taught:\n${topicList}`);

  if (opts.newSession && course.stage !== 'intake') {
    const last = [...course.done].pop();
    lines.push(
      `New session: open with a one-line recap — ${last ? `last time you finished lesson ${last} "${lessons[last - 1]!.title}"` : `you had started lesson ${cur.n} "${cur.title}"`} — and say what's today (lesson ${cur.n}, ${course.covered.length ? 'continuing' : 'starting'}). Then continue.`,
    );
  }

  if (course.stage === 'intake') {
    lines.push(
      `They just asked to learn ${c.name}. In THIS reply: say yes in your own voice, then show them the full syllabus — one short line per level with its lesson names (so they see it goes from zero to advanced and nothing is missing), and that every lesson has practice and every level ends with a project.${c.before ? ` Mention that it helps to know ${c.before} first — offer to start there if they don't.` : ''} Then ask ONE question: what they already know (zero is fine) and how much time they have a day. Don't teach a topic yet. When they answer, mark it with [[course: level=what they said]] and start lesson ${cur.n} with its first topic.`,
    );
  } else if (course.stage === 'teach') {
    const remaining = cur.topics.filter((_t, i) => !course.covered.includes(i + 1)).length;
    if (remaining > 0) {
      lines.push(
        `Teach the 👉 topic now (one, at most two, per reply) the full way (see HOW YOU TEACH A COURSE). Mark a topic with [[course: covered=N]] once it's explained and they've tried its mini practice (or you're checking it in this reply). ${remaining} topic${remaining === 1 ? '' : 's'} left in this lesson.`,
      );
    } else {
      lines.push(
        `Every topic of lesson ${cur.n} is taught. Now the lesson check: 3 short questions (mix "what will this print?", "find the bug" and one "why"), numbered, in one message. Add [[course: quiz]]. Don't start the next lesson yet.`,
      );
    }
  } else if (course.stage === 'quiz') {
    lines.push(
      `You asked the lesson-${cur.n} check. Check their answers one by one: right → say what exactly was good; wrong → show the mistake simply, give the right answer and why, and ask one similar question. When they have got it, add [[course: passed]], say "lesson ${cur.n} done ✅" in your own words${cur.lastOfLevel ? `, and give the Level ${cur.level} project` : `, and say the next lesson is ${cur.n + 1} "${lessons[cur.n]?.title ?? ''}"`}.`,
    );
  } else if (course.stage === 'project') {
    lines.push(
      `Level ${cur.level} (${cur.levelTitle}) is done — now its project: ${cur.project}. Give the requirements as a short checklist and a hint on where to start, but NOT the solution. Ask them to send their code; review it (good first, then the 1–2 fixes that matter, with corrected lines). When it works, add [[course: passed]] and start Level ${cur.level + 1}.`,
    );
  }
  return lines;
}

const ASKS_SYLLABUS = /\b(syllabus|roadmap|kahan tak|kitna (hua|ho gaya|bacha)|progress|kaun ?sa lesson|which lesson)\b/i;

/** One line that goes right after their message (where small models listen best). */
export function courseReminder(profile: UserProfile, userText = ''): string {
  const course = activeCourse(profile);
  const c = course && curriculum(course.id);
  if (!course || !c) return '';
  const lessons = lessonsOf(c);
  const cur = lessons[Math.min(course.lesson, lessons.length) - 1]!;
  if (ASKS_SYLLABUS.test(userText))
    return `they asked for the syllabus: show ALL ${c.levels.length} levels (Level 0 to Level ${c.levels.length - 1}), one line each with its lesson names, ✅ on finished lessons and 👉 on lesson ${cur.n} — never "baaki baad mein"; then one line on where they are and what's next`;
  if (course.stage === 'quiz')
    return `the lesson-${cur.n} check is open — add [[course: passed]] only if THIS message really answers your check questions correctly; if it doesn't (just "done"/"ok" or something else), reply to it and ask them to answer the check questions themselves — never answer them for them`;
  if (course.stage === 'project') return `the Level ${cur.level} project is open — no new lesson until they send it and you've reviewed it`;
  if (course.stage === 'teach') {
    const i = cur.topics.findIndex((_t, j) => !course.covered.includes(j + 1));
    if (i >= 0) return `course: lesson ${cur.n}, next topic ${i + 1} "${cur.topics[i]}" — teach it fully (or answer their doubt, then come back to it)`;
    return `course: every topic of lesson ${cur.n} is taught — ask the 3 check questions now ([[course: quiz]])`;
  }
  return '';
}

export const COURSE_METHOD = `- A course is a promise: the whole language, zero to advanced, in the syllabus order. Never jump ahead to a later lesson, and never give "next code" without teaching.
- Each topic, the full way: the idea in one plain line + a real-life comparison → why it's used → a small example that uses ONLY what they've already learnt (if it needs something new, explain that in one line) → the important lines explained → how to run it → exactly what they'll see → the one common mistake → a mini practice ("ab tum: …"). One topic, at most two, per reply — never dump a whole lesson.
- Use their name and their life in examples (their city, food, cricket, marks) — never placeholder names like Alex, John, foo.
- "done", "ho gaya", "chal gaya": ask what it printed or to paste their code, and check it before moving on. A wrong output is a teaching moment, not a "badhiya".
- A doubt in the middle ("return kya hai?", "ye + kyun?"): answer it fully with a tiny example, then come back to the same topic ("chalo wapas …").
- "samajh nahi aaya": explain it a different way — simpler words, another comparison, a smaller example. Never repeat the same text.
- An error: read it with them (bottom line first), show the wrong line, say why in one line, let them fix it.
- "ye mujhe aata hai" / "skip karo": ask 2 quick questions on it; right → [[course: skip=N]] and move on; wrong → teach it quickly.
- "syllabus dikhao", "kahan tak pahunche": show the syllabus with ✅ done and 👉 now.
- Off-topic or career questions: answer, then bring them back to the lesson.
- Code goes in \`\`\` blocks with the language. Inline commands in plain text (node app.js), no backticks. Links as plain addresses (code.visualstudio.com), never [text](url).`;

/** "Ready", "done", "next", "ho gaya", a doubt: inside a course the chat IS the lesson. */
export function continuesCourse(course: ProfileCourse | undefined, text: string, hoursSinceLast: number | null): boolean {
  if (!course || course.stage === 'complete') return false;
  if (LEARN.test(text) || /\b(syllabus|lesson|topic|next|agla|aage|ready|done|ho gaya|chal gaya|run|output|samajh|samjh|doubt|error)\b/i.test(text)) return true;
  return hoursSinceLast !== null && hoursSinceLast < 3;
}

/**
 * The reply still asks them to answer the check (or send the project) — then it can't also be "passed".
 * (Seen live: "check questions ka jawab do…" with a hidden [[course: passed]].)
 */
// "done", "ok", "output aa gaya" — an acknowledgement, not answers to the check.
const ACK_WORDS = new Set(
  'ok okay k done ho hogaya gaya gya gyi gayi haan han ha hmm achha acha accha theek thik hai h output bhi aa aaya aagaya chal chala chalgaya samajh samjh samajhgaya install installed version yes yup yeah next aage chalo badhiya nice cool great thanks thank you thx sir bhai ji bhi kar liya liya kiya ran run it worked works got'.split(' '),
);
export const isJustAck = (text: string): boolean => {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.length > 0 && words.every((w) => ACK_WORDS.has(w));
};

const CONFUSED = /\b(samajh nahi|samjh nahi|samjha nahi|samjhi nahi|nahi samjh\w*|nahi aaya|nahi aya|confus\w*|pata nahi|nahi pata|don'?t know|no idea|didn'?t get)\b/i;

/** Could this message be their answers to the lesson check? ("done", "ok", "samajh nahi aaya" are not.) */
export const answersCheck = (userText: string): boolean => !isJustAck(userText) && !CONFUSED.test(userText);

/** The draft announces a finished lesson ("lesson 1 done ✅") — only fair once they've answered the check. */
export const announcesPass = (text: string): boolean => /\blesson\s*\d+\s*(done|complete|completed|khatam|pass|passed|clear)\b/i.test(text);

export function settleCoursePatch(patch: CoursePatch | undefined, replyText: string, userText = ''): CoursePatch | undefined {
  if (!patch?.passed) return patch;
  // Seen live: "done, output bhi aa gaya" → the mentor answered his own check questions and passed the lesson.
  if (!answersCheck(userText)) return { ...patch, passed: undefined };
  const numberedQuestions = replyText.split('\n').filter((l) => /^\s*\d+[.)]\s.*\?\s*$/.test(l)).length;
  const stillAsking = numberedQuestions >= 2 || /\b(jawab do|jawab bhejo|answer (do|karo|bhejo)|answers? (de|bhej)|code bhejo|project bhejo)\b/i.test(replyText);
  return stillAsking ? { ...patch, passed: undefined } : patch;
}

const PLACEHOLDER_NAMES = /\b(Alex|John|Jane|Alice|Bob|Foo|Bar|Baz|John Doe)\b/;

/** What a course reply got wrong (fed to the editor pass). */
export function courseProblems(params: { text: string; code: string[]; userName?: string }): string[] {
  const problems: string[] = [];
  const all = [params.text, ...params.code].join('\n');
  const placeholder = all.match(PLACEHOLDER_NAMES)?.[0];
  if (placeholder && placeholder.toLowerCase() !== (params.userName ?? '').toLowerCase())
    problems.push(`Don't use placeholder names like "${placeholder}" — use their name${params.userName && params.userName !== 'them' ? ` (${params.userName})` : ''} or something from their life.`);
  if (params.code.length) {
    const words = params.text.replace(/\[\[[^\]]*\]\]/g, '').split(/\s+/).filter(Boolean).length;
    if (words < 25)
      problems.push('You sent code without teaching it. Explain the idea in plain words, the important lines, how to run it and exactly what they will see — then a mini practice.');
  }
  if (params.code.length > 2) problems.push('Too much at once: one topic (one small example) per reply, then let them practise.');
  return problems;
}
