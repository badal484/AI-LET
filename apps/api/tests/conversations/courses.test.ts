import { describe, expect, it } from 'vitest';
import {
  activeCourse,
  applyCoursePatch,
  continuesCourse,
  courseLines,
  courseProblems,
  courseReminder,
  settleCoursePatch,
  detectCourseRequest,
  extractCourseTag,
  lessonsOf,
  startCourse,
} from '../../src/modules/conversations/human/course.js';
import { CURRICULA, curriculum } from '../../src/modules/conversations/human/courses/index.js';
import { mentorPromptSection } from '../../src/modules/conversations/human/mentor.js';
import { devBhatia } from '../../src/modules/conversations/human/personaPacks/dev-bhatia.js';
import { emptyProfile, normalizeProfile } from '../../src/modules/memory/services/userProfile.service.js';

const ALL = CURRICULA.map((c) => c.id);
const DEV = devBhatia.mentor!.courses!;
const day = '2026-10-02';
const js = curriculum('javascript')!;

/** A profile on JavaScript lesson n with every topic of it covered. */
function onLesson(n: number) {
  const p = startCourse(emptyProfile(), 'javascript', day);
  applyCoursePatch(p, { about: 'zero', goto: n }, day);
  const topics = lessonsOf(js)[n - 1]!.topics.map((_t, i) => i + 1);
  return applyCoursePatch(p, { covered: topics }, day);
}

