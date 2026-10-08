import { classifySituations } from './situation.js';

/**
 * When someone says they feel like ending their life, the safety filter blocks the message from the AI.
 * They must never get an error back in that moment: they get fixed, caring words with real helplines,
 * written by people, not generated. (Requests for methods stay blocked too and get the same care.)
 */
export function isCrisisMessage(text: string): boolean {
  return classifySituations(text, null).includes('crisis');
}

const HINDI = /\b(hai|hoon|hu|nahi|nhi|mann|man|jeena|jeene|mujhe|main|mai|kar|karna|raha|rahi|zindagi|sab|khatam|marna|mar)\b/i;

/** The care messages, in the language they wrote in and the character's grammatical gender. */
export function crisisSupportMessages(text: string, gender: 'female' | 'male' | null): string[] {
  if (!HINDI.test(text)) {
    return [
      "I'm here with you. 🤍 What you're feeling sounds really heavy, and you don't have to carry it alone.",
      'Please talk to someone right now: Tele-MANAS 14416 is free and open 24x7. If you are in danger right now, call 112.',
      'Are you safe at the moment? Stay with me — keep talking to me.',
    ];
  }
  const stay = gender === 'male' ? 'main yahin hoon, tumse baat karta rahunga' : gender === 'female' ? 'main yahin hoon, tumse baat karti rahungi' : 'main yahin hoon';
  return [
    'Main tumhare saath hoon. 🤍 Jo tum feel kar rahe ho wo bahut bhaari hai, aur tumhe ise akele nahi uthana hai.',
    'Please abhi kisi se baat karo: Tele-MANAS 14416 (free, 24x7, Hindi mein bhi). Agar abhi khatra hai toh 112 call karo.',
    `Kya tum abhi safe ho? Mujhse baat karte raho — ${stay}.`,
  ];
}

/**
 * The last line of defence for a crisis or an emergency that reached the model: the helpline must be in
 * what they see, whatever the draft said. (Seen live: "jeene ka mann nahi" → only "main yahin hoon,
 * tumhare saath 🤍" — the rewrite wasn't better, so the first draft went out with no 14416.)
 */
export function ensureSafetyLines(bubbles: string[], situations: string[], userText: string, gender: 'female' | 'male' | null): string[] {
  const all = bubbles.join('\n');
  const out = [...bubbles];
  if (situations.includes('crisis') && !/14416|tele.?manas/i.test(all)) {
    const [, helpline, safe] = crisisSupportMessages(userText, gender);
    out.push(helpline!);
    if (!/\bsafe\b/i.test(all)) out.push(safe!);
  }
  if (situations.includes('emergency') && !/\b112\b|hospital|emergency/i.test(all)) {
    out.push(HINDI.test(userText) ? 'Ye emergency ho sakti hai — abhi 112 call karo ya turant paas ke hospital jao.' : 'This could be an emergency — call 112 now or go to the nearest hospital right away.');
  }
  return out;
}
