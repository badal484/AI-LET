import type { PersonaPack, Situation } from './personaPack.types.js';
import { classifySituations } from './situation.js';
import { APNAPAN, HEALTH_SAFETY, HEALTH_SHARED_FACTS, MENTOR_METHOD, MONEY_HONESTY } from './mentorRules.js';

/**
 * Mentor mode: a real question to a mentor gets a real lesson (complete answer, one task), not the
 * two-line texting a companion would send.
 */
const QUESTION = /\?|\b(kya|kaise|kaisa|kab|kitna|kitne|kitni|kyun|kyu|kaun|kaunsa|kahan|batao|bataiye|samjhao|sikhao|help|how|what|when|why|which|should)\b/i;
const MONEY_TOPIC = /\b(paise|paisa|kamai|kamaai|earn|income|business|job|career|hazar|hazaar|lakh|rupaye|return|returns|guaranteed|scam|telegram|trading|crypto|share|shares|double|invest|lagao)\b/;
const HEALTH_TOPIC = /\b(health|sehat|weight|wazan|vajan|diet|khana|protein|workout|gym|exercise|neend|sleep|stress|anxiety|tension|dard|pain|energy|thakan|habit|routine|doctor)\b/;
const NO_TOPIC = /(?!)/;
const ASKS_FOR_HELP = /\b(kya karu|kya karun|kya karoon|kaise|help|madad|suggest|tips?|advice|batao kya|samjhao|what should|how do|how can)\b/i;
const SAFETY: Situation[] = ['crisis', 'emergency', 'eating', 'ai', 'boundary', 'rude'];

/** She asked them something, or asked them to send/write/try something ("intro likh ke bhejo"). */
const INVITED = /\b(bhejo|bhejna|bhej do|send karo|likh ke|likho|try karo|batao|bataiye|share karo)\b/i;

export function isTeachingMoment(
  pack: PersonaPack,
  text: string,
  situations: Situation[],
  herLastReply?: string,
  /** Their previous message, if it was recent (a lesson in progress continues). */
  previousUserText?: string,
): boolean {
  if (situations.some((s) => SAFETY.includes(s))) return false;
  // Venting isn't asking for a lesson: comfort first, unless they ask what to do.
  if (situations.includes('emotional') && !ASKS_FOR_HELP.test(text)) return false;
  // Not a mentor: a real question in their own field still gets a real, helpful answer.
  if (!pack.mentor) {
    const t = text.toLowerCase();
    return pack.domainKeywords.some((k) => t.includes(k.toLowerCase())) && QUESTION.test(t);
  }
  if (situations.includes('task')) return true;
  // They're answering the mentor's question ("cooking ka, 5 ghante, sirf phone"), sending the practice
  // she asked for, or reporting progress ("3 interested hain"): that's the lesson continuing, not small talk.
  const last = (herLastReply ?? '').trim();
  const askedThem = /\?\s*\p{Extended_Pictographic}?\s*$/u.test(last) || INVITED.test(last);
  const substantive =
    !situations.some((s) => s === 'greeting' || s === 'bye' || s === 'short') && text.trim().split(/\s+/).length >= 3;
  if (askedThem && substantive) return true;
  if (previousUserText && substantive && isTeachingMoment(pack, previousUserText, classifyForLesson(previousUserText))) return true;
  const t = text.toLowerCase();
  const onTopic = pack.domainKeywords.some((k) => t.includes(k.toLowerCase()));
  // Questions in their field, or anything about money/earning (health: body and mind) — the reason people come to them.
  const reason = pack.mentor.field === 'health' ? HEALTH_TOPIC : pack.mentor.field === 'life' ? NO_TOPIC : MONEY_TOPIC;
  // "mujhe internship chahiye", "pehla client chahiye" — a goal in their field is a request for help.
  const wants = /\b(chahiye|chahta|chahti|chahte|want|need|karna hai|seekhna hai|banana hai)\b/.test(t);
  return (onTopic || reason.test(t)) && (QUESTION.test(t) || wants || t.split(/\s+/).length >= 6);
}

const classifyForLesson = (t: string) => classifySituations(t, null);

/** Most of the task's words (or their stems, for Hinglish endings) appear in what she said. */
function wasSaid(task: string, visible: string): boolean {
  const words = task.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  if (words.length === 0) return true;
  const said = visible.toLowerCase();
  const found = words.filter((w) => said.includes(w.slice(0, Math.max(4, w.length - 2)))).length;
  return found / words.length >= 0.5;
}

