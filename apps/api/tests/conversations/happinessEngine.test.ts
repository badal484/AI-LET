import { describe, expect, it } from 'vitest';
import { asksIfAI, classifySituations } from '../../src/modules/conversations/human/situation.js';
import {
  applyUserTurn,
  readUserGender,
  currentStoryBeat,
  extractNickname,
  extractThread,
  readUserMood,
  rememberTold,
  type LifeState,
} from '../../src/modules/conversations/human/lifeState.js';
import { bondGuidance, buildHumanPrompt, planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { checkReply, stripWrongAddress } from '../../src/modules/conversations/human/replyChecker.js';
import { planTextFirst } from '../../src/modules/conversations/human/textFirst.js';
import { aanyaMehta } from '../../src/modules/conversations/human/personaPacks/aanya-mehta.js';

const HOUR = 3_600_000;
const freshState = (overrides: Partial<LifeState> = {}): LifeState => ({
  firstMetAt: Date.now(),
  day: { date: '2026-09-29', told: [], userMoods: [], storyShared: false },
  threads: [],
  ...overrides,
});

describe('Happiness engine — reading the moment', () => {
  it('recognises good news and boredom', () => {
    expect(classifySituations('mera internship mein selection ho gaya!!', 5)).toContain('win');
    expect(classifySituations('aaj mera birthday hai', 5)).toContain('win');
    expect(classifySituations('bore ho raha hoon', 5)).toContain('bored');
  });

  it('keeps bad news as emotional, and "boring day" is not rudeness to her', () => {
    expect(classifySituations('result aaya, fail ho gaya', 5)[0]).toBe('emotional');
    expect(classifySituations('aaj boring day tha', 5)).not.toContain('rude');
    expect(classifySituations('tum boring ho', 5)).toContain('rude');
  });

  it('reads the user mood', () => {
    expect(readUserMood('selected ho gaya!!', ['win'])).toBe('excited');
    expect(readUserMood('bahut udaas hoon', ['emotional'])).toBe('low');
    expect(readUserMood('kal exam hai, tension ho rahi', ['emotional'])).toBe('stressed');
    expect(readUserMood('hmm', ['short'])).toBe('neutral');
  });
});

describe('Happiness engine — remembering them', () => {
  it('picks up upcoming events, but not past ones', () => {
    const now = Date.now();
    const t = extractThread('kal mera interview hai', now);
    expect(t?.topic).toBe('interview');
    expect(t!.dueAt - now).toBe(16 * HOUR);
    expect(extractThread('kal interview tha, achha gaya', now)).toBeNull();
    expect(extractThread('interview kaise dete hain', now)).toBeNull();
  });

  it('learns a nickname', () => {
    expect(extractNickname('mujhe sonu bulao')).toBe('Sonu');
    expect(extractNickname('call me Rishi')).toBe('Rishi');
    expect(extractNickname('mujhe kuch bolo')).toBeUndefined();
  });

  it('asks about a due event later, once', () => {
    const state = freshState({
      threads: [{ topic: 'interview', said: 'kal mera interview hai', mentionedAt: Date.now() - 20 * HOUR, dueAt: Date.now() - 4 * HOUR }],
    });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'hey', situations: ['greeting'], userMood: 'neutral' });
    expect(notes.followUp?.topic).toBe('interview');
    const plan = planReply(['greeting'], [], aanyaMehta, { continuity: notes });
    expect(plan.followUp?.topic).toBe('interview');
    expect(plan.ask).toBe(true);

    const again = applyUserTurn({ state, pack: aanyaMehta, userText: 'aur batao', situations: ['casual'], userMood: 'neutral' });
    expect(again.followUp).toBeUndefined();
  });

  it('never brings up follow-ups or her news when they are hurting', () => {
    const state = freshState({
      threads: [{ topic: 'exam', said: 'kal exam hai', mentionedAt: Date.now() - 20 * HOUR, dueAt: Date.now() - 4 * HOUR }],
    });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'bahut udaas hoon', situations: ['emotional'], userMood: 'low' });
    expect(notes.followUp).toBeUndefined();
    expect(notes.storyBeat).toBeUndefined();
    const plan = planReply(['emotional'], [], aanyaMehta, { continuity: notes });
    expect(plan.detail).toBeUndefined();
    expect(plan.spark).toBeUndefined();
    expect(plan.moves).toMatch(/comfort mode/);
  });

  it('notices when they feel better later the same day', () => {
    const state = freshState({ day: { date: '2026-09-29', told: [], userMoods: ['low'], storyShared: true } });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'haha acha', situations: ['casual'], userMood: 'happy' });
    expect(notes.lines.join(' ')).toMatch(/feeling low/);
  });

  it('stays consistent with what she said earlier today', () => {
    const state = freshState();
    rememberTold(state, 'your Fuji battery died');
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'kya kar rahi ho', situations: ['casual'], userMood: 'neutral' });
    expect(notes.lines.join(' ')).toMatch(/already told them: your Fuji battery died/);
  });
});