describe('Course syllabi', () => {
  it('Dev teaches a full course for every language he knows', () => {
    expect([...DEV].sort()).toEqual(CURRICULA.filter((c) => c.codeLang !== 'text').map((c) => c.id).sort());
  });

  it.each(CURRICULA.filter((c) => c.kind !== 'program').map((c) => [c.id, c] as const))('%s goes from zero to advanced, every lesson with topics and every level with a project', (_id, c) => {
    expect(c.levels.length).toBeGreaterThanOrEqual(4);
    expect(c.levels[0]!.title).toBe(c.id === 'dsa' ? 'Foundations' : 'Start');
    for (const level of c.levels) {
      expect(level.project.length).toBeGreaterThan(10);
      for (const lesson of level.lessons) expect(lesson.topics.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('JavaScript starts at "what is JavaScript" and covers the whole language', () => {
    const lessons = lessonsOf(js);
    expect(lessons[0]!.title).toBe('What JavaScript is');
    expect(lessons.length).toBeGreaterThanOrEqual(45);
    const everything = lessons.flatMap((l) => [l.title, ...l.topics]).join(' ').toLowerCase();
    for (const must of ['variables', 'data types', 'closure', 'prototype', 'promise', 'async', 'event loop', 'dom', 'modules', 'generator', 'regex', 'proxy', 'testing', 'node'])
      expect(everything).toContain(must);
  });
});

describe('Starting a course', () => {
  it.each([
    ['mujhe javascript sikhao', 'javascript'],
    ['JavaScript kahan se shuru karu?', 'javascript'],
    ['python seekhna hai zero se', 'python'],
    ['teach me react', 'react'],
    ['node js sikha do', 'nodejs'],
    ['typescript padhao', 'typescript'],
    ['DSA start karna hai', 'dsa'],
    ['SQL ka course karwa do', 'sql'],
  ])('"%s" → %s', (text, id) => {
    expect(detectCourseRequest(text, ALL)).toBe(id);
  });

  it('a normal question or error is not a course request', () => {
    expect(detectCourseRequest('javascript mein ye error aa raha hai', ALL)).toBeUndefined();
    expect(detectCourseRequest('python install hai', ALL)).toBeUndefined();
    expect(detectCourseRequest('java sikhao', ALL)).toBeUndefined();
  });

  it('opens with the syllabus and a question about their level — no teaching yet', () => {
    const lines = courseLines(startCourse(emptyProfile(), 'javascript', day), { newSession: false }).join('\n');
    expect(lines).toMatch(/zero to advanced/);
    expect(lines).toMatch(/Level 0 — Start: 👉1\. What JavaScript is/);
    expect(lines).toMatch(/Level 7/);
    expect(lines).toMatch(/Don't teach a topic yet/);
  });

  it('switching courses keeps the old progress', () => {
    const p = onLesson(12);
    startCourse(p, 'python', day);
    expect(activeCourse(p)!.id).toBe('python');
    startCourse(p, 'javascript', day);
    expect(activeCourse(p)!.lesson).toBe(12);
  });
});

describe('Progress: nothing gets skipped', () => {
  it('reads the hidden tag and hides it', () => {
    const r = extractCourseTag('badhiya, ab tum try karo\n[[course: covered=1, 2 | level=zero, 1 hr a day]]');
    expect(r.text).toBe('badhiya, ab tum try karo');
    expect(r.patch).toEqual({ covered: [1, 2], about: 'zero, 1 hr a day' });
    expect(extractCourseTag('x [[course: quiz]] [[course: passed]]').patch).toEqual({ quiz: true, passed: true });
  });

  it('their level is kept, not overwritten by a stray tag mid-course', () => {
    const p = startCourse(emptyProfile(), 'python', day);
    applyCoursePatch(p, { about: 'zero, 1 hr a day' }, day);
    applyCoursePatch(p, { about: '1, lesson=3' }, day);
    expect(activeCourse(p)!.about).toBe('zero, 1 hr a day');
  });

  it('answering the level question starts lesson 1', () => {
    const p = startCourse(emptyProfile(), 'javascript', day);
    applyCoursePatch(p, { about: 'zero, 1 hr a day', covered: [1] }, day);
    expect(activeCourse(p)).toMatchObject({ stage: 'teach', lesson: 1, covered: [1], about: 'zero, 1 hr a day' });
  });

  it('a lesson cannot pass before every topic is taught', () => {
    const p = startCourse(emptyProfile(), 'javascript', day);
    applyCoursePatch(p, { about: 'zero', covered: [1] }, day);
    applyCoursePatch(p, { quiz: true }, day);
    applyCoursePatch(p, { passed: true }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: 1, stage: 'teach' });
  });

  it('a lesson cannot pass in the same reply that asks the check questions', () => {
    const p = onLesson(3);
    applyCoursePatch(p, { quiz: true, passed: true }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: 3, stage: 'quiz' });
    applyCoursePatch(p, { passed: true }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: 4, stage: 'teach', covered: [], done: [3] });
  });

  it('the last lesson of a level leads to the level project, then the next level', () => {
    const lessons = lessonsOf(js);
    const last = lessons.find((l) => l.level === 1 && l.lastOfLevel)!;
    const p = onLesson(last.n);
    applyCoursePatch(p, { quiz: true }, day);
    applyCoursePatch(p, { passed: true }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: last.n, stage: 'project' });
    expect(courseLines(p, { newSession: false }).join('\n')).toMatch(/number-guessing game/);
    applyCoursePatch(p, { passed: true }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: last.n + 1, stage: 'teach' });
  });

  it('skipping known lessons after a check moves past them', () => {
    const p = startCourse(emptyProfile(), 'javascript', day);
    applyCoursePatch(p, { about: 'knows basics', skip: [1, 2, 3] }, day);
    expect(activeCourse(p)).toMatchObject({ lesson: 4, done: [1, 2, 3] });
  });

  it('finishing the last lesson completes the course', () => {
    const total = lessonsOf(js).length;
    const p = onLesson(total);
    applyCoursePatch(p, { quiz: true }, day);
    applyCoursePatch(p, { passed: true }, day);
    applyCoursePatch(p, { passed: true }, day);
    expect(activeCourse(p)!.stage).toBe('complete');
    expect(courseLines(p, { newSession: false }).join('\n')).toMatch(/FINISHED/);
  });

  it('the prompt shows the current topic and what to do next', () => {
    const p = startCourse(emptyProfile(), 'javascript', day);
    applyCoursePatch(p, { about: 'zero', goto: 11, covered: [1] }, day);
    const lines = courseLines(p, { newSession: true }).join('\n');
    expect(lines).toMatch(/Lesson 11\/\d+ "Functions"/);
    expect(lines).toMatch(/✅ 1\. why functions/);
    expect(lines).toMatch(/👉 2\. function declarations/);
    expect(lines).toMatch(/recap/);
  });

  it('progress survives saving', () => {
    const p = normalizeProfile(JSON.parse(JSON.stringify(onLesson(5))));
    expect(activeCourse(p)).toMatchObject({ id: 'javascript', lesson: 5, stage: 'teach' });
    expect(activeCourse(p)!.covered.length).toBe(lessonsOf(js)[4]!.topics.length);
  });
});

