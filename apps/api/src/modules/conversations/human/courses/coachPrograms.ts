import type { Curriculum } from './types.js';

/** Coaching programs — the same shape as health programs: a short check first, check-ins instead of quizzes. */

export const lifeResetProgram: Curriculum = {
  id: 'life-reset-program',
  kind: 'program',
  name: 'Rebuild your days — a 6-week life reset',
  match: /\b(life|zindagi|goals?|procrastinat\w*|productiv\w*|time management|focus|discipline|burnout|motivation|decision|confus\w*|direction|work-life)\b/i,
  codeLang: 'text',
  docs: 'a doctor or Tele-MANAS 14416 if low mood or exhaustion lasts for weeks — coaching helps, it does not replace care',
  screening:
    'what is going on in their life right now in their own words, what they want to change, how their sleep, energy and mood have been lately (weeks of exhaustion or low mood mean a doctor or Tele-MANAS 14416 alongside coaching), and how much time a day they honestly have',
  levels: [
    {
      title: 'Where you are',
      lessons: [
        { title: 'An honest look', topics: ['a week of noticing: where your time and energy actually go', 'what drains you and what fills you', 'no judgement — it\'s just data'] },
        { title: 'What matters to you', topics: ['your values in three words', 'goals that are really yours vs borrowed ones', 'what "a good day" looks like for you'] },
      ],
      project: 'write your three values and one sentence about a good day for you',
    },
    {
      title: 'One goal, tiny steps',
      lessons: [
        { title: 'One goal', topics: ['choosing ONE goal for six weeks', 'making it small and concrete', 'why one beats five'] },
        { title: 'Tiny habits', topics: ['a 2-minute version of the habit', 'a trigger ("after X, I will Y")', 'tracking without guilt — a missed day is data'] },
        { title: 'Procrastination', topics: ['what you\'re really avoiding (fear, boredom, unclear next step)', 'the smallest next action', 'starting for 5 minutes'] },
      ],
      project: 'two weeks of your tiny habit, tracked — then a check-in on what got in the way',
    },
    {
      title: 'Time, focus and decisions',
      lessons: [
        { title: 'Time and focus', topics: ['your best hours for deep work', 'the phone as the biggest leak', 'saying no to protect a yes'] },
        { title: 'Decisions', topics: ['writing the options and what each costs you', 'deciding by your values, not fear', 'small reversible tests before big choices'] },
      ],
      project: 'one week of protected focus time, and one decision you\'ve been avoiding — made',
    },
    {
      title: 'Keeping yourself',
      lessons: [
        { title: 'Noticing burnout', topics: ['early signs (sleep, irritability, numbness, not calling home)', 'rest that actually rests', 'when to get help (a doctor, Tele-MANAS 14416)'] },
        { title: 'Work-life balance', topics: ['a shutdown ritual after work', 'people who matter, on the calendar', 'enough, not more'] },
        { title: 'Reflection', topics: ['a one-line journal', 'a weekly look back', 'adjusting without starting over'] },
      ],
      project: 'a six-week review: what changed, what you keep, your next one goal',
    },
  ],
};

export const datingConfidenceProgram: Curriculum = {
  id: 'dating-confidence-program',
  kind: 'program',
  name: 'Dating with confidence — a step-by-step program',
  match: /\b(dating|date|crush|first message|text (karna|karu)|pick ?up|relationship|confidence|tinder|bumble|hinge|rizz)\b/i,
  codeLang: 'text',
  docs: '181 (women\'s helpline) and 112 if anyone is unsafe — respect and consent always come first',
  screening:
    'their age (under 18: friendship, confidence and respect only — no dating tactics), what they want (confidence, a first message, a relationship, getting over someone), and where they are right now (single, talking to someone, after a breakup)',
  levels: [
    {
      title: 'You first',
      lessons: [
        { title: 'Liking yourself first', topics: ['confidence comes from a life you like, not lines', 'your three best qualities (with proof)', 'why neediness shows and how to calm it'] },
        { title: 'Respect and consent', topics: ['a no, a block or no reply means stop', 'no tricks, no jealousy games, no fake personas', 'safety when meeting someone new (public place, tell a friend)'] },
      ],
      project: 'write your three best qualities with a real example of each',
    },
    {
      title: 'Starting conversations',
      lessons: [
        { title: 'First messages', topics: ['specific beats generic ("hi" vs something about them)', 'questions that open, not interview', 'what to do when there\'s no reply'] },
        { title: 'Keeping it going', topics: ['matching their energy', 'sharing, not only asking', 'moving from chat to a plan'] },
        { title: 'Dating apps', topics: ['a profile that shows who you are', 'photos and prompts', 'red flags in profiles and chats (money requests, pressure)'] },
      ],
      project: 'three real or practice first messages, reviewed with me',
    },
    {
      title: 'Dates',
      lessons: [
        { title: 'First-date nerves', topics: ['a simple plan (coffee, a walk)', 'what to talk about', 'it\'s two people finding out, not an exam'] },
        { title: 'Reading signals', topics: ['interest vs politeness', 'mixed signals — what you can and can\'t know from text', 'asking directly and kindly'] },
        { title: 'Practice date', topics: ['a role-play first date with me', 'feedback: what went well, one thing to try', 'ending a date warmly'] },
      ],
      project: 'a practice date with me, start to finish — then your top 2 improvements',
    },
    {
      title: 'Hard parts and real relationships',
      lessons: [
        { title: 'Rejection and breakups', topics: ['rejection is information, not a verdict', 'no-contact and healing', 'when sadness lasts — talk to someone (Tele-MANAS 14416)'] },
        { title: 'Healthy relationships', topics: ['communication and fights that end well', 'boundaries', 'red flags: control, threats, isolation — safety first (181, 112)'] },
      ],
      project: 'your own "what I want in a relationship" list — and your non-negotiables',
    },
  ],
};