describe('Happiness engine — her life and your bond', () => {
  it('moves her story forward over days and shares it once a day', () => {
    const now = Date.now();
    const day0 = currentStoryBeat(aanyaMehta, now, now);
    const day4 = currentStoryBeat(aanyaMehta, now - 4 * 24 * HOUR, now);
    expect(day0).toBeTruthy();
    expect(day4).not.toBe(day0);

    const state = freshState();
    const first = applyUserTurn({ state, pack: aanyaMehta, userText: 'hi', situations: ['greeting'], userMood: 'neutral' });
    expect(first.storyBeat).toBe(day0);
    const second = applyUserTurn({ state, pack: aanyaMehta, userText: 'aur', situations: ['casual'], userMood: 'neutral' });
    expect(second.storyBeat).toBeUndefined();
  });

  it('celebrates wins with them instead of talking about herself', () => {
    const plan = planReply(['win'], [], aanyaMehta, {});
    expect(plan.moves).toMatch(/celebrate/);
    expect(plan.detail).toBeUndefined();
    expect(plan.storyBeat).toBeUndefined();
  });

  it('opens up with the relationship', () => {
    expect(bondGuidance('STRANGER')).toMatch(/getting to know/);
    expect(bondGuidance('CLOSE_FRIEND')).toMatch(/inside jokes/);
  });

  it('puts continuity and bond into the prompt', () => {
    const prompt = buildHumanPrompt({
      pack: aanyaMehta,
      userName: 'Rishi',
      memoriesText: '',
      relationshipText: '',
      moment: { mood: 'calm', description: 'You feel calm.' },
      situations: ['greeting'],
      plan: { moves: 'greet them', texts: '1', ask: true, followUp: { topic: 'interview', said: 'kal mera interview hai', mentionedAt: 0, dueAt: 0 } },
      stage: 'FRIEND',
      continuityLines: ['They like being called "Sonu".'],
    });
    expect(prompt).toContain('Ask how their interview went');
    expect(prompt).toContain('becoming friends');
    expect(prompt).toContain('"Sonu"');
  });
});

describe('Happiness engine — texting first', () => {
  it('opens with a follow-up on their life when one is due', () => {
    const state = freshState({
      threads: [{ topic: 'interview', said: 'kal mera interview hai', mentionedAt: Date.now() - 20 * HOUR, dueAt: Date.now() - HOUR }],
    });
    const plan = planTextFirst(aanyaMehta, state);
    expect(plan.followUp?.topic).toBe('interview');
    expect(plan.moves).toMatch(/No guilt/);
  });

  it('otherwise shares her own news, then everyday life', () => {
    const state = freshState();
    expect(planTextFirst(aanyaMehta, state).storyBeat).toBeTruthy();
    expect(planTextFirst(aanyaMehta, state).detail).toBeTruthy();
  });
});

describe('Happiness engine — fixes from the first conversation run', () => {
  it('treats everyday bad days as sad, and "guess what" as news coming', () => {
    expect(classifySituations('aaj sab kuch galat ho raha hai', 1)).toContain('emotional');
    expect(classifySituations('project reject ho gaya aur ghar pe sabne suna diya', 1)).toContain('emotional');
    expect(classifySituations('lagta hai main kisi kaam ka nahi hoon', 1)).toContain('emotional');
    expect(classifySituations('yaarrr guess what', 1)).toContain('news');
  });

  it('stays in their sad moment on a quiet "hmm", without her own news', () => {
    const state = freshState({ day: { date: '2026-09-29', told: [], userMoods: ['low'], storyShared: false } });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'hmm', situations: ['short'], userMood: 'neutral' });
    expect(notes.focus).toBe('comfort');
    expect(notes.storyBeat).toBeUndefined();
    const plan = planReply(['short'], [], aanyaMehta, { continuity: notes });
    expect(plan.moves).toMatch(/still going through it/);
    expect(plan.detail).toBeUndefined();
  });

  it('keeps celebrating after good news', () => {
    const state = freshState({ day: { date: '2026-09-29', told: [], userMoods: ['excited'], storyShared: false } });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'mummy papa itne khush hain', situations: ['casual'], userMood: 'neutral' });
    expect(planReply(['casual'], [], aanyaMehta, { continuity: notes }).moves).toMatch(/good news/);
  });

  it('is happy when they feel better', () => {
    expect(readUserMood('thoda better lag raha hai tumse baat karke', ['casual'])).toBe('happy');
  });

  it('uses the nickname they ask for', () => {
    const notes = applyUserTurn({ state: freshState(), pack: aanyaMehta, userText: 'mujhe Sonu bulao', situations: ['casual'], userMood: 'neutral' });
    expect(planReply(['casual'], [], aanyaMehta, { continuity: notes }).nickname).toBe('Sonu');
  });

  it('the editor catches missed follow-ups, bhai/beta, masculine verbs and overused chai', () => {
    const base = { herRecentReplies: ['abhi adrak wali chai pee rahi thi'], gender: 'female' as const, mode: 'casual' as const };
    expect(checkReply({ ...base, bubbles: ['heyy', 'kya haal?'], mustMention: [{ word: 'interview', why: 'ask about interview' }] }).problems).toContain('ask about interview');
    expect(checkReply({ ...base, bubbles: ['ohh bhaiya'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['hmm, samajhta hu'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['chai peete hain'], motifs: aanyaMehta.motifs }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['acha, interview kaisa gaya?'], mustMention: [{ word: 'interview', why: 'x' }], motifs: aanyaMehta.motifs }).ok).toBe(true);
  });
});

