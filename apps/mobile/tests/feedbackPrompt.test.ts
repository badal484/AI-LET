import { describe, expect, it } from 'vitest';
import { looksLikeRealHelp, mayAskHelpful } from '../src/utils/feedbackPrompt.js';

describe('"Helpful?" only after real help, at most once a day', () => {
  it('skips small talk', () => {
    expect(looksLikeRealHelp(['Bas sab badhiya, abhi ek client ka content calendar finalize kar rahi thi.', 'Tum batao, Instagram pe koi goal hai?'])).toBe(false);
  });

  it('asks after code, a list or a proper explanation', () => {
    expect(looksLikeRealHelp(['ye lo', '```python\nprint(1)\n```'])).toBe(true);
    expect(looksLikeRealHelp(['1. hook strong rakho\n2. hafte mein 3 reels\n3. saves pe focus'])).toBe(true);
    expect(looksLikeRealHelp(['x'.repeat(360)])).toBe(true);
  });

  it('not again within a day', () => {
    const now = Date.now();
    expect(mayAskHelpful(null, now)).toBe(true);
    expect(mayAskHelpful(now - 2 * 3_600_000, now)).toBe(false);
    expect(mayAskHelpful(now - 25 * 3_600_000, now)).toBe(true);
  });
});
