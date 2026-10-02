/**
 * People here text Hindi in Roman letters (Hinglish). A reply that slips into Devanagari mid-sentence
 * ("chupचाप baithna") looks broken. If they don't write in Devanagari themselves, the reply mustn't either;
 * as a last resort, Devanagari is spelled out in Roman letters the way people text it.
 */
const DEVANAGARI = /[ऀ-ॿ]/;

export const hasDevanagari = (text: string): boolean => DEVANAGARI.test(text);

const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh',
  ष: 'sh', स: 's', ह: 'h', ळ: 'l',
};
const NUKTA_FORMS: Record<string, string> = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'd', ढ: 'dh', फ: 'f', य: 'y' };
const VOWELS: Record<string, string> = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o' };
const MATRAS: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const MARKS: Record<string, string> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h', '।': '.', '॥': '.' };
const NUKTA = '़';
const VIRAMA = '्';
const isDevLetter = (c: string | undefined) => !!c && DEVANAGARI.test(c);

/** "चाप" → "chaap", "बैठना" → "baithna". Good enough for a rare slip; not a full transliterator. */
export function romanizeDevanagari(text: string): string {
  const chars = [...text];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (CONSONANTS[c]) {
      let base = CONSONANTS[c]!;
      let j = i + 1;
      if (chars[j] === NUKTA) {
        base = NUKTA_FORMS[c] ?? base;
        j++;
      }
      out += base;
      const next = chars[j];
      if (next && MATRAS[next]) {
        // A final "ा" is written as a single "a" in texting ("baithna", not "baithanaa").
        const wordEnds = !isDevLetter(chars[j + 1]);
        out += wordEnds && next === 'ा' ? 'a' : wordEnds && next === 'ी' ? 'i' : MATRAS[next];
        i = j;
      } else if (next === VIRAMA) {
        i = j;
      } else {
        // Inherent "a": dropped at the end of a word and before a following consonant+vowel sign pattern.
        const wordEnds = !isDevLetter(next);
        const wordStarts = !isDevLetter(chars[i - 1]);
        if (!wordEnds && (wordStarts || !(CONSONANTS[next ?? ''] && MATRAS[chars[j + 1] ?? '']))) out += 'a';
        i = j - 1;
      }
    } else if (VOWELS[c]) {
      out += VOWELS[c];
    } else if (MATRAS[c]) {
      out += MATRAS[c];
    } else if (MARKS[c]) {
      out += MARKS[c];
    } else if (c >= '०' && c <= '९') {
      out += String(c.charCodeAt(0) - '०'.charCodeAt(0));
    } else if (c !== NUKTA && c !== VIRAMA) {
      out += c;
    }
  }
  return out;
}

/**
 * People don't put side notes in brackets when they text: "…patch maange (PR baad mein karenge)" reads
 * like a document. A bracketed aside becomes part of the sentence ("… — PR baad mein karenge"). Code stays
 * as it is: a bracket right after a word (print("hi"), fix(bug)) or with code-like characters inside.
 */
export function unbracketAsides(text: string): string {
  return text.replace(/(\S?)(\s*)\(([^()\n]{2,90})\)/g, (match, before: string, space: string, inner: string, offset: number, all: string) => {
    const isCall = before !== '' && space === '' && /[\w'"\]]/.test(before);
    const looksLikeCode = /[=;{}<>`_\\/]|\w\.\w|=>|\w\(/.test(inner);
    if (isCall || looksLikeCode) return match;
    // Mid-sentence it needs a dash on both sides; at the end of a sentence, one is enough.
    const after = all.slice(offset + match.length);
    const midSentence = /^\s*[^\s.!?,;:—–-]/.test(after);
    return `${before} — ${inner.trim()}${midSentence ? ' —' : ''}`;
  });
}