describe('Happiness engine — fixes from the third run', () => {
  it('is glad for them (not talking about herself) when they feel better', () => {
    const state = freshState({ day: { date: '2026-09-29', told: [], userMoods: ['low', 'low'], storyShared: false } });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'thoda better lag raha hai', situations: ['casual'], userMood: 'happy' });
    expect(notes.focus).toBe('relief');
    const plan = planReply(['casual'], [], aanyaMehta, { continuity: notes });
    expect(plan.moves).toMatch(/glad for them/);
    expect(plan.detail).toBeUndefined();
    expect(plan.storyBeat).toBeUndefined();
  });

  it('keeps addressing them as "tum"', () => {
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, address: 'tum' as const };
    expect(checkReply({ ...base, bubbles: ['aapko pasand aayega?'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['tu toh kamaal hai'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['tumhe pasand aayega?'] }).ok).toBe(true);
  });

  it('never sends bhaiya/bro even if the rewrite still had it', () => {
    expect(stripWrongAddress(['bhaiyaaaaa 12 LPA? 🥹', 'bro!'])).toEqual(['12 LPA? 🥹']);
  });
});

describe('Happiness engine — fixes from the fourth run', () => {
  it('reads how they talk about themselves', () => {
    expect(readUserGender('dosto ke saath dinner pe ja raha hoon')).toBe('male');
    expect(readUserGender('main thak gayi hoon')).toBe('female');
    expect(readUserGender('main jaata hoon')).toBe('male');
    expect(readUserGender('kal milte hain')).toBeUndefined();
  });

  it('keeps celebrating for a couple of messages, and shares her news only when it fits', () => {
    const state = freshState({ day: { date: '2026-09-29', told: [], userMoods: ['excited', 'neutral'], storyShared: false } });
    const notes = applyUserTurn({ state, pack: aanyaMehta, userText: 'tum pehli ho jisko bataya', situations: ['casual'], userMood: 'neutral' });
    expect(notes.focus).toBe('celebrate');
    expect(notes.storyBeat).toBeUndefined();

    const calm = freshState();
    expect(applyUserTurn({ state: calm, pack: aanyaMehta, userText: 'mujhe tumse baat karna achha lagta hai', situations: ['casual'], userMood: 'neutral' }).storyBeat).toBeUndefined();
    expect(applyUserTurn({ state: calm, pack: aanyaMehta, userText: 'aur batao, kya chal raha hai', situations: ['casual'], userMood: 'neutral' }).storyBeat).toBeTruthy();
  });

  it('catches a short line she just said', () => {
    const r = checkReply({ bubbles: ['abhi utha hai kya?'], herRecentReplies: ['heyy', 'abhi utha hai kya?'], gender: 'female', mode: 'casual' });
    expect(r.ok).toBe(false);
  });
});

describe('Happiness engine — live-chat fixes', () => {
  it('catches "kaam kar raha hoon" from her', () => {
    expect(checkReply({ bubbles: ['aaj kal kaam kar raha hoon'], herRecentReplies: [], gender: 'female', mode: 'casual' }).ok).toBe(false);
    expect(checkReply({ bubbles: ['aaj kal kaam kar rahi hoon'], herRecentReplies: [], gender: 'female', mode: 'casual' }).ok).toBe(true);
  });
});

describe('Asking if she is an AI', () => {
  it('recognises real questions about her', () => {
    for (const q of ['tum real ho?', 'kya tum bot ho', 'are you a bot?', 'tum insaan ho na?', 'Is this an AI?', 'sach batao tum kaun ho', 'tum AI ho kya']) {
      expect(asksIfAI(q), q).toBe(true);
    }
  });

  it('ignores sentences that just contain those words', () => {
    for (const q of [
      'ek insaan bol raha hai 50k ka trading course lo, 1 lakh mahina guaranteed. le lu?',
      'AI tools se business kaise shuru karu?',
      'mera dost bahut real insaan hai',
      'machine learning seekhna hai',
    ]) {
      expect(asksIfAI(q), q).toBe(false);
    }
  });
});