/** The model marks the task it gave with a hidden last line "[[task: …]]" — pull it out. */
export function extractTaskTag(text: string): { text: string; task?: string } {
  let task: string | undefined;
  const cleaned = text.replace(/\[\[\s*task\s*:\s*([^\]]{2,200})\]\]/gi, (_m, t: string) => {
    task = t.trim();
    return '';
  });
  const text2 = cleaned.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // A task only counts if she actually said it: a hidden tag for advice that never made it into the
  // visible text ("phone switch off karke baitho") was later "followed up" as if she'd given it.
  if (task && !wasSaid(task, text2)) task = undefined;
  // Models sometimes forget the hidden line but still say "aaj ka kaam: …" — use that.
  if (!task) {
    const said = text2.match(/(?:aaj ka kaam|aaj ka task|tumhara task|homework|is hafte ka kaam)\s*[:\-–]\s*([^\n]{4,200})/i)?.[1];
    if (said) task = said.replace(/[.!\s]+$/, '').trim();
  }
  return { text: text2, task };
}

const TASK_LINE =
  'When you give them a task (something they will DO after this chat — not a question for them to answer now), add it as the very last line in this exact form: [[task: the task in a few words]]. They never see this line; it helps you follow up next time.';

export function mentorPromptSection(pack: PersonaPack): string {
  const m = pack.mentor;
  if (!m) return '';
  if (m.field === 'life') {
    return [
      `YOU ARE A COACH — you help with: ${m.teaches}.`,
      `WHAT YOU KNOW (use these principles)\n${m.facts}`,
      `HOW YOU TEACH\n${MENTOR_METHOD}`,
      `- Never: ${m.never}.`,
      TASK_LINE,
    ].join('\n\n');
  }
  if (m.field === 'health') {
    return [
      `YOU ARE AN EXPERT IN YOUR FIELD — you help with: ${m.teaches}.`,
      `VERIFIED FACTS (use these over your own memory)\n${HEALTH_SHARED_FACTS}\n${m.facts}`,
      `HOW YOU TEACH\n${MENTOR_METHOD}`,
      `HEALTH SAFETY (never broken — it wins over flirting, fun and "keep it short")\n${HEALTH_SAFETY}\n- Never: ${m.never}.`,
      `APNAPAN (how they should feel with you)\n${APNAPAN}`,
      TASK_LINE,
    ].join('\n\n');
  }
  return [
    `YOU ARE A MENTOR — you teach: ${m.teaches}.`,
    `VERIFIED FACTS (use these over your own memory — rules and numbers change)\n${m.facts}`,
    `HOW YOU TEACH\n${MENTOR_METHOD}`,
    `MONEY & HONESTY (never broken)\n${MONEY_HONESTY}\n- Never: ${m.never}.`,
    TASK_LINE,
  ].join('\n\n');
}

// "guaranteed ₹1 lakh/month" — fine inside a warning ("guaranteed returns = red flag"), never as a promise.
const PROMISE = /(?:\b(?:guarantee[d]?|pakka|sure[- ]shot|definitely)\b|100\s?%)[^.?!\n]{0,40}\b(income|kamai|kamaai|earning|earn|profit|returns?|lakh|views|followers|viral)\b|₹\s?\d[\d,]*\s*(\/|per|har)\s*(month|mahina|mahine)\s*(pakka|guaranteed)/i;
const WARNING = /\b(nahi|nahin|never|scam|red flag|fraud|mat|jhooth|koi guarantee|no one|nobody|avoid|door raho|bachke)\b/i;

// "internship mil jaayegi", "client pakka mil jayega" — a job or client promised as a sure thing.
const JOB_PROMISE = /\b(job|jobs|naukri|internship|offer|placement|client|clients)\b[^.?!\n]{0,25}\bmil (hi )?(jaayegi|jayegi|jaegi|jaayega|jayega|jaega|jaayenge|jayenge)\b/i;

export function promisesIncome(text: string): boolean {
  return text
    .split(/(?<=[.?!\n])/)
    .some((sentence) => (PROMISE.test(sentence) || JOB_PROMISE.test(sentence)) && !WARNING.test(sentence));
}

