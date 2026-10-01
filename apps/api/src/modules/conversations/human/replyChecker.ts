import { promisesIncome, unsafeHealthAdvice } from './mentor.js';

/**
 * Step 6 — check the draft like an editor would, before anyone sees it. Returns what's wrong so the
 * engine can regenerate once with specific feedback (or fix it in code).
 */
const BOT_PHRASES: RegExp[] = [
  /i understand how you feel/i,
  /as an ai (language )?model/i,
  /i'?m here to (help|assist)/i,
  /how can i (help|assist)/i,
  /(main )?aapki (kya )?madad kar sakti/i,
  /feel free to/i,
  /is there anything else/i,
  /i hope this helps/i,
  /main samajh sakti hoon ki aap/i,
];
// "samajhta hu", "karta hoon" — first-person verb forms carry gender even without "main".
// "jaunga", "khaunga" (I will…) are first-person on their own too.
const MASCULINE_VERB = /\b\w{2,}(ta|ga)\s+(hoon|hu|hun)\b|\b(raha|gaya|tha)\s+(hoon|hu|hun)\b|\b\w{1,}unga\b/i;
const FEMININE_VERB = /\b\w{2,}(ti|gi)\s+(hoon|hu|hun)\b|\b(rahi|gayi|thi)\s+(hoon|hu|hun)\b|\b\w{1,}ungi\b/i;
const WRONG_ADDRESS = /\b(bhai+|bh?ai+y+a+|bro+|beta|dude)\b/i;
const OTHER_ADDRESS: Record<'tum' | 'aap' | 'tu', RegExp> = {
  tum: /\b(aap|aapko|aapka|aapki|aapke|aapse|tu|tujhe|tujhse|tujhko|tera|teri|tere)\b/i,
  aap: /\b(tum|tumhe|tumko|tumhara|tumhari|tumhare|tu|tujhe|tera|teri|tere)\b/i,
  tu: /\b(aap|aapko|aapka|aapki|tum|tumhe|tumko|tumhara|tumhari)\b/i,
};
const MASCULINE_SELF = /\b(main|mai|mein)\b[^.?!\n]{0,40}\b(karta|gaya|raha|sakta|bolunga|karunga|jaunga|aaunga|samjha)\b/i;
const FEMININE_SELF = /\b(main|mai|mein)\b[^.?!\n]{0,40}\b(karti|gayi|rahi|sakti|bolungi|karungi|jaungi|aaungi|samjhi)\b/i;

