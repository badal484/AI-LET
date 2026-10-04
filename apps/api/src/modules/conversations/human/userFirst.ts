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
  /\b(tum|aap|you|u)\b[^?]*\?|\b(apne|apni|tumhare|tumhari|aapke|aapki|your)\b.{0,25}\b(baare|bare|family|kaam|work|din|day|life|job)\b|\b(kya kar rahi|kya kar rahe|kya chal raha|kaisi ho|kaise ho|wbu|hbu|aur tum|aur aap|tell me about you)\b/i;

/** A one-word answer right after she talked about herself: they're not into that topic. */
export function boredByHerTalk(userText: string, herLastReply: string | undefined): boolean {
  const t = userText.trim().toLowerCase();
  const tiny = /^(o+|oo+|ohh*|acha+|achha+|accha+|ok+|okay|k|hmm+|hm+|nice|cool|achha ji|accha ji|ohk|okk|👍|🙂|😐)[\s.!?]*$/.test(t);
  return tiny && Boolean(herLastReply) && isAboutHerself(herLastReply!);
}
