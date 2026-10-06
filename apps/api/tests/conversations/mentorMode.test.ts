import { describe, expect, it } from 'vitest';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { extractTaskTag, isTeachingMoment, mentorPromptSection, promisesIncome } from '../../src/modules/conversations/human/mentor.js';
import { applyUserTurn, rememberTask, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { rajBansal } from '../../src/modules/conversations/human/personaPacks/raj-bansal.js';
import { adityaAgarwal } from '../../src/modules/conversations/human/personaPacks/aditya-agarwal.js';

const HOUR = 3_600_000;
const state = (): LifeState => ({ firstMetAt: Date.now(), day: { date: '2026-09-30', told: [], userMoods: [], storyShared: false }, threads: [] });

describe('Mentor mode', () => {
  it('all four Learn & Earn mentors have mentor packs', () => {
    for (const slug of ['raj-bansal', 'shreya-mehta', 'aditya-agarwal', 'jiya-singhal']) {
      expect(personaPackFor(slug)?.mentor, slug).toBeTruthy();
    }
  });

  it('treats real questions in their field as lessons, small talk as small talk', () => {
    const q = 'paise kab se milte hain youtube se';
    expect(isTeachingMoment(rajBansal, q, classifySituations(q, 1))).toBe(true);
    expect(isTeachingMoment(rajBansal, 'hi raj', classifySituations('hi raj', 1))).toBe(false);
    expect(isTeachingMoment(rajBansal, 'kya tum bot ho?', classifySituations('kya tum bot ho?', 1))).toBe(false);
  });

  it('a lesson continues: practice they were asked to send, answers after a lesson, scam questions', () => {
    const jiya = personaPackFor('jiya-singhal')!;
    const practice = 'I am fresher and I am passionate for coding and I done project in python';
    expect(isTeachingMoment(jiya, practice, classifySituations(practice, 1), 'apna intro likh ke mujhe bhejo, main check karungi.')).toBe(true);
    const answer = 'silai aati hai, din mein 3 ghante free hoon';
    expect(isTeachingMoment(adityaAgarwal, answer, classifySituations(answer, 1), 'pehle test karna zaroori hai.', 'mere paas 20 hazar hain, ghar se kuch shuru karna hai')).toBe(true);
    const scam = 'ek telegram group bol raha hai 10k lagao, roz 2% return guaranteed. join karu?';
    expect(isTeachingMoment(adityaAgarwal, scam, classifySituations(scam, 1))).toBe(true);
    expect(isTeachingMoment(adityaAgarwal, 'ok thanks', classifySituations('ok thanks', 1), 'aaj ka kaam likh ke bhejo')).toBe(false);
  });

  it('pulls the hidden task line out of the reply', () => {
    const r = extractTaskTag('aaj ka kaam: 10 video ideas likho\n[[task: 10 video ideas likhna]]');
    expect(r.task).toBe('10 video ideas likhna');
    expect(r.text).toBe('aaj ka kaam: 10 video ideas likho');
  });

  it('follows up on the task next time, even if they open with a new question', () => {
    const s = state();
    rememberTask(s, '10 video ideas likhna', Date.now() - 13 * HOUR);
    const notes = applyUserTurn({ state: s, pack: rajBansal, userText: 'thumbnail kaise banau?', situations: ['task'], userMood: 'neutral' });
    expect(notes.followUp?.kind).toBe('task');
    const plan = planReply(['task'], [], rajBansal, { continuity: notes, mentor: true });
    expect(plan.followUp?.said).toBe('10 video ideas likhna');
    expect(plan.moves).toMatch(/teach/);
  });

  it('keeps only one open task', () => {
    const s = state();
    rememberTask(s, 'first');
    rememberTask(s, 'second');
    expect(s.threads.filter((t) => t.kind === 'task').map((t) => t.said)).toEqual(['second']);
  });

  it('puts verified facts and money rules in the prompt', () => {
    const section = mentorPromptSection(adityaAgarwal);
    expect(section).toContain('udyamregistration.gov.in');
    expect(section).toContain('₹1.5 crore');
    expect(section).toContain('1930');
    const prompt = buildHumanPrompt({
      pack: adityaAgarwal,
      userName: 'Rohit',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'calm' },
      situations: ['task'],
      plan: planReply(['task'], [], adityaAgarwal, { mentor: true }),
    });
    expect(prompt).toContain('VERIFIED FACTS');
    expect(prompt).toContain('[[task:');
  });

  it('catches income promises but not scam warnings', () => {
    expect(promisesIncome('is plan se 1 lakh mahina guaranteed income hogi')).toBe(true);
    expect(promisesIncome('100% viral hoga ye reel')).toBe(true);
    expect(promisesIncome('guaranteed returns = red flag, paisa mat do')).toBe(false);
    expect(promisesIncome('koi guarantee nahi hoti income ki')).toBe(false);
    const r = checkReply({ bubbles: ['ye karo, 50k mahina pakka income'], herRecentReplies: [], gender: 'male', mode: 'task', mentor: true });
    expect(r.ok).toBe(false);
  });

  it('a lesson must end with a task, or with a question when context is still needed', () => {
    const base = { herRecentReplies: [], gender: 'male' as const, mode: 'task' as const, mentor: true };
    expect(checkReply({ ...base, bubbles: ['500 subs pe fan funding, 1000 pe ads'], lesson: { hasTask: false } }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['500 subs pe fan funding', 'aaj 10 ideas likho'], lesson: { hasTask: true } }).ok).toBe(true);
    expect(checkReply({ ...base, bubbles: ['badhiya!', 'kis topic pe banana hai?'], lesson: { hasTask: false } }).ok).toBe(true);
  });

  it('one task at a time — no "aaj ka kaam" on every reply until they move on', () => {
    const base = { gender: 'male' as const, mode: 'task' as const, mentor: true, herRecentReplies: ['Aaj ka kaam: ek tracker banao — Company, Role, Date, Status'] };
    const scam = 'ek company 15000 registration fee maang rahi hai, de du?';
    // Seen: scam warning, then "Aaj ka kaam: fake calls block karo" stacked on top of yesterday's task.
    expect(checkReply({ ...base, userText: scam, bubbles: ['Mat dena, ye scam hai.', 'Aaj ka kaam: aisi calls block karo'], lesson: { hasTask: true } }).ok).toBe(false);
    expect(checkReply({ ...base, userText: scam, bubbles: ['Mat dena, ye scam hai.', 'Koi genuine company paise nahi leti.'], lesson: { hasTask: false } }).ok).toBe(true);
    expect(checkReply({ ...base, userText: 'ok next', bubbles: ['Ab resume.', 'Aaj ka kaam: resume ka ek project rewrite karo'], lesson: { hasTask: true } }).ok).toBe(true);
  });

  it('an English user gets English, even from a Hinglish mentor', () => {
    const r = checkReply({ bubbles: ['Arre badhiya! Portfolio ready bhi ho gaya.', 'Dikhao zara, link bhejo.'], herRecentReplies: [], gender: 'male', mode: 'chat', userText: 'made my portfolio page yesterday' });
    expect(r.problems.some((p) => p.includes('reply in English'))).toBe(true);
  });

  it('an answer to the mentor\'s question continues the lesson', () => {
    const text = 'cooking ka, hafte mein 5 ghante, sirf phone hai';
    const situations = classifySituations(text, 0.1);
    expect(isTeachingMoment(rajBansal, text, situations)).toBe(false);
    expect(isTeachingMoment(rajBansal, text, situations, 'kis topic pe banana chahte ho?')).toBe(true);
    expect(isTeachingMoment(rajBansal, 'hi', classifySituations('hi', 0.1), 'kaisa chal raha hai?')).toBe(false);
  });

  it('remembers a task even when the hidden line is missing', () => {
    expect(extractTaskTag('bahut badhiya\naaj ka kaam: apni agli reel ke liye ek hook line likh kar bhejo').task).toBe('apni agli reel ke liye ek hook line likh kar bhejo');
  });
});

