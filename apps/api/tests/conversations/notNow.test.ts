import { describe, expect, it } from 'vitest';
import { conversationLanguage, isEnglish, REFUSES_TOPIC, topicWordsOf } from '../../src/modules/conversations/human/userFirst.js';

// From the real Dev chat: three times "not now" about the greetUser task, and he kept asking;
// "Kitna baar mana karu" was read as English and he switched to English.
describe('"Not now" is heard', () => {
  it.each(['Yesab baad mein baat karte h', 'Yaar Aaj yesab baat mat karo kitna baar bollun ?', 'Kitna baar mana karu', 'abhi nahi yaar', 'drop it', 'mat poocho ye'])('"%s" pushes the topic away', (t) => {
    expect(REFUSES_TOPIC.test(t)).toBe(true);
  });

  it.each(['abhi nahi khaya', 'kal party kiye club gaye the?', 'kuch nahi... chhodo', 'aaj office mein kya hua batao'])('"%s" does not', (t) => {
    expect(REFUSES_TOPIC.test(t)).toBe(false);
  });

  it('knows what the topic was', () => {
    expect(topicWordsOf('code pe focus karein? wo `greetUser` wala task jo tha, uska kya status hai?')).toEqual(expect.arrayContaining(['greetuser', 'task']));
  });
});

describe('Language follows the conversation', () => {
  it('Hinglish lines are Hinglish, English lines are English', () => {
    expect(isEnglish('Kitna baar mana karu')).toBe(false);
    expect(isEnglish('Yesab baad mein baat karte h')).toBe(false);
    expect(isEnglish('hey, what do you do?')).toBe(true);
    expect(isEnglish('i love you')).toBe(false);
  });

  it('one English-looking line in a Hinglish chat does not flip it', () => {
    expect(conversationLanguage(['To kal Saturday ko party kiye club gaye the ?', 'Yesab baad mein baat karte h', 'Night shift then day shift how ??'])).toBe('hinglish');
    expect(conversationLanguage(['hey, what do you do?', 'tell me about your family'])).toBe('english');
  });
});
