/**
 * Messages that carry nothing to remember — "hmm", "haha 😂", "acha", "good night jaan", "kya kar rahi ho" —
 * so the memory/profile AI calls are skipped (cost). Short news stays: "naukri mil gayi", "exam kal hai",
 * "12 ko birthday hai". When unsure, it says "remember" (a missed fact costs more than a call).
 */
const LIFE_WORDS =
  /\b(naukri|job|shaadi|marriage|exam|result|interview|birthday|bday|bimar|sick|hospital|doctor|breakup|promotion|salary|pass|fail|admission|college|school|office|boss|papa|mummy|mom|dad|bhai|behen|sister|brother|dost|friend|gf|bf|wife|husband|beta|beti|shift|move|shifting|ghar|city|trip|flight|ticket|loan|business|client|kal|parso|aaj|tomorrow|today|next|week|month|saal|year|pregnant|period|pcos|diabetes|bp|injury|dard|pain)\b/i;
const FILLER =
  /^(h+m+|hm+|ok+|okay|okk+|k+|acha+|accha+|achha+|theek( hai)?|thik( hai)?|haan+|ha+n*|hn|ji|nahi|no|yes|ya+|yeah|haha+|hehe+|lol|lmao|rofl|xd|wah+|wow|nice|cool|great|sahi( hai)?|badhiya|mast|done|thanks?|thank you|ty|gn|good ?night|good ?morning|gm|bye|byee+|tata|chalo|chal|sure|hello+|hi+|hey+|hii+|kya kar rah[ei] ho|kya chal raha( hai)?|kaise ho|kaisi ho|aur batao|aur sunao|kuch nahi|bas|kuch bhi)[\s!?.,]*(yaar|jaan|baby|ji|na|re)?[\s!?.,]*$/i;

export function nothingToRemember(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Only emojis / punctuation.
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  if (/\d/.test(t) || LIFE_WORDS.test(t)) return false;
  if (FILLER.test(t)) return true;
  // One or two words with no life news ("nice yaar", "uff") — nothing to keep.
  return t.split(/\s+/).length <= 2;
}