describe('Inside a course', () => {
  const course = activeCourse(onLesson(2))!;
  it('"done", "ready", a doubt or a quick reply continues the lesson', () => {
    expect(continuesCourse(course, 'Done getting output also', 20)).toBe(true);
    expect(continuesCourse(course, 'return kya hota hai', 1)).toBe(true);
    expect(continuesCourse(course, 'samajh nahi aaya', 30)).toBe(true);
    expect(continuesCourse(course, 'haan', 0.2)).toBe(true);
    expect(continuesCourse(undefined, 'done', 0.2)).toBe(false);
  });

  it('code without teaching, placeholder names and code dumps are sent back', () => {
    expect(courseProblems({ text: 'ye lo', code: ['console.log("hi")'], userName: 'Badal' }).join(' ')).toMatch(/without teaching/);
    expect(courseProblems({ text: 'x', code: ['greetUser("Alex")'], userName: 'Badal' }).join(' ')).toMatch(/Alex.*Badal/);
    expect(courseProblems({ text: 'a '.repeat(40), code: ['a', 'b', 'c'] }).join(' ')).toMatch(/one topic/);
    expect(courseProblems({ text: 'function ek kaam ka naam hai. '.repeat(6), code: ['greet("Badal")'], userName: 'Badal' })).toEqual([]);
  });

  it('the reminder after their message keeps the lesson on track', () => {
    const p = onLesson(3);
    expect(courseReminder(p)).toMatch(/ask the 3 check questions/);
    applyCoursePatch(p, { quiz: true }, day);
    expect(courseReminder(p)).toMatch(/only if THIS message really answers/);
    const q = startCourse(emptyProfile(), 'python', day);
    applyCoursePatch(q, { about: 'zero', covered: [1] }, day);
    expect(courseReminder(q)).toMatch(/next topic 2 "interpreted language/);
  });

  it('"passed" is ignored when the same reply still asks them to answer the check', () => {
    const asking = 'badhiya! check questions ka jawab do:\n1. Console.log order kya hoga?\n2. Browser vs Node ka farak?';
    expect(settleCoursePatch({ passed: true }, asking)).toEqual({ passed: undefined });
    expect(settleCoursePatch({ passed: true }, 'teeno sahi! lesson 1 done ✅ ab lesson 2')).toEqual({ passed: true });
    expect(settleCoursePatch({ covered: [1] }, asking)).toEqual({ covered: [1] });
    // "done" is not an answer: no passing on the mentor's own answers.
    expect(settleCoursePatch({ passed: true }, 'sahi pakde! lesson 1 done ✅', 'done, output bhi aa gaya')).toEqual({ passed: undefined });
    expect(settleCoursePatch({ passed: true }, 'teeno sahi ✅', '1. hello pehle 2. brackets 3. code line by line chalata hai')).toEqual({ passed: true });
    expect(settleCoursePatch({ passed: true }, 'aasaan karte hain… lesson 1 done ✅', 'samajh nahi aaya ye wala')).toEqual({ passed: undefined });
  });

  it('asking for the syllabus asks for every level', () => {
    expect(courseReminder(onLesson(5), 'syllabus dikhao, kahan tak pahunche?')).toMatch(/ALL 8 levels.*never "baaki baad mein"/);
  });

  it("Dev's prompt carries the course method and his course list", () => {
    const section = mentorPromptSection(devBhatia);
    expect(section).toMatch(/HOW YOU TEACH A COURSE/);
    expect(section).toMatch(/JavaScript \[javascript\]/);
    expect(section).toMatch(/never placeholder names/);
  });
});

describe('Health programs', () => {
  const programs = CURRICULA.filter((c) => c.kind === 'program');
  it('seven programs, each with a health check first and a milestone per stage', () => {
    expect(programs.map((c) => c.id).sort()).toEqual(['calm-mind-program', 'doctor-visit-program', 'gym-program', 'habit-program', 'nutrition-program', 'skin-program', 'strength-program']);
    for (const c of programs) {
      expect(c.screening, c.id).toBeTruthy();
      expect(c.levels.length, c.id).toBeGreaterThanOrEqual(2);
      for (const level of c.levels) expect(level.project.length, c.id).toBeGreaterThan(10);
    }
  });

  it('starts the way people ask — "routine bana do", "diet plan chahiye", "neend theek karni hai"', () => {
    const all = programs.map((c) => c.id);
    expect(detectCourseRequest('skin routine bana do', all)).toBe('skin-program');
    expect(detectCourseRequest('diet plan chahiye', all)).toBe('nutrition-program');
    expect(detectCourseRequest('neend theek karni hai', all)).toBe('habit-program');
    expect(detectCourseRequest('stress kam karna hai', all)).toBe('calm-mind-program');
    expect(detectCourseRequest('mera skin oily hai kya karu', all)).toBeUndefined();
  });

  it('a program asks the health check before any plan, and checks in instead of quizzing', () => {
    const p = startCourse(emptyProfile(), 'skin-program', day);
    expect(courseLines(p, { newSession: false }).join('\n')).toMatch(/START THE HEALTH CHECK.*Never give the plan or routine before the health check/s);
    applyCoursePatch(p, { about: 'oily skin, no allergies', covered: [1, 2, 3] }, day);
    expect(courseLines(p, { newSession: false }).join('\n')).toMatch(/a check-in, not a quiz/);
    expect(courseLines(p, { newSession: false }).join('\n')).toMatch(/safety rules always come first/);
  });
});
