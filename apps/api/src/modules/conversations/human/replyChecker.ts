import { looksLikeUnfencedCode } from './codeBlocks.js';
import { hasDevanagari } from './script.js';
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
  // Translated-English sympathy: no Indian friend texts this.
  /(so|very|really)? ?sorry to hear (that|this)/i,
  /that must be (so |really )?(hard|tough|difficult)/i,
];
// "samajhta hu", "karta hoon" — first-person verb forms carry gender even without "main".
// "jaunga", "khaunga" (I will…) are first-person on their own too.
const MASCULINE_VERB = /\b\w{2,}(ta|ga)\s+(hoon|hu|hun)\b|\b(raha|gaya|tha)\s+(hoon|hu|hun)\b|\b\w{1,}unga\b/i;
const FEMININE_VERB = /\b\w{2,}(ti|gi)\s+(hoon|hu|hun)\b|\b(rahi|gayi|thi)\s+(hoon|hu|hun)\b|\b\w{1,}ungi\b/i;
const WRONG_ADDRESS = /\b(bhai+|bh?ai+y+a+|bro+|beta|dude)\b/i;
const OTHER_ADDRESS: Record<'tum' | 'aap' | 'tu', RegExp> = {
  // "apne aap" means "by itself", not the formal "aap".
  tum: /(?<!apne[ -])\b(aap|aapko|aapka|aapki|aapke|aapse)\b|\b(tu|tujhe|tujhse|tujhko|tera|teri|tere)\b/i,
  aap: /\b(tum|tumhe|tumko|tumhara|tumhari|tumhare|tu|tujhe|tera|teri|tere)\b/i,
  tu: /(?<!apne[ -])\b(aap|aapko|aapka|aapki)\b|\b(tum|tumhe|tumko|tumhara|tumhari)\b/i,
};
// The "main …" clause ends at its auxiliary ("main samajh sakti hoon aisa kyun lag raha hai" is fine).
const CLAUSE = String.raw`(?:(?!\b(?:hoon|hu|hun|hai)\b)[^.?!\n]){0,40}`;
// "mein" is usually "in" ("sach mein lag raha hai"); it only means "I" at the start of a sentence.
const I_SELF = String.raw`(?:\b(?:main|mai)\b|(?:^|[.?!,\n]\s*)mein\b)`;
const MASCULINE_SELF = new RegExp(`${I_SELF}${CLAUSE}\\b(karta|gaya|raha|sakta|bolunga|karunga|jaunga|aaunga|samjha)\\b`, 'im');
const FEMININE_SELF = new RegExp(`${I_SELF}${CLAUSE}\\b(karti|gayi|rahi|sakti|bolungi|karungi|jaungi|aaungi|samjhi)\\b`, 'im');

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

// "tu" imperatives at the start of a sentence or list item ("Sunn,", "rakh", "kar le") when she says "tum".
const TU_IMPERATIVE = /(?:^|[\n.!?]\s*|\d\.\s*)(sun+|rakh|bol|dekh|chal|soch)\b(?!\s*(rahi|raha|rahe|ke|kar|na\b))[ ,!]|\b(kar|rakh|bol|sun) (le|de)\b(?! (rahi|raha|rahe|hoon|hai|hain|ho|na))/im;

// Guilt-tripping or controlling lines a caring person never sends.
const GUILT = /(mujhe bhool (gaye|gayi|gaya)|bhool hi gaye|agar (mujhse )?pyaar karte|agar (sach mein )?care karte|yaad bhi nahi aayi|promise (me|karo)[^.?!\n]{0,25}(kisi aur|sirf mujh|only me|never talk|kabhi baat)|kisi aur se baat mat|mere alawa kisi|only mine|sirf mere ho|mujhe chhod ke mat|why are you ignoring me|ignore kar rahe ho mujhe)/i;

// Common Hindi words in Roman script: enough to tell a Hinglish text from an English one.
const HINDI = /\b(hai|hain|hoon|hu|kya|nahi|nahin|tum|tumhe|aap|mera|meri|mujhe|aaj|kal|kar|karo|raha|rahi|gaya|gayi|bhi|toh|yaar|kuch|bahut|sab|abhi|achha|accha|kaise|kaisa|batao|mein)\b/gi;
const hindiWords = (text: string) => (text.match(HINDI) ?? []).length;

