import { describe, expect, it } from 'vitest';
import { detectRequest, extractDeliveredTag, stillOpen, wasDelivered } from '../../src/modules/conversations/human/requests.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';

/** From a real Dev chat: "Next code" → "pehla wala chala ke dekha?" → "Run kar rha h" → "sahi hai!" (no code). */
describe('She remembers what you asked for', () => {
  it('notices requests', () => {
    expect(detectRequest('Next code', { codeDomain: true })?.kind).toBe('code');
    expect(detectRequest('can you give me code?', { codeDomain: true })?.kind).toBe('code');
    expect(detectRequest('mere liye diet plan bana do', { codeDomain: false })?.kind).toBe('deliverable');
    expect(detectRequest('5 video ideas do na', { codeDomain: false })?.kind).toBe('deliverable');
    expect(detectRequest('Run kar rha h', { codeDomain: true })).toBeNull();
    expect(detectRequest('code samajh nahi aaya', { codeDomain: false })).toBeNull();
  });

  it('a request expires after a few hours', () => {
    const r = { what: 'Next code', kind: 'code' as const, at: Date.now() - 7 * 3_600_000 };
    expect(stillOpen(r)).toBeUndefined();
    expect(stillOpen({ ...r, at: Date.now() })).toBeDefined();
  });

  it('knows when it was really handed over', () => {
    const code = { what: 'Next code', kind: 'code' as const, at: 0 };
    expect(wasDelivered(code, { bubbles: ['sahi hai!'], codeBlocks: 0, tagged: false })).toBe(false);
    expect(wasDelivered(code, { bubbles: ['ye lo', '```python\nprint(1)\n```'], codeBlocks: 1, tagged: false })).toBe(true);
    const plan = { what: 'diet plan bana do', kind: 'deliverable' as const, at: 0 };
    expect(wasDelivered(plan, { bubbles: ['veg ho ya non-veg?'], codeBlocks: 0, tagged: false })).toBe(false);
    expect(wasDelivered(plan, { bubbles: ['1. nashta: poha\n2. lunch: dal roti\n3. dinner: khichdi'], codeBlocks: 0, tagged: false })).toBe(true);
    expect(extractDeliveredTag('ye raha plan\n[[delivered]]')).toEqual({ text: 'ye raha plan', delivered: true });
  });

  it('after they answer her question, a reply without it is sent back', () => {
    const base = { herRecentReplies: [], gender: 'male' as const, mode: 'task' as const };
    expect(checkReply({ ...base, bubbles: ['sahi hai!'], mustDeliver: { what: 'Next code', delivered: false } }).ok).toBe(false);
    expect(checkReply({ ...base, bubbles: ['badhiya! ye lo next part'], mustDeliver: { what: 'Next code', delivered: true } }).ok).toBe(true);
  });
});
