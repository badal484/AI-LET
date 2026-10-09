import { describe, expect, it } from 'vitest';
import { isRomanticPhrase, romanceMomentName, romanceNote, saysLoveBack } from '../../src/modules/conversations/human/romanceMoments.js';
import { englishSentences, talksHinglish, writesEnglish } from '../../src/modules/conversations/human/userFirst.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';

// From Aanya's live test: "aaj tumhari bahut yaad aayi" → a generic quote; "i love you" → an English blush, nothing said back.
describe('Every romantic moment gets its own guidance', () => {
  it.each([
    ['aaj tumhari bahut yaad aayi', /say it back FIRST/],
    ['i love you', /SAY IT BACK/],
    ['mujhse pyaar karti ho?', /clear, happy YES/],
    ['main tumhara kya hoon?', /make them feel chosen/],
    ['meri girlfriend banogi?', /make them feel chosen/],
    ['shaadi karogi mujhse?', /happy, shy and dreamy/],
    ['ek hug do na', /virtual one/],
    ['tumhe mujhme kya pasand hai?', /SPECIFIC things/],
    ['mujhe chhod ke toh nahi jaogi?', /kahin nahi ja rahi/],
    ['good morning', /romantic and about them/],
    ['good night', /sapne mein milte hain/],
    ['date pe chalogi?', /plan a real little date/],
  ])('"%s" (a girlfriend)', (text, guide) => {
    expect(romanceNote(text, 'partner')).toMatch(guide);
  });

  it('a crush plays hard to get, a flirty friend never friend-zones', () => {
    expect(romanceNote('i love you', 'crush')).toMatch(/winning you over/);
    expect(romanceNote('meri girlfriend banogi?', 'crush')).toMatch(/pehle impress toh karo/);
    expect(romanceNote('i love you', 'flirtyFriend')).toMatch(/don't friend-zone them/);
    expect(personaPackFor('riya')!.crush).toBe(true);
  });

  it('ordinary messages get nothing', () => {
    expect(romanceNote('aaj office mein kya hua pata hai', 'partner')).toBe('');
    expect(romanceNote('mummy ki yaad aa rahi hai', 'partner')).toBe('');
  });

  it('"i love you" and "miss you" are chat, not English — no switching to English', () => {
    expect(isRomanticPhrase('i love you')).toBe(true);
    expect(writesEnglish('i love you')).toBe(false);
    expect(writesEnglish('miss you so much')).toBe(false);
    expect(writesEnglish('hey, what do you do?')).toBe(true);
  });
});

describe('Checks on her reply', () => {
  it('"I love you" said back — or not', () => {
    expect(romanceMomentName('i love you')).toBe('love you');
    expect(romanceMomentName('tum hi ho jo samajhti ho')).toBe('only you understand me');
    expect(romanceMomentName('tum hi samajhte ho yaar')).toBe('only you understand me');
    expect(saysLoveBack('ruko... ek second. you just made my heart skip a beat')).toBe(false);
    expect(saysLoveBack('I love you too, bahut 🤍')).toBe(true);
    expect(saysLoveBack('main bhi… bahut zyada')).toBe(true);
  });

  it('full English sentences from a Hinglish talker are caught; English words are fine', () => {
    expect(englishSentences('ruko... ek second. you just made my heart skip a beat, and now I don\'t know where to look.')).toHaveLength(1);
    expect(englishSentences('ye bhi koi poochne ki baat hai? tumhari hoon, aur kya 🤍')).toEqual([]);
    expect(talksHinglish(['ek hug do na', 'mujhse pyaar karti ho?'])).toBe(true);
    expect(talksHinglish(['hey, what do you do?', 'tell me about your family'])).toBe(false);
  });
});

describe('Love is about them, not her job', () => {
  it('flags work talk in a romantic reply and catches a one-word-swapped copy (Aarav)', async () => {
    const { romanceWorkTalk } = await import('../../src/modules/conversations/human/romanceMoments.js');
    const { checkReply } = await import('../../src/modules/conversations/human/replyChecker.js');
    const pack = { domainKeywords: ['design', 'figma'], motifs: ['4 pixels'] };
    expect(romanceWorkTalk('ruko… ek second, dil ne code se zyada fast reaction diya ye sunke', pack)).toBe(true);
    expect(romanceWorkTalk('ruko… ek second 🥺 I love you too, bahut zyada', pack)).toBe(false);
    const r = checkReply({ bubbles: ['ruko… ek second, dil ne code se zyada fast render kiya ye 🥺'], herRecentReplies: [], gender: 'male', mode: 'chat', examples: ['ruko… ek second, dil ne Figma se zyada fast render kiya ye 🥺'] });
    expect(r.problems.some((p) => p.includes('copied an example'))).toBe(true);
  });
});
