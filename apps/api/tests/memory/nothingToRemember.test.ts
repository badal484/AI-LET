import { describe, expect, it } from 'vitest';
import { nothingToRemember } from '../../src/modules/memory/services/nothingToRemember.js';

describe('Memory calls are skipped only when there is nothing to remember', () => {
  it.each(['hmm', 'haha 😂', 'acha', 'ok yaar', 'good night jaan', 'kya kar rahi ho?', '😂😂', 'theek hai', 'nice yaar'])('"%s" → skip', (t) => {
    expect(nothingToRemember(t)).toBe(true);
  });
  it.each(['naukri mil gayi', 'exam kal hai', '12 ko birthday hai', 'main pune mein rehta hoon', 'papa bimar hain', 'breakup ho gaya yaar', 'interview clear'])('"%s" → remember', (t) => {
    expect(nothingToRemember(t)).toBe(false);
  });
});
