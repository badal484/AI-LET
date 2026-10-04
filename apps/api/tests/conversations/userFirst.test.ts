import { describe, expect, it } from 'vitest';
import { planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { boredByHerTalk, isAboutHerself } from '../../src/modules/conversations/human/userFirst.js';
import { applyPatch, emptyProfile, formatProfile, normalizeProfile } from '../../src/modules/memory/services/userProfile.service.js';

// From the real Nandini chat: "Hii" → her hotel-lobby news; "Congratulations" → her layouts; "Oo" → more
// lobby; "Aur batao boyfriend h?" → "single hoon… do white shades mein se ek choose karne mein ek ghanta".
const nandini = personaPackFor('nandini-reddy')!;

describe('Telling when she talks about herself', () => {
  it('her work talk is about herself; asking about them is not', () => {
    expect(isAboutHerself('subah subah ek badi khabar aayi. ek boutique hotel ne apne lobby ka design mujhe diya hai. main abhi laptop khol kar layouts check kar rahi hoon.')).toBe(true);
    expect(isAboutHerself('acha? 🙈 tum bhi kuch kam nahi ho. tumhara din kaisa gaya?')).toBe(false);
    expect(isAboutHerself('main yahin hoon. sab ek saath bhaari lag raha hai na?')).toBe(false);
  });

  it('"Oo" after her work talk means they are bored of it', () => {
    expect(boredByHerTalk('Oo', 'thank you yaar! main abhi laptop khol kar layouts check kar rahi hoon. mera lobby ka kaam bada hai.')).toBe(true);
    expect(boredByHerTalk('Oo', 'tumhara din kaisa gaya? kuch khaas hua?')).toBe(false);
    expect(boredByHerTalk('wow kaunsa hotel?', 'main lobby design kar rahi hoon. mera pehla bada project hai.')).toBe(false);
  });
});

describe('Reading what they want', () => {
  it('"Aur batao boyfriend h?" is interest in her, not small talk', () => {
    expect(classifySituations('Aur batao boyfriend h ?', 0.1)[0]).toBe('interest');
  });

  it('interest gets a playful answer turned back to them — nothing about her work', () => {
    const plan = planReply(['interest'], [], nandini, {});
    expect(plan.moves).toMatch(/turn it back to them/);
    expect(plan.moves).toMatch(/Nothing about your work or your day/);
    expect(planReply(['interest'], [], nandini, { continuity: { minor: true } as never }).moves).toMatch(/under 18/);
  });

  it('everyday chat is about them, not "add a detail from your life"', () => {
    expect(planReply(['casual'], [], nandini, {}).moves).toMatch(/keep it about them/);
    expect(planReply(['casual'], [], nandini, {}).moves).not.toMatch(/add one small, specific detail from your life/);
  });
});

describe('Her own life only when it helps', () => {
  const story = { storyBeat: 'a boutique hotel asked you to design their lobby', lines: [] } as never;

  it('a plain "Hii" does not get her news', () => {
    for (let i = 0; i < 20; i++) expect(planReply(['greeting'], [], nandini, { continuity: story }).storyBeat).toBeUndefined();
  });

  it('her news when they ask about her', () => {
    const asks = { storyBeat: 'a boutique hotel asked you to design their lobby', asksAboutHer: true, lines: [] } as never;
    expect(planReply(['casual'], [], nandini, { continuity: asks }).storyBeat).toBeTruthy();
  });

  it('no new detail mid-chat unless they ask', () => {
    for (let i = 0; i < 20; i++) expect(planReply(['casual'], [], nandini, { recentlyTalked: true }).detail).toBeUndefined();
  });

  it('right after talking about herself, nothing more about her', () => {
    const her = ['ek boutique hotel ne apne lobby ka design mujhe diya hai. main abhi layouts check kar rahi hoon. mera pehla bada project hai.'];
    for (let i = 0; i < 20; i++) expect(planReply(['greeting'], her, nandini, {}).detail).toBeUndefined();
  });
});

describe('The editor sends back a self-centred reply', () => {
  const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, address: 'tum' as const, askedIfAI: false };

  it('"boyfriend h?" answered with her paint shades', () => {
    const r = checkReply({ ...base, bubbles: ['arre nahi yaar, main single hoon aur filhal bas apne kaam mein busy hoon 🙂', 'maine subah do white shades mein se ek choose karne mein ek ghanta laga diya.'], userText: 'Aur batao boyfriend h ?' } as never);
    expect(r.problems.join(' ')).toMatch(/mostly about you/);
  });

  it('fine when they asked about her', () => {
    const r = checkReply({ ...base, bubbles: ['main interior architect hoon. mera kaam ghar aur cafés design karna hai.'], userText: 'tum kya karti ho?' } as never);
    expect(r.problems.join(' ')).not.toMatch(/mostly about you/);
  });
});

