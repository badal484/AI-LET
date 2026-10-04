import { isRomanticPhrase } from './romanceMoments.js';
/**
 * User first: the chat is about them. Seen with Nandini — "Hii" got her hotel-lobby news, "Congratulations"
 * got her layouts, "Oo" got more lobby, and "boyfriend h?" got two shades of white paint. These helpers tell
 * when she's talking about herself, so the engine can hold her own life back and the editor can send a
 * self-centred draft back.
 */

// Sentences about her: "main…", "mera/meri…", "mujhe…", "maine…", "I…", "my…".
const SELF = /\b(main|mai|mein|mera|meri|mere|mujhe|mujhko|maine|apna|apni|i|i'm|im|my|me)\b/i;
// Sentences about them: "tum/tumhara/tumhe…", "aap…", "you/your…".
const THEM = /\b(tum|tumhara|tumhari|tumhare|tumhe|tumhein|tumko|tumne|aap|aapka|aapki|aapko|aapne|you|your|u|ur)\b/i;
// "main yahin hoon", "main sun rahi hoon" are about being there for them, not about her life.
const PRESENT_FOR_THEM = /\b(main|mai)\s+(yahin|yahan|hoon na|sun rahi|sun raha|samajh (sakti|sakta)|saath)\b/i;

/** Mostly about herself: at least two sentences about her and none about them. */
export function isAboutHerself(text: string): boolean {
  // "thank you" is politeness, not talking about them.
  const sentences = text
    .replace(/\b(thank\s*(you|u)|thanks|thanku|thnx)\b/gi, '')
    .split(/(?<=[.!?…\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
  const self = sentences.filter((s) => SELF.test(s) && !THEM.test(s) && !PRESENT_FOR_THEM.test(s)).length;
  const them = sentences.filter((s) => THEM.test(s)).length;
  return self >= 2 && them === 0;
}

/** They asked about her ("tum kya kar rahi ho?", "apne baare mein batao", "what do you do?"). */
export const ASKS_ABOUT_HER =
  /\b(tum|aap|you|u)\b[^?]*\?|\b(apne|apni|tumhare|tumhari|aapke|aapki|your)\b.{0,25}\b(baare|bare|family|kaam|work|din|day|life|job)\b|\b(kya kar rahi|kya kar rahe|kya chal raha|kaisi ho|kaise ho|wbu|hbu|aur tum|aur aap|tell me about you)\b|\b(purana chapter|old chapter|ex\b|pehle wala|pehli wali|breakup|kahani|story|phir kya hua|uske baad kya|kya hua tha|batao na|aur batao na|aage batao|then what|what happened)/i;

/** A one-word answer right after she talked about herself: they're not into that topic. */
export function boredByHerTalk(userText: string, herLastReply: string | undefined): boolean {
  const t = userText.trim().toLowerCase();
  const tiny = /^(o+|oo+|ohh*|acha+|achha+|accha+|ok+|okay|k|hmm+|hm+|nice|cool|achha ji|accha ji|ohk|okk|👍|🙂|😐)[\s.!?]*$/.test(t);
  return tiny && Boolean(herLastReply) && isAboutHerself(herLastReply!);
}

const HINDI_HINT = /\b(hai|hain|hoon|hu|h|kya|nahi|nahin|nhi|tum|tumhe|aap|mera|meri|mujhe|aaj|kal|kar|karo|karu|karun|raha|rahi|gaya|gayi|bhi|toh|yaar|kuch|bahut|sab|yesab|abhi|achha|accha|kaise|kaisa|batao|mein|ho|haan|na|bhai|kaun|kahan|kitna|kitni|baar|mana|mat|baat|bolun|bollun|bolu|kyu|kyun|wala|wali|kiye|kiya|gaye|tha|thi|ke|ki|ka|ko|se|pe|par|aur|ab|phir|jab|tab|lekin|matlab|sach)\b/i;

// English grammar words: an English sentence is full of these; Hinglish ("Kitna baar mana karu") has none.
const EN_GRAMMAR = new Set('the a an is are was were am be been do does did i you he she it we they my your me him her us them what how why when where who which this that these those then than to of in on at for with from and but or not no can could will would should have has had just so very there here'.split(' '));

/** One message, judged on its own: clearly English (grammar words, no Hindi). */
export function isEnglish(text: string): boolean {
  if (isRomanticPhrase(text) || /[\u0900-\u097F]/.test(text) || HINDI_HINT.test(text)) return false;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length < 3) return false;
  const grammar = words.filter((w) => EN_GRAMMAR.has(w)).length;
  return grammar >= 2 || grammar / words.length >= 0.3;
}

/** The language of the conversation: English only when they clearly write English (the last two, or most of
 * their recent messages) — one English-looking line in a Hinglish chat doesn't flip it. */
export function conversationLanguage(recentUserTexts: string[]): 'english' | 'hinglish' {
  const recent = recentUserTexts.filter((t) => t.trim().split(/\s+/).length >= 2).slice(-5);
  if (!recent.length) return 'hinglish';
  const english = recent.map(isEnglish);
  const lastTwo = english.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(Boolean)) return 'english';
  return english.filter(Boolean).length > recent.length / 2 ? 'english' : 'hinglish';
}

/** Kept for callers that only have the current message. */
export const writesEnglish = (text: string): boolean => isEnglish(text);

/** Full English sentences in a reply ("you just made my heart skip a beat") — for someone who writes Hinglish. */
export function englishSentences(reply: string): string[] {
  return reply
    .split(/(?<=[.!?…\n—])\s*/)
    .map((x) => x.trim())
    .filter((x) => x.split(/\s+/).length >= 5 && /[a-z]/i.test(x) && !HINDI_HINT.test(x));
}

/** They've been writing Hinglish (any of their last few messages has Hindi words). */
export const talksHinglish = (recentUserTexts: string[]): boolean => recentUserTexts.some((t) => HINDI_HINT.test(t));

/**
 * "Not now" — they pushed the topic she was raising away. Seen with Dev: "Yesab baad mein baat karte h",
 * "Aaj yesab baat mat karo kitna baar bollun?", "Kitna baar mana karu" — and he asked about the task three more times.
 */
export const REFUSES_TOPIC =
  /(baad mein (baat )?(karte|karenge|karna|karo|kar lenge|dekhte|dekhenge)|(aaj|abhi) (ye ?sab|yesab|ye|is|iske) (baare mein )?(baat |baatein )?mat|ye ?sab (baat |baatein )?mat (karo|poocho|pucho)|\bmat (poocho|pucho|puchho)\b|kitn[ai] (baar|bar) (bol|mana|kah|bata)|\bdrop it\b|\bnot now\b|^\s*(abhi|aaj) nahi( yaar| na| please| bhai)?\s*[.!?]*$|chhodo (ye|isko|is baat)|ye ?sab chhodo|is (baare|topic) (mein|pe) (baat )?mat|band karo ye|(iske|is) baare mein (baat )?(mat|na) karo|don'?t (ask|talk about) (that|it|this)|stop asking)/i;

const TOPIC_STOP = new Set(
  'karein karenge karna karte chahiye matlab waise pichli pichle tumhara tumhari tumhare kaisa kaise kaisi abhi bataoge batao achha accha thoda thodi uska uski unka focus wahan yahan baare status naam input print kaise dekhte simple banana likho likhna humari humara hamara'.split(' '),
);

/** What the pushed topic was about: distinctive words of her last message (code names, "task", "lesson"…). */
export function topicWordsOf(text: string): string[] {
  const words = text.match(/[A-Za-z][A-Za-z0-9_]+/g) ?? [];
  const keep = words
    .filter((w) => w.length >= 5 || /^(task|code|lesson|quiz|list|album|ghar|case)$/i.test(w) || /[a-z][A-Z]/.test(w))
    .map((w) => w.toLowerCase())
    .filter((w) => !TOPIC_STOP.has(w));
  return [...new Set(keep)].slice(0, 8);
}