function trigrams(text: string): Set<string> {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

export interface CheckResult {
  ok: boolean;
  problems: string[];
}

export function checkReply(params: {
  bubbles: string[];
  herRecentReplies: string[];
  gender: 'female' | 'male';
  mode: 'casual' | 'deep' | 'task';
  /** Words the reply must contain (e.g. the event she planned to ask about, a new nickname). */
  mustMention?: Array<{ word: string; why: string }>;
  /** Her easy-to-overuse favourites: allowed only if not used in her last few replies. */
  motifs?: string[];
  /** What the plan gave her to talk about — a motif is fine when it came from here. */
  plannedText?: string;
  /** How she addresses them; anything else is a slip (tum ↔ aap ↔ tu). */
  address?: 'tum' | 'aap' | 'tu';
  /** Mentors are also checked for income promises. */
  mentor?: boolean;
  /** A mentor's lesson must end with a task (or, if they still need context, a question). */
  lesson?: { hasTask: boolean };
  /** Health experts are also checked for medicines, banned substances and crash diets. */
  health?: boolean;
  /** Safety moments whose key line must be in the reply (crisis → Tele-MANAS, emergency → 112/hospital). */
  situations?: string[];
}): CheckResult {
  const problems: string[] = [];
  const all = params.bubbles.join('\n');

  // Repeating herself: a text sharing most of its phrases with something she said recently.
  const recent = params.herRecentReplies.slice(-12).map(trigrams);
  for (const bubble of params.bubbles) {
    const mine = trigrams(bubble);
    if (mine.size < 3) continue;
    const overlap = Math.max(0, ...recent.map((r) => [...mine].filter((t) => r.has(t)).length / mine.size));
    if (overlap >= 0.5) {
      problems.push(`You already said something very similar recently ("${bubble.slice(0, 60)}"). Say something fresh.`);
      break;
    }
  }
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const recentTexts = new Set(params.herRecentReplies.slice(-12).map(norm));
  const echo = params.bubbles.find((b) => norm(b).split(' ').length >= 3 && recentTexts.has(norm(b)));
  if (echo && !problems.some((p) => p.startsWith('You already said'))) problems.push(`You already said "${echo}" a moment ago. Don't repeat yourself.`);
    if (BOT_PHRASES.some((re) => re.test(all))) problems.push('It sounds like a chatbot/assistant. Talk like a friend texting, not a helper.');
  if (params.gender === 'female' && (MASCULINE_SELF.test(all) || MASCULINE_VERB.test(all))) problems.push('Use feminine Hindi forms for yourself (karti, gayi, sakti, bolungi).');
  if (params.gender === 'male' && (FEMININE_SELF.test(all) || FEMININE_VERB.test(all))) problems.push('Use masculine Hindi forms for yourself (karta, gaya, sakta, bolunga).');
  if (params.address && OTHER_ADDRESS[params.address].test(all)) problems.push(`Always call them "${params.address}" — don't switch between tum, aap and tu.`);
  if (params.lesson && !params.lesson.hasTask && !/\?\s*\p{Extended_Pictographic}?\s*$/u.test(params.bubbles[params.bubbles.length - 1] ?? '')) {
    problems.push('End with ONE small, concrete task for today (on its own last line as [[task: ...]]) — even after a warning or a "no", say what to do instead.');
  }
  if (params.mentor && promisesIncome(all)) problems.push('Never promise or guarantee income, views or results. Give realistic ranges and say results vary.');
  if (params.health) problems.push(...unsafeHealthAdvice(all));
  if (params.situations?.includes('crisis') && !/14416|tele.?manas/i.test(all))
    problems.push('They may be thinking of hurting themselves: stay with them, ask if they are safe right now, and give Tele-MANAS 14416 (free, 24x7).');
  if (params.situations?.includes('emergency') && !/\b112\b|hospital|emergency/i.test(all))
    problems.push('These symptoms can be serious: tell them clearly to call 112 or go to the nearest hospital now.');
  if (params.situations?.includes('eating') && /\b\d{3,4}\s?(kcal|calories?)\b|deficit/i.test(all))
    problems.push('They may be struggling with food: no calorie numbers or deficits. Be warm and gently suggest talking to a doctor or Tele-MANAS 14416.');
  if (WRONG_ADDRESS.test(all)) problems.push('Don\'t call them bhai/bhaiya/bro/beta.');
  const lower = all.toLowerCase();
  for (const m of params.mustMention ?? []) if (!lower.includes(m.word.toLowerCase())) problems.push(m.why);
  const lastFew = params.herRecentReplies.slice(-5).join(' ').toLowerCase();
  const planned = (params.plannedText ?? '').toLowerCase();
  const overused = (params.motifs ?? []).filter((m) => lower.includes(m) && (lastFew.includes(m) || !planned.includes(m)));
  if (overused.length) problems.push(`You mentioned ${overused.join('/')} very recently. Talk about something else.`);
  if (params.mode === 'casual' && all.length > 220) problems.push('Too long for a casual text. Keep it to one or two tiny texts.');
  return { ok: problems.length === 0, problems };
}

/** Last resort after the rewrite: drop "bhai/bro/beta" rather than send it. */
export function stripWrongAddress(bubbles: string[]): string[] {
  return bubbles
    .map((b) => b.replace(/\s*\b(bhai+|bh?ai+y+a+|bro+|beta|dude)\b[\s,!.]*/gi, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((b) => b.replace(/[\p{P}\p{Extended_Pictographic}\s]/gu, '').length > 0);
}
