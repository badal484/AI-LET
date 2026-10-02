import { describe, expect, it } from 'vitest';
import { hasDevanagari, romanizeDevanagari, unbracketAsides } from '../../src/modules/conversations/human/script.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';

/** From a real Aarohi chat: "ya bas paanch minute chupचाप baithna". */
describe('Hindi stays in Roman letters when they write that way', () => {
  it('spells Devanagari out the way people text', () => {
    expect(romanizeDevanagari('ya bas paanch minute chupचाप baithna')).toBe('ya bas paanch minute chupchaap baithna');
    expect(romanizeDevanagari('मैं ठीक हूँ')).toBe('main theek hoon');
    expect(romanizeDevanagari('कमाल')).toBe('kamaal');
    expect(romanizeDevanagari('ज़िंदगी')).toBe('zindgi');
  });

  it('the editor asks for a rewrite when a reply slips into Devanagari', () => {
    expect(hasDevanagari('chupचाप')).toBe(true);
    const base = { herRecentReplies: [], gender: 'female' as const, mode: 'casual' as const, romanOnly: true };
    expect(checkReply({ ...base, bubbles: ['bas paanch minute chupचाप baithna'] }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['bas paanch minute chupchaap baithna'] }).ok).toBe(true);
  });
});

/** From a real Dev chat: "…aur patch maange (PR baad mein karenge)". */
describe('No side notes in brackets', () => {
  it('turns a bracketed aside into part of the sentence', () => {
    expect(unbracketAsides('ek explanation aur patch maange (PR baad mein karenge)')).toBe('ek explanation aur patch maange — PR baad mein karenge');
    expect(unbracketAsides('Tele-MANAS 14416 (free, 24x7) pe call karo')).toBe('Tele-MANAS 14416 — free, 24x7 — pe call karo');
    expect(unbracketAsides("'Iktara' (Wake Up Sid) — ghar jaisa")).toBe("'Iktara' — Wake Up Sid — ghar jaisa");
  });

  it('leaves code alone', () => {
    for (const code of ['print("hi") likho', 'fix(bug) commit karo', 'use arr.map((x) => x * 2)', 'config (settings.json) mein jao']) {
      expect(unbracketAsides(code)).toBe(code);
    }
  });
});

