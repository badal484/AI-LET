import { describe, expect, it } from 'vitest';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { extractTaskTag, isTeachingMoment, mentorPromptSection, promisesIncome } from '../../src/modules/conversations/human/mentor.js';
import { applyUserTurn, rememberTask, type LifeState } from '../../src/modules/conversations/human/lifeState.js';
import { buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { checkReply, fixTuForms } from '../../src/modules/conversations/human/replyChecker.js';
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


describe('Greetings', () => {
  it('"hii" is not "how are you"', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'chat' as const };
    expect(checkReply({ ...base, userText: 'hii', bubbles: ['Main bhi theek hoon, bas abhi clinic se aayi 🌿'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, userText: 'hey', bubbles: ['Hey Rohit!', 'Sab theek-thaak idhar bhi.'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, userText: 'hi', bubbles: ['theek hoon main bhi, bas notes check kar rahi thi'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, gender: 'male' as const, userText: 'ram ram bhai', bubbles: ['Ram Ram ji 😄 Sab badhiya. Tum batao?'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, userText: 'hi, aaj promotion mil gaya!', bubbles: ['badhiya!! party kab?'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(false);
    expect(checkReply({ ...base, userText: 'hii riya', bubbles: ['hey! sab theek-thaak'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, userText: 'hi', bubbles: ['main toh theek hoon, bas aaj ka din achha gaya'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
    expect(checkReply({ ...base, userText: 'hii kaise ho?', bubbles: ['main bhi theek hoon, tum batao'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(false);
  });
});

describe('Comfort', () => {
  const base = { herRecentReplies: [], gender: 'male' as const, mode: 'chat' as const };
  it('a hurting user gets someone who stays, not a one-line comment or a brush-off', () => {
    expect(checkReply({ ...base, situations: ['emotional'], userText: 'aaj office mein boss ne sabke saamne daanta', bubbles: ['woh sabse ganda lagta hai jab koi aisi harkat kare yaar'] }).ok).toBe(false);
    expect(checkReply({ ...base, userText: 'tum hi samajhte ho yaar', bubbles: ['thoda paani piyo aur chupchaap baitho, baaki sab chodo abhi'] }).ok).toBe(false);
    expect(checkReply({ ...base, situations: ['emotional'], userText: 'aaj office mein boss ne sabke saamne daanta', bubbles: ['ugh, sabke saamne wala sabse bura hota hai', 'kya bola usne exactly? main yahin hoon'] }).ok).toBe(true);
  });
});

describe('Doing what they asked, now', () => {
  const base = { gender: 'female' as const, mode: 'chat' as const };
  it('"kya karu?" after her question gets a step, not another question (Aarohi)', () => {
    const asked = ['Pehle ye batao ki abhi tumhare din kaise nikal rahe hain?'];
    expect(checkReply({ ...base, herRecentReplies: asked, userText: 'aaj hi sab theek karna hai, kya karu?', bubbles: ['Ek din mein sab nahi badlega.', 'Pehle batao, mood aur energy kaisa raha?'] }).ok).toBe(false);
    expect(checkReply({ ...base, herRecentReplies: asked, userText: 'aaj hi sab theek karna hai, kya karu?', bubbles: ['Ek din mein sab nahi badlega.', 'Aaj bas itna: raat 11 baje phone kitchen mein rakh do.'] }).problems.some((p) => p.includes('They asked what to do'))).toBe(false);
  });
  it('"trip plan karein?" is started, not put off (Ishita)', () => {
    const r = checkReply({ ...base, herRecentReplies: [], userText: 'ek trip plan karein saath mein?', bubbles: ['trip? waah 🤭', 'December mein jab milenge, tabhi decide karenge na pehle kahan jaana hai'] });
    expect(r.problems.some((p) => p.includes("don't put it off"))).toBe(true);
  });
});

describe('Small slips from the full test', () => {
  const base = { herRecentReplies: [], gender: 'female' as const, mode: 'chat' as const };
  it('"tu" possessives become "tum" ones in place (Dev: "interpreter tera print padhta hai")', () => {
    expect(fixTuForms(['interpreter tera print padhke output deta hai', 'Teri to line sahi hai'])).toEqual(['interpreter tumhara print padhke output deta hai', 'Tumhari to line sahi hai']);
    expect(fixTuForms(['terapy nahi, tere liye'])).toEqual(['terapy nahi, tumhare liye']);
  });
  it('a "tum" character never says "sochiye" (Priya)', () => {
    expect(checkReply({ ...base, address: 'tum' as const, bubbles: ['aur sochiye zara, aunty ne poocha'] }).ok).toBe(false);
    expect(checkReply({ ...base, address: 'tum' as const, bubbles: ['ek charger chahiye tha, uske liye gayi'] }).problems.some((p) => p.includes('Always call them'))).toBe(false);
  });
  it('a reply never ends on a teaser it does not finish (Aanya)', () => {
    expect(checkReply({ ...base, bubbles: ['i love you too, rohit 🤍 aur pata hai, sabse achi baat kya hai?'] }).problems.some((p) => p.includes('teaser'))).toBe(true);
    expect(checkReply({ ...base, bubbles: ['pata hai, sabse achi baat? tum hamesha sach bolte ho 🤍'] }).problems.some((p) => p.includes('teaser'))).toBe(false);
  });
});

describe('Real help, not only reassurance', () => {
  const base = { herRecentReplies: [], gender: 'female' as const, mode: 'chat' as const };
  it('"kal exam hai, kuch nahi padha" needs more than "sab manage ho jayega" (Priya)', () => {
    expect(checkReply({ ...base, userText: 'kal exam hai, kuch nahi padha', bubbles: ['Oh no, exam ki tension?', 'Thoda relax karo, ek baar deep breath lo, sab manage ho jayega.'] }).problems.some((p) => p.includes('Only reassurance'))).toBe(true);
    expect(checkReply({ ...base, userText: 'hi', bubbles: ['Hi! Ekdum mast.'] }).problems.some((p) => p.includes("didn't ask how you are"))).toBe(true);
  });
});