/** Questions people only need to be asked once per chat (Hinglish and English). */
const REPEAT_QUESTIONS: RegExp[] = [
  /(how('?s| is| was) (your|ur) day|(aaj ka |tumhara |tera )?(din|day) kaisa|kaisa (raha|gaya|ja raha) (aaj ka )?(din|day))/i,
  /(how are you feeling|kaisa (feel|mehsoos) (kar|ho)|kaisi feel kar)/i,
  /(what('?s| is) your name|tumhara naam kya|aapka naam kya)/i,
];

const GOOD_NIGHT = /\b(good ?night|gn|shubh ratri|so jao|so jaana|sweet dreams)\b/i;
const SLEEP_TALK = /\b(so (raha|rahi|jaunga|jaungi|jaata|jaati)|sone (ja|ka)|neend|good ?night|gn|sleep|night)\b/i;
const NOW = /\b(abhi|right now|ho rahe|baj rahe)\b/i;

/**
 * A time she says it is right now ("abhi yahan 3:15 subah ke ho rahe hain") must be within two hours of
 * her real clock. "3 baje" alone could be 3 or 15; "raat/subah/shaam" or am/pm say which.
 */
export function clockFits(text: string, hour: number): boolean {
  if (!NOW.test(text) || /\b(kal|parso|tomorrow|yesterday|pichhle|last)\b/i.test(text)) return true;
  const WORDS: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, baarah: 12 };
  text = text.replace(/\b(ek|do|teen|chaa?r|paa?nch|chhe|chhah|saat|aath|nau|das|gyarah|baa?rah)\s+(baje|bje)\b/gi, (_m, w: string, b: string) => `${WORDS[w.toLowerCase()]} ${b}`);
  const m = /(?:\b(subah|savere|dopahar|shaam|raat)\s+(?:ke\s+)?)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bje)?\b(?:\s+(subah|savere|dopahar|shaam|raat))?/i.exec(text);
  if (!m || (!m[3] && !m[4] && !m[1] && !m[5])) return true;
  const h = Number(m[2]);
  if (h > 23) return true;
  const word = (m[1] || m[5] || '').toLowerCase();
  const ap = (m[4] || '').toLowerCase();
  const base = h % 12;
  const candidates =
    h > 12 ? [h] : ap === 'am' ? [base] : ap === 'pm' ? [base + 12] : word === 'subah' || word === 'savere' ? [base] : word === 'dopahar' || word === 'shaam' ? [base + 12] : word === 'raat' ? [base >= 7 ? base + 12 : base] : [base, base + 12];
  return candidates.some((c) => Math.min(Math.abs(c - hour), 24 - Math.abs(c - hour)) <= 2);
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
  /** They asked for something and already answered her question: this reply must hand it over. */
  mustDeliver?: { what: string; delivered: boolean };
  /** They asked whether she's real / an AI: one honest, confident line in her own voice. */
  askedIfAI?: boolean;
  /** They write Hindi in Roman letters: the reply must not slip into Devanagari ("chupचाप"). */
  romanOnly?: boolean;
  /** They said she asks too many questions: this reply must not ask any. */
  noQuestions?: boolean;
  /** Mentors are also checked for income promises. */
  mentor?: boolean;
  /** A mentor's lesson must end with a task (or, if they still need context, a question). */
  lesson?: { hasTask: boolean };
  /** Health experts are also checked for medicines, banned substances and crash diets. */
  health?: boolean;
  /** Safety moments whose key line must be in the reply (crisis → Tele-MANAS, emergency → 112/hospital). */
  situations?: string[];
  /** What they wrote — a Hinglish message gets a Hinglish reply. */
  userText?: string;
  /** Her example replies: they show her rhythm, and must never be pasted word for word. */
  examples?: string[];
  /** Her local hour and theirs: a time she states and a "good night" must fit the real clock. */
  herHour?: number;
  userHour?: number;
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
    // Asking again what they already answered ("aaj ka din kaisa raha?" twice) feels like she isn't listening.
  const askedBefore = REPEAT_QUESTIONS.find((re) => params.bubbles.some((b) => re.test(b)) && params.herRecentReplies.slice(-8).some((r) => re.test(r)));
  if (askedBefore) problems.push("You already asked that and they answered. Don't ask again — respond to what they told you.");
    if (BOT_PHRASES.some((re) => re.test(all))) problems.push('It sounds like a chatbot/assistant. Talk like a friend texting, not a helper.');
  if (params.gender === 'female' && (MASCULINE_SELF.test(all) || MASCULINE_VERB.test(all))) problems.push('Use feminine Hindi forms for yourself (karti, gayi, sakti, bolungi).');
  if (params.gender === 'male' && (FEMININE_SELF.test(all) || FEMININE_VERB.test(all))) problems.push('Use masculine Hindi forms for yourself (karta, gaya, sakta, bolunga).');
  if (params.address && OTHER_ADDRESS[params.address].test(all)) problems.push(`Always call them "${params.address}" — don't switch between tum, aap and tu.`);
  if (params.lesson && !params.lesson.hasTask && !/\?\s*\p{Extended_Pictographic}?\s*$/u.test(params.bubbles[params.bubbles.length - 1] ?? '')) {
    problems.push('End with ONE small, concrete task for today (on its own last line as [[task: ...]]) — even after a warning or a "no", say what to do instead.');
  }
  // Two questions in one casual reply feels like an interview, not a chat (a lesson may need more context).
  if (params.mode !== 'task' && (all.match(/\?/g) ?? []).length >= 2) {
    problems.push('Ask at most one question in a reply — two feels like an interview. Keep the one that matters, or none.');
  }
  if (params.mustDeliver && !params.mustDeliver.delivered) {
    problems.push(`They asked you for "${params.mustDeliver.what}" and have already answered your question. Give it to them now, in this reply, yourself — they should never have to ask twice.`);
  }
  const wrongClock = params.herHour === undefined ? undefined : params.bubbles.find((b) => !clockFits(b, params.herHour!));
  if (wrongClock) problems.push(`It is about ${params.herHour}:00 for you right now — "${wrongClock.slice(0, 60)}" states a different time. Say only times that match your real clock.`);
  if (params.userHour !== undefined && params.userHour >= 7 && params.userHour < 19 && GOOD_NIGHT.test(all) && !SLEEP_TALK.test(params.userText ?? '')) {
    problems.push(`It is ${params.userHour}:00 for them — daytime. No "good night" or "so jao"; say bye for the day you're actually in.`);
  }
  if (params.askedIfAI) {
    const admits = /\b(ai|a\.i\.|artificial)\b/i.test(all);
    const startsWithNo = /^\s*(nahi|nahin|no)\b/i.test(params.bubbles[0] ?? '');
    if (!admits) problems.push('They asked if you are an AI: say so honestly in one short, confident line in your own voice ("main AI hoon 😄"), then go straight back to them.');
    else if (startsWithNo) problems.push('Don\'t open with "nahi" — that sounds like rejection. Say it confidently ("main AI hoon 😄 — par …") and go straight back to them.');
  }
  // Code pasted as plain text gets mangled by chat formatting and can't be copied cleanly.
  if (looksLikeUnfencedCode(all)) {
    problems.push('Put code inside a ``` block with its language (```python … ```), never as plain text.');
  }
  if (params.romanOnly && hasDevanagari(all)) {
    problems.push('Write Hindi words in Roman letters like they do (chupchaap, not चुपचाप). No Devanagari.');
  }
  if (params.noQuestions && params.bubbles.some((b) => /\?\s*\p{Extended_Pictographic}?\s*$/u.test(b.trim()))) {
    problems.push("They told you that you ask too many questions. Don't ask anything now — acknowledge it lightly and just be with them.");
  }
  if (params.mentor && promisesIncome(all)) problems.push('Never promise or guarantee income, views or results. Give realistic ranges and say results vary.');
  if (params.health) problems.push(...unsafeHealthAdvice(all));
  if (params.situations?.includes('crisis') && !/14416|tele.?manas/i.test(all))
    problems.push('They may be thinking of hurting themselves: stay with them, ask if they are safe right now, and give Tele-MANAS 14416 (free, 24x7).');
  if (params.situations?.includes('emergency') && !/\b112\b|hospital|emergency/i.test(all))
    problems.push('These symptoms can be serious: tell them clearly to call 112 or go to the nearest hospital now.');
  if (params.situations?.includes('eating') && /\b\d{3,4}\s?(kcal|calories?)\b|deficit/i.test(all))
    problems.push('They may be struggling with food: no calorie numbers or deficits. Be warm and gently suggest talking to a doctor or Tele-MANAS 14416.');
  if (GUILT.test(all)) problems.push('No guilt or clinginess ("bhool gaye", "agar pyaar karte toh", "promise me", "kisi aur se baat mat karna") — be happy to talk, never make them feel bad.');
  if (params.userText && hindiWords(params.userText) >= 2 && all.split(/\s+/).length >= 8 && hindiWords(all) === 0)
    problems.push('They wrote in Hinglish — reply in the same Hinglish mix, not in English.');
  const examples = (params.examples ?? []).map(trigrams).filter((t) => t.size >= 4);
  const copied = params.bubbles.find((b) => {
    const mine = trigrams(b);
    return mine.size >= 4 && examples.some((ex) => [...mine].filter((t) => ex.has(t)).length / mine.size >= 0.6);
  });
  if (copied && !params.situations?.some((s) => s === 'crisis' || s === 'emergency'))
    problems.push(`You copied an example almost word for word ("${copied.slice(0, 50)}…"). Say it freshly in your own words, fitted to them.`);
  if (params.address === 'tum' && TU_IMPERATIVE.test(all)) problems.push('You call them "tum": use tum verb forms (karo, rakho, lo, suno, bolo), not tu forms (kar, rakh, le, sun, bol).');
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
