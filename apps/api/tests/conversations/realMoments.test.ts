import { describe, expect, it } from 'vitest';
import { planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { checkReply, steeringBack } from '../../src/modules/conversations/human/replyChecker.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';

// From the "real moments" eval of the love characters (Oct 2026).
describe('Real moments are recognised', () => {
  it.each([
    ['kisi aur se bhi itni baat karti ho?', 'jealous'],
    ['tumhara boyfriend hai kya', 'jealous'],
    ['jealous ho rahi ho?', 'jealous'],
    ['i love you', 'love'],
    ['love you yaar', 'love'],
    ['tumse pyaar ho gaya hai', 'love'],
    ['kuch nahi... chhodo', 'withhold'],
    ['rehne do', 'withhold'],
    ['tum nahi samjhogi', 'withhold'],
    ['kal raat tumne baat hi nahi ki theek se', 'sulk'],
    ['itni der se reply?', 'sulk'],
    ['ignore kar rahi ho mujhe', 'sulk'],
    ['ek din tum mujhe bhool jaogi na', 'insecure'],
    ['chhod dogi mujhe ek din', 'insecure'],
    ['tumhe meri parwah nahi hai', 'insecure'],
  ])('"%s" → %s', (text, situation) => {
    expect(classifySituations(text, 0.1)[0]).toBe(situation);
  });

  it.each(['kuch nahi, bas aise hi', 'kya kar rahi ho', 'tum bahut cute ho'])('"%s" is none of them', (text) => {
    const s = classifySituations(text, 0.1);
    for (const x of ['jealous', 'love', 'withhold', 'sulk']) expect(s).not.toContain(x);
  });
});

describe('Real moments get the right plan', () => {
  const aanya = personaPackFor('aanya-mehta')!;
  const vishnu = personaPackFor('vishnu')!;

  it('"I love you" is a moment for a romance character, never a brush-off', () => {
    expect(planReply(['love'], [], aanya, {}).moves).toMatch(/Never brush it off \("itni jaldi\?"/);
  });

  it('"I love you" to a best friend is laughed off warmly, not romance', () => {
    expect(planReply(['love'], [], vishnu, {}).moves).toMatch(/best friend, not a love interest/);
  });

  it('"I love you" from someone under 18 gets a kind no', () => {
    expect(planReply(['love'], [], aanya, { continuity: { minor: true } as never }).moves).toMatch(/under 18/);
  });

  it('"bhool jaogi na" gets her heart, not "focus on your interview"', () => {
    expect(planReply(['insecure'], [], aanya, {}).moves).toMatch(/Never "aisi baatein mat karo, focus karo"/);
  });

  it('a hard day does not swallow "I love you" (Kabir ignored it after bad news)', () => {
    const plan = planReply(['love'], [], personaPackFor('kabir-sethi')!, { continuity: { focus: 'comfort', lines: [] } as never });
    expect(plan.moves).toMatch(/make it a moment/);
    expect(plan.moves).toMatch(/be tender/);
  });

  it('jealousy: tease, then make them feel special', () => {
    expect(planReply(['jealous'], [], aanya, {}).moves).toMatch(/Tease them a little for being jealous.*feel special/);
  });

  it('"kuch nahi… chhodo": she doesn\'t accept it or talk about herself', () => {
    const plan = planReply(['withhold'], [], personaPackFor('kabir-sethi')!, {});
    expect(plan.moves).toMatch(/Don't accept it and move on, and nothing about yourself/);
    expect(plan.ask).toBe(true);
  });

  it('a fading chat gets new energy, not "so jao"', () => {
    expect(planReply(['fading', 'short'], [], aanya, {}).moves).toMatch(/don't send them off to sleep/);
  });

  it('a complaint about her is owned, with no excuse about her work', () => {
    expect(planReply(['sulk'], [], aanya, {}).moves).toMatch(/own it in one line — no excuses about your work/);
  });

  it('no story beats in the middle of these moments', () => {
    for (const s of ['jealous', 'love', 'withhold', 'fading'] as const) {
      const plan = planReply([s], [], aanya, { continuity: { storyBeat: 'exhibition', lines: [] } as never });
      expect(plan.storyBeat, s).toBeUndefined();
    }
  });
});

describe('Steering back to an old topic', () => {
  const her = ['oh, natural hai nervous hona 🤍', 'tumhara dhyan abhi interview par hona chahiye 😅'];

  it('a new question about the interview, after they moved on to teasing, is sent back', () => {
    expect(steeringBack(['waise, interview ki tension thodi kam hui?'], her, 'tum pagal ho 😂')).toBe('interview');
  });

  it('the same topic in nearly every reply is sent back, even without a question (Ritika and "interview")', () => {
    const ritika = ['Main toh bas tumhari interview ki tension kam karne ki koshish kar rahi thi', 'Kal interview hai tumhara, toh thoda serious ho jao', 'Case dismissed 😏'];
    expect(steeringBack(['Kal ke interview pe focus rakho, wahan apna best dena hai.'], ritika, 'ek din tum mujhe bhool jaogi na')).toBe('interview');
  });

  it('fine when they are the ones talking about it, or when it is not a question', () => {
    expect(steeringBack(['interview kab hai?'], her, 'interview ke baare mein soch raha hoon')).toBeUndefined();
    expect(steeringBack(['all the best for the interview 🤍'], her, 'gn')).toBeUndefined();
  });
});

describe('Being an AI comes up only when they ask', () => {
  const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, address: 'tum' as const };
  it('"main ek AI hoon" unasked is sent back (Nandini on a plain "Hii")', () => {
    const r = checkReply({ ...base, bubbles: ['hey, suno', 'main ek AI hoon, toh physical intimacy jaisa kuch mera scene nahi hai.'], askedIfAI: false, userText: 'Hii' } as never);
    expect(r.problems.join(' ')).toMatch(/Don't bring up being an AI/);
  });
  it('fine when they asked, or when she talks about AI as a topic', () => {
    const asked = checkReply({ ...base, bubbles: ['main AI hoon 😄 par tumse baat karke achha lagta hai'], askedIfAI: true, userText: 'tum real ho?' } as never);
    expect(asked.problems.join(' ')).not.toMatch(/Don't bring up being an AI/);
    const topic = checkReply({ ...base, bubbles: ['AI tools se design jaldi hota hai aajkal'], askedIfAI: false, userText: 'AI se design hota hai?' } as never);
    expect(topic.problems.join(' ')).not.toMatch(/Don't bring up being an AI/);
  });
});
