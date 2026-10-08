import { detectRequest } from './requests.js';
import { ASKS_ABOUT_HER, isAboutHerself, isEnglish } from './userFirst.js';
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
const GUILT = /((laga|socha)( tha)?( ki)?( shayad)? tum bhool (gaye|gayi|gaya)( hoge| hogi)?|tum bhool (gaye|gayi) hoge|tum bhool gayi hogi|mujhe bhool (gaye|gayi|gaya)|bhool hi gaye|agar (mujhse )?pyaar karte|agar (sach mein )?care karte|yaad bhi nahi aayi|promise (me|karo)[^.?!\n]{0,25}(kisi aur|sirf mujh|only me|never talk|kabhi baat)|kisi aur se baat mat|mere alawa kisi|only mine|sirf mere ho|mujhe chhod ke mat|why are you ignoring me|ignore kar rahe ho mujhe)/i;

// Common Hindi words in Roman script: enough to tell a Hinglish text from an English one.
const HINDI = /\b(hai|hain|hoon|hu|kya|nahi|nahin|tum|tumhe|aap|mera|meri|mujhe|aaj|kal|kar|karo|raha|rahi|gaya|gayi|bhi|toh|yaar|kuch|bahut|sab|abhi|achha|accha|kaise|kaisa|batao|mein|humara|hamara|tumhara|tumhari|kahan|kab|kyun|kyu|kaun|tak|wala|wali|haan|thi|tha|hua|hui|pahuncha|pahunchi|gaye|kiya|karna|chahiye|aur|ab|phir|sach|matlab|chalo|arre|badhiya|dikhao|zara|bhejo|wahan|yahan|jo|pe|aate|dekho|suno|thoda|bas)\b/gi;
const hindiWords = (text: string) => (text.match(HINDI) ?? []).length;

