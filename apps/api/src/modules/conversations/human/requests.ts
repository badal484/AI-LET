/**
 * Open requests — she remembers what you asked for. A real mentor may ask one quick thing first
 * ("pehla wala chala ke dekha?"), but once you answer, they send what you asked for themselves; you never
 * have to ask twice. (From a real Dev chat: "Next code" → a question → "Run kar rha h" → "sahi hai!", no code.)
 */
export interface OpenRequest {
  /** What they asked for, in their words. */
  what: string;
  /** 'code' is delivered by a code box; anything else by a real answer (plan, list, ideas…). */
  kind: 'code' | 'deliverable';
  at: number;
  /** She already used her one question / stall: the next reply must deliver. */
  asked?: boolean;
}

const OPEN_FOR_MS = 6 * 3_600_000;

const ASKS_FOR_CODE = /\b(code|script|snippet|program|implement)\b|\bnext (code|step|part|wala)\b/i;
const THING = /\b(plan|diet|routine|schedule|list|ideas?|roadmap|resume|cv|template|example|examples|recipe|steps|caption|captions|pitch|email|message|reply|post|script|outline|tips?|exercises?|questions|shayari|sher|poem|poetry|kavita|lyrics|song|gaana|gaane|story|kahani|joke|jokes|quote|quotes|wish|wishes|bio|status|playlist|names?)\b/i;
const ASK_VERB = /\b(bana|banao|bana do|bana de|likh|likho|likh do|bhej|bhejo|bhej do|de do|dedo|do na|dijiye|chahiye|batao|give|send|share|make|write|suggest|next|aur ek|ek aur)\b/i;

/** "Next code", "diet plan bana do", "5 video ideas do" — something she should hand over. */
export function detectRequest(text: string, opts: { codeDomain: boolean }, now = Date.now()): OpenRequest | null {
  const t = text.trim();
  if (opts.codeDomain && ASKS_FOR_CODE.test(t)) return { what: t.slice(0, 140), kind: 'code', at: now };
  // "3 photo ideas do", "tips de": a bare "do"/"de" right after the thing asks for it.
  const bareAsk = new RegExp(`${THING.source}.{0,25}\\b(do|de|dena|dijiye)\\b`, 'i');
  if (THING.test(t) && (ASK_VERB.test(t) || bareAsk.test(t))) return { what: t.slice(0, 140), kind: 'deliverable', at: now };
  return null;
}

export function stillOpen(request: OpenRequest | undefined, now = Date.now()): OpenRequest | undefined {
  return request && now - request.at < OPEN_FOR_MS ? request : undefined;
}

/** The model marks a delivered request with a hidden last line "[[delivered]]". */
export function extractDeliveredTag(text: string): { text: string; delivered: boolean } {
  let delivered = false;
  const cleaned = text.replace(/\[\[\s*delivered\s*\]\]/gi, () => {
    delivered = true;
    return '';
  });
  return { text: cleaned.trim(), delivered };
}

/** Did this reply actually hand over what was asked? */
export function wasDelivered(request: OpenRequest, reply: { bubbles: string[]; codeBlocks: number; tagged: boolean }): boolean {
  if (request.kind === 'code') return reply.codeBlocks > 0;
  if (reply.tagged) return true;
  // A real answer: several list lines, or a substantial reply that isn't just a question back.
  const all = reply.bubbles.join('\n');
  const listLines = all.split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length;
  const endsWithQuestion = /\?\s*\p{Extended_Pictographic}?\s*$/u.test((reply.bubbles[reply.bubbles.length - 1] ?? '').trim());
  return listLines >= 3 || (all.length >= 350 && !endsWithQuestion);
}