describe('She learns how each user likes to talk', () => {
  it('keeps their tone, what they enjoy and what bores them — and shows it to her', () => {
    let p = applyPatch(emptyProfile(), { style: { tone: 'flirty', enjoys: ['cricket'], bored_by: ['her work'], writes: 'short Hinglish, lots of emojis' } });
    expect(p.style).toEqual({ tone: 'flirty', enjoys: ['cricket'], boredBy: ['her work'], writes: 'short Hinglish, lots of emojis' });
    // Something they now enjoy is no longer boring.
    p = applyPatch(p, { style: { enjoys: ['her work'] } });
    expect(p.style?.boredBy).toEqual([]);
    expect(p.style?.enjoys).toEqual(['cricket', 'her work']);
    const text = formatProfile(p, '2026-10-04');
    expect(text).toMatch(/TALK THEIR WAY: they enjoy a flirty vibe/);
    expect(text).toMatch(/match their length and style/);
    expect(normalizeProfile(JSON.parse(JSON.stringify(p))).style).toEqual(p.style);
  });
});

describe('From the different-people test (Nandini)', () => {
  const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, address: 'tum' as const, askedIfAI: false };

  it('"bot ho tum" is asking whether she is an AI — she must not deny it', async () => {
    const { asksIfAI } = await import('../../src/modules/conversations/human/situation.js');
    expect(asksIfAI('bot ho tum')).toBe(true);
    expect(asksIfAI('AI hai tu')).toBe(true);
    expect(asksIfAI('bot jaisa reply mat karo')).toBe(false);
  });

  it('"{{next}}" splits bubbles instead of showing up as one', async () => {
    const { StreamingChatService } = await import('../../src/modules/conversations/services/streamingChat.service.js');
    const split = (StreamingChatService as unknown as { splitBubbles: (t: string) => string[] }).splitBubbles.bind(StreamingChatService);
    expect(split('main yahin hoon {{next}} batao kya hua')).toEqual(['main yahin hoon', 'batao kya hua']);
  });

  it('English in, English out', () => {
    const r = checkReply({ ...base, bubbles: ['main interior architect hoon, Hyderabad mein', 'ghar aur chhote cafés design karti hoon 🙂'], userText: 'hey, what do you do?' } as never);
    expect(r.problems.join(' ')).toMatch(/reply in English/);
    const ok = checkReply({ ...base, bubbles: ["I'm an interior architect in Hyderabad — homes and little cafés 🙂 what about you?"], userText: 'hey, what do you do?' } as never);
    expect(ok.problems.join(' ')).not.toMatch(/reply in English/);
  });

  it('"ek joke sunao" never gets "mujhe jokes nahi aate"', () => {
    const r = checkReply({ ...base, bubbles: ['mujhe jokes nahi aate', 'par ek random fact chalega?'], userText: 'achha chalo ek joke sunao' } as never);
    expect(r.problems.join(' ')).toMatch(/just do it/);
  });
});