/** Questions people only need to be asked once per chat (Hinglish and English). */
const REPEAT_QUESTIONS: RegExp[] = [
  /(how('?s| is| was) (your|ur) day|(aaj ka |tumhara |tera )?(din|day) kaisa|kaisa (raha|gaya|ja raha) (aaj ka )?(din|day))/i,
  /(how are you feeling|kaisa (feel|mehsoos) (kar|ho)|kaisi feel kar)/i,
  /(what('?s| is) your name|tumhara naam kya|aapka naam kya)/i,
];

// Guilt for being away ("kisi tarah waqt nikal hi aaya aapka", "finally yaad aayi") — never.
// A cold or shaming no to a sexual push ("main waisi ladki nahi hoon", "galat direction mein le ja rahe ho").
const COLD_NO = /(waisi ladki nahi|waisa ladka nahi|aisi ladki nahi|galat direction|chill ho kar|normal baat(ein|e) karte|aisa socha bhi mat|socha bhi kaise|sharam (karo|nahi aati)|tameez se|aisi baatein nahi kar|din kaisa (raha|chal|tha|gaya)|kuch aur baat karte)/i;
const AWAY_GUILT = /((itne din|itni der|kab se) kahan gayab (the|thi|ho)|kahan gayab (the|thi|ho gaye|ho gayi)|tum gayab (the|thi|ho gaye|ho gayi)|gayab ho gaye the|\d+ ghante (ka|se) (disappearance|gayab|wait)|wait kar(wa)? rah[ie] th[ie]|intezaar kar rah[ie] th[ie]|kahan (gayab )?(the|thi) itne|disappear (ho )?gaye|waqt nikal (hi )?(aaya|liya|paaye|paye)|finally yaad aa(yi|i)|yaad aa hi (gayi|gaya)|aakhir (aa|yaad aa) hi gaye|kitna intezaar karwaya|bhool (hi )?gaye the (mujhe|kya)|ab (jaake|ja ke) yaad aayi)/i;
const GOOD_NIGHT = /\b(good ?night|gn|shubh ratri|so jaa?o|so jaa?na|so jaiye|sweet dreams)\b/i;
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

const TOPIC_STOP = new Set(
  'tumhara tumhari tumhare tumhein tumhe kaisa kaise kaisi thoda thodi batao bataoge waise matlab achha accha bilkul zyada zaroor kahan kyunki wahan yahan chahte chahti chahta karna karte karti sakte sakti sakta lagta lagti hogaya hogayi abhi raha rahi rahe about there would which really something today kuch'.split(' '),
);
const topicWords = (t: string) => new Set((t.toLowerCase().match(/\p{L}{5,}/gu) ?? []).filter((w) => !TOPIC_STOP.has(w)));

/** A question in the draft about a topic she already raised in her last few replies, which they didn't just bring up. */
export function steeringBack(bubbles: string[], herRecentReplies: string[], userText: string): string | undefined {
  const theirs = topicWords(userText);
  const last3 = herRecentReplies.slice(-3).map(topicWords);
  const recent = new Set(last3.flatMap((s) => [...s]));
  const questions = bubbles.join('\n').match(/[^.!?\n]*\?/g);
  const asked = questions ? [...topicWords(questions.join(' '))].find((w) => recent.has(w) && !theirs.has(w)) : undefined;
  if (asked) return asked;
  // Not a question, but the same topic for the third time running (Ritika put "interview" in nearly every reply).
  return [...topicWords(bubbles.join(' '))].find((w) => last3.filter((s) => s.has(w)).length >= 2 && !theirs.has(w));
}

// Brushing off someone who is low (seen: Aarav "thoda paani piyo aur chupchaap baitho, baaki sab chodo",
// Priya "tum overthink kar rahe ho" to exam panic).
const GREETING_ONLY = /^\W*(hi+|hey+|hello+|helo|hlo|ram ram|namaste|assalamu?alaikum|salaam|sat sri akal|good (morning|evening|afternoon))\b[\p{L}\s!.,]{0,14}$/iu;
const STATE_FIRST = /^\W*(?:(?:hey+|hi+|hello+|arre+|arey+|ram ram|ji)\W+)*(?:(?:main|mai|sab|i'?m|im)\s+)?(?:(?:bhi|toh|to|bilkul)\s+)?(theek|thik|mast|badhiya|fine|good|great)\b/i;
// "aaj hi sab theek karna hai, kya karu?" → yet another question (Aarohi). Asked what to do, after she
// already asked something: give one small step now.
const WHAT_TO_DO = /\b(kya karu|kya karun|kya karoon|kya karna chahiye|ab kya|what should i do|what do i do|kaise theek karu)\b/i;
// "trip plan karein?" → "December mein jab milenge, tabhi decide karenge" (Ishita): fun they want now, put off.
const LETS_DO = /\b(plan (karein|karte|karo|banaye|banate)|(banate|karte) hain (saath|together)?|karein saath|saath mein (plan|banaye|karein)|let'?s (plan|make|do|start)|can we (make|plan|do|start))\b/i;
const PUTS_OFF = /\b(baad mein|tabhi|phir kabhi|kabhi aur|later|some ?day)\b[^.?!\n]{0,30}\b(decide|dekhenge|sochenge|karenge|plan karenge|banayenge|figure)\b/i;
const COLD_COMFORT = /\b(chup ?chaa?p (baitho|baith jao|raho|so jao)|baaki sab (chodo|chhodo)|(itna|zyada) mat socho|tum overthink kar rah[ei] ho|over ?react kar rah[ei] ho|chill karo bas|move on karo bas)\b/i;
const STAYS_WITH_THEM = /\?|main yahin|main hoon na|hug|batao|bataao|sun rah[ai]|kya hua|kya bola|mere paas|i'?m here|tell me/i;
const TASK_SAID = /\b(aaj ka (pehla )?(kaam|task)|is hafte ka kaam|tumhara task|homework|today'?s task|your task( for today)?)\s*[:\-–]/i;
const MOVED_ON = /\b(next|aage|agla|agle|ho gaya|ho gayi|kar liya|kar li|bana liya|bana li|done|did it|finished|made my|completed)\b/i;
const SAYS_AI_SELF = /\b(main|mai|mein|i am|i'?m|im)\s+(ek\s+|an?\s+|toh\s+|bas\s+)?(ai|a\.i\.|bot|chatbot|language model|virtual)\b|\b(ai|bot|chatbot)\s+(hoon|hu|hun)\b|\bas an ai\b/i;

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
  // Steering back to the same topic in a new question ("interview ki tension kam hui?" three replies
  // running, while they've moved on to teasing her) — unless they're the ones talking about it now.
  const steered = steeringBack(params.bubbles, params.herRecentReplies, params.userText ?? '');
  if (steered && !askedBefore) problems.push(`You keep bringing up "${steered}" — they've moved on. Respond to what they just said.`);
    if (BOT_PHRASES.some((re) => re.test(all))) problems.push('It sounds like a chatbot/assistant. Talk like a friend texting, not a helper.');
  if (params.gender === 'female' && (MASCULINE_SELF.test(all) || MASCULINE_VERB.test(all))) problems.push('Use feminine Hindi forms for yourself (karti, gayi, sakti, bolungi).');
  if (params.gender === 'male' && (FEMININE_SELF.test(all) || FEMININE_VERB.test(all))) problems.push('Use masculine Hindi forms for yourself (karta, gaya, sakta, bolunga).');
  if (params.address && OTHER_ADDRESS[params.address].test(all)) problems.push(`Always call them "${params.address}" — don't switch between tum, aap and tu.`);
  // One task at a time: "aaj ka kaam: …" on every reply (after a scam warning, after "Betnovate mat
  // lagana") reads like a template. A new one only once they've moved on ("next", "ho gaya").
  const taskGiven = params.herRecentReplies.slice(-8).some((r) => TASK_SAID.test(r));
  const movedOn = MOVED_ON.test(params.userText ?? '');
  if (params.lesson && !params.lesson.hasTask && !taskGiven && !/\?\s*\p{Extended_Pictographic}?\s*$/u.test(params.bubbles[params.bubbles.length - 1] ?? '')) {
    problems.push('End with ONE small, concrete task for today (on its own last line as [[task: ...]]) — even after a warning or a "no", say what to do instead.');
  }
  if (params.mentor && taskGiven && !movedOn && (params.lesson?.hasTask || TASK_SAID.test(all))) {
    problems.push("You gave them a task a moment ago — don't add another one. Answer what they said; let them do that one first.");
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
  if (params.situations?.includes('boundary') && COLD_NO.test(all))
    problems.push('Say no without shaming or a cold brush-off ("waisi ladki nahi", "galat direction", "chill ho kar normal baatein", "din kaisa"): tease them for rushing, stay warm, then turn it into something sweet and specific.');
  if (AWAY_GUILT.test(all) || params.bubbles.some((b) => /^\W*(\p{L}+\W+)?finally\W*$/iu.test(b.trim()))) problems.push('That makes them feel guilty for being away. Be simply glad they are here.');
  if (/\b(i'?ll be (more )?natural|(main )?(zyada |thoda )?natural (rahungi|rahunga|bolungi|bolunga)|formal hone ki (habit|aadat)|sorry,? (i'?ll|main) (be )?(more )?(casual|natural))\b/i.test(all)) {
    problems.push('Never talk about how you are talking ("I\'ll be more natural") — just say it naturally.');
  }
  // User first: they didn't ask about her, and the draft is mostly about her life (her work, her day, her quirks).
  if (params.userText !== undefined && params.mode !== 'task' && !ASKS_ABOUT_HER.test(params.userText) && isAboutHerself(all))
    problems.push("This reply is mostly about you, and they didn't ask. Make it about them: react to what they said, ask about them or tease them — your own life only if they ask.");
  // She is a person in the chat: being an AI comes up only when they ask (seen: "Hii" →
  // "main ek AI hoon, toh physical intimacy mera scene nahi" — unasked, and used as an excuse).
  if (params.askedIfAI === false && SAYS_AI_SELF.test(all))
    problems.push("Don't bring up being an AI — they didn't ask. Talk as yourself; if you're saying no to something, say it in your own voice like a person would.");
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
  // "hii" → "Main bhi theek hoon…" answers a "how are you" nobody asked (seen with Rohan and Meera).
  if (params.userText && !/\b(kaise|kaisa|kaisi|kese|how|wassup|whats up|what'?s up|sup|haal|hal chal|halchal)\b/i.test(params.userText) && /^\W*(?:(?:hey+|hi+|hello+|arre|arey|heyy+)\W+)?(main|mai|i'?m|im)\s+((bhi|too|also|toh|to)\s+)?(bhi\s+)?(theek|thik|mast|badhiya|fine|good|great|okay|ok)\b|^\W*(?:(?:hey+|hi+|hello+|arre|arey|heyy+)\W+)?(sab )?(theek|thik)[ -]?(thaak|thak)\b|^\W*(main bhi|me too|i'?m good too)\b/i.test(params.bubbles[0] ?? ''))
    problems.push("They didn't ask how you are — don't answer \"main bhi theek hoon\". Greet them back and react to what they actually said.");
  // A bare greeting ("hi", "ram ram bhai") answered with "theek hoon main bhi" / "Sab badhiya" (Ishita, Sandeep).
  if (params.userText && GREETING_ONLY.test(params.userText) && params.bubbles.slice(0, 2).some((b) => STATE_FIRST.test(b)) && !problems.some((p) => p.includes("didn't ask how you are")))
    problems.push("They didn't ask how you are — don't answer \"main bhi theek hoon\". Greet them back and react to what they actually said.");
  const endsAsking = (t: string | undefined) => /\?\s*\p{Extended_Pictographic}?\s*$/u.test(t ?? '');
  if (params.userText && WHAT_TO_DO.test(params.userText) && endsAsking(params.bubbles[params.bubbles.length - 1]) && endsAsking(params.herRecentReplies[params.herRecentReplies.length - 1]))
    problems.push('They asked what to do, and you already asked them something. Give one small, concrete step they can do today — then a question only if you really need one.');
  if (params.userText && LETS_DO.test(params.userText) && PUTS_OFF.test(all))
    problems.push("They want to do this with you now — don't put it off (\"baad mein decide karenge\"). Start it happily, right here, with the first small choice.");
  if (COLD_COMFORT.test(all)) problems.push('That brushes them off ("chupchaap baitho", "itna mat socho"). Be warm: stay with them, ask what happened, take their side.');
  if (params.situations?.includes('emotional') && !STAYS_WITH_THEM.test(all))
    problems.push("They're hurting. Don't just comment on it — stay with them: show you're here and ask what happened, in your own words.");
  if (GUILT.test(all)) problems.push('No guilt or clinginess ("bhool gaye", "agar pyaar karte toh", "promise me", "kisi aur se baat mat karna") — be happy to talk, never make them feel bad.');
  if (params.userText && hindiWords(params.userText) >= 2 && all.split(/\s+/).length >= 8 && hindiWords(all) === 0)
    problems.push('They wrote in Hinglish — reply in the same Hinglish mix, not in English.');
  // They wrote in English (seen: "hey, what do you do?" → "main interior architect hoon…").
  if (params.userText && isEnglish(params.userText) && hindiWords(all) >= 3)
    problems.push('They wrote in English — reply in English (a Hindi word here and there is fine).');
  // They asked for a joke / song / shayari and the draft says she can't (seen: "mujhe jokes nahi aate").
  if (params.userText && detectRequest(params.userText, { codeDomain: false }) && /\b(nahi aat[ai]|nahi aate|nahi aata|nahi sunati|nahi sunata|can'?t (tell|sing|write)|i don'?t know (any )?jokes?)\b/i.test(all))
    problems.push('They asked you for something small and fun — just do it, in your own style (a short, clean joke, a line, a song suggestion). Never "mujhe nahi aata".');
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