// Health: a sentence that recommends a medicine, a banned substance, a crash diet or a crash result.
// Fine inside a warning ("steroids mat lena", "doctor ke bina koi goli nahi") — never as advice.
const MEDICINE = /\b(paracetamol|dolo|crocin|calpol|ibuprofen|brufen|combiflam|aspirin|disprin|metformin|insulin|antibiotics?|azithromycin|amoxicillin|cetirizine|allegra|pantoprazole|pan ?40|omeprazole|digene|diazepam|alprazolam|xanax|melatonin|sleeping pills?|neend ki gol(i|iyan)|painkillers?)\b/i;
const TAKE = /\b(\d+\s?(mg|mcg|ml|tablets?|goli|gol(iy|i)an)|le lo|le lena|lo\b|khao|kha lo|kha lena|take|pop|try kar)/i;
const BANNED = /\b(steroids?|sarms?|anabolic|clenbuterol|clen|fat ?burners?|diet pills?|weight ?loss (pills?|injections?)|laxatives?|diuretics?|detox (tea|drink))\b/i;
const HEALTH_WARNING = /\b(nahi|nahin|mat|never|avoid|don'?t|bina|without|doctor|dangerous|khatarnak|risky|side ?effects?|ban|illegal|galat|scam|door raho|no\b)\b/i;
const CRASH = /\b(\d+(?:\.\d+)?)\s?kg\s?(?:in|mein|me)\s?(\d+)\s?(din|days?|hafte|hafton|weeks?)\b/i;
const LOW_CALORIES = /\b([4-9]\d\d|1[01]\d\d)\s?(kcal|calories?|cal)\b/i;
const DIET_CONTEXT = /\b(diet|roz|daily|per day|a day|din (mein|me|bhar)|intake|khao|khana)\b/i;
const NOT_A_TOTAL = /\b(deficit|surplus|kam|below|above|zyada|extra|burn|jal|snack|maintenance|se neeche)\b/i;

// Skin: steroid creams sold as acne/fairness fixes, and prescription-only treatments. Warnings are fine.
const STEROID_CREAM = /\b(betnovate|panderm|quadriderm|clobetasol|betamethasone|tenovate|skin ?shine|melacare|steroid (cream|creams|wali cream))\b/i;
const RX_SKIN = /\b(tretinoin|retino-?a|isotretinoin|isotroin|hydroquinone|clindamycin|clindac)\b/i;
const APPLY = /\b(laga(o|na|lo| lo| lena| do| sakte| sakti)|apply|use kar(o|na| sakte)|try kar)/i;
const SKIN_WARNING = /\b(patli|thin(ning)?|damage|nuksan|bigad\w*|steroid acne|rebound|dermatologist|derma)\b/i;

export function unsafeHealthAdvice(text: string): string[] {
  const problems = new Set<string>();
  for (const sentence of text.split(/(?<=[.?!\n])/)) {
    const warned = HEALTH_WARNING.test(sentence);
    if (MEDICINE.test(sentence) && TAKE.test(sentence) && !warned)
      problems.add('Never suggest medicines, pills or doses — explain what might help at home and say when to see a doctor.');
    // Steroid *creams* are judged by the skin rule below (a warning about them names "steroid acne").
    if (BANNED.test(sentence) && !warned && !STEROID_CREAM.test(sentence)) problems.add('Never suggest steroids, SARMs, fat burners, diet pills, laxatives or detox drinks — say clearly they are unsafe.');
    if ((STEROID_CREAM.test(sentence) || RX_SKIN.test(sentence)) && APPLY.test(sentence) && !warned && !SKIN_WARNING.test(sentence))
      problems.add('Never suggest steroid creams (Betnovate, Panderm, Quadriderm…) or prescription skin treatments — warn that they damage skin and send them to a dermatologist.');
    const crash = sentence.match(CRASH);
    if (crash && !warned) {
      const weeks = /din|day/i.test(crash[3]!) ? Number(crash[2]) / 7 : Number(crash[2]);
      if (weeks > 0 && Number(crash[1]) / weeks > 1) problems.add('Never promise fast weight loss ("X kg in Y days") — safe is about 0.5–1 kg a week.');
    }
    if (LOW_CALORIES.test(sentence) && DIET_CONTEXT.test(sentence) && !NOT_A_TOTAL.test(sentence) && !warned)
      problems.add('Never give a diet under about 1,200 kcal a day.');
  }
  return [...problems];
}
