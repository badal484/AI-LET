/**
 * Code must reach the user exactly as written. Chat cleanup is built for texts — it joins lines, drops
 * lines ending in ":" and removes "#" headings — which turned a Python script into one unusable
 * paragraph. So fenced code is taken out before any cleanup and put back untouched afterwards, as its
 * own message ("```python\n…\n```"), which the app shows in a code box with a Copy button.
 */
export interface CodeBlock {
  lang: string;
  code: string;
}

// Also catches a block cut off at the end (no closing fence) when the reply ran out of tokens.
const FENCE = /```([\w+#.-]*)[ \t]*\r?\n([\s\S]*?)(?:\r?\n?```|$)/g;
const PLACEHOLDER = /⟦CODE(\d+)⟧/g;

export function extractCode(text: string): { text: string; blocks: CodeBlock[] } {
  const blocks: CodeBlock[] = [];
  const replaced = text.replace(FENCE, (_m, lang: string, code: string) => {
    const trimmed = code.replace(/\s+$/, '');
    if (!trimmed.trim()) return '';
    blocks.push({ lang: (lang || '').toLowerCase(), code: trimmed });
    return `\n⟦CODE${blocks.length - 1}⟧\n`;
  });
  return { text: replaced, blocks };
}

export const isCodeBubble = (text: string): boolean => text.startsWith('```');

const fence = (b: CodeBlock) => `\`\`\`${b.lang}\n${b.code}\n\`\`\``;

/** Puts each code block back as its own message, in place; a block lost in trimming goes after the intro. */
export function restoreCode(bubbles: string[], blocks: CodeBlock[]): string[] {
  if (blocks.length === 0) return bubbles;
  const out: string[] = [];
  const used = new Set<number>();
  for (const bubble of bubbles) {
    let last = 0;
    for (const match of bubble.matchAll(PLACEHOLDER)) {
      const before = bubble.slice(last, match.index).trim();
      if (before) out.push(before);
      const block = blocks[Number(match[1])];
      if (block) {
        out.push(fence(block));
        used.add(Number(match[1]));
      }
      last = (match.index ?? 0) + match[0].length;
    }
    const rest = bubble.slice(last).trim();
    if (rest) out.push(rest);
  }
  const missing = blocks.filter((_b, i) => !used.has(i)).map(fence);
  if (missing.length) out.splice(Math.min(1, out.length), 0, ...missing);
  return out;
}

// Code pasted as plain text (no ``` fences): several lines that are clearly code.
const CODE_LINE = /^\s*(import |from \S+ import |def |class |const |let |var |function |return |if \(|for \(|while \(|async |await |print\(|console\.log\()|[;{}]\s*$|\)\s*:\s*$|^\s*[\w.]+\s*=\s*[\w.]+\(/;

export function looksLikeUnfencedCode(text: string): boolean {
  const outsideFences = text.replace(FENCE, '');
  return outsideFences.split('\n').filter((line) => CODE_LINE.test(line)).length >= 2;
}
