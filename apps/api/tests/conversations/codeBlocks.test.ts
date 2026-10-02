import { describe, expect, it } from 'vitest';
import { extractCode, isCodeBubble, looksLikeUnfencedCode, restoreCode } from '../../src/modules/conversations/human/codeBlocks.js';
import { checkReply } from '../../src/modules/conversations/human/replyChecker.js';

const script = 'import os\nfrom openai import OpenAI\n\nwith open("error.log", "r") as f:\n    log = f.read()\n# comment stays\nprint(log)';

/** From a real Dev chat: a Python script arrived as one paragraph with its lines and indentation lost. */
describe('Code reaches the user exactly as written', () => {
  it('takes code out before the chat cleanup and puts it back untouched, as its own message', () => {
    const reply = `ye lo, chhota sa script\n\`\`\`python\n${script}\n\`\`\`\nisey run karne se pehle key set karna`;
    const { text, blocks } = extractCode(reply);
    expect(blocks).toEqual([{ lang: 'python', code: script }]);
    expect(text).not.toContain('import os');
    const bubbles = restoreCode(text.split('\n').map((l) => l.trim()).filter(Boolean), blocks);
    expect(bubbles).toEqual(['ye lo, chhota sa script', `\`\`\`python\n${script}\n\`\`\``, 'isey run karne se pehle key set karna']);
    expect(isCodeBubble(bubbles[1]!)).toBe(true);
    // Indentation, blank lines and "#" comments survive.
    expect(bubbles[1]).toContain('\n    log = f.read()\n# comment stays\n');
  });

  it('keeps a block that was cut off at the end', () => {
    const { blocks } = extractCode('code:\n```js\nconst a = 1;\nconsole.log(a)');
    expect(blocks[0]?.code).toBe('const a = 1;\nconsole.log(a)');
  });

  it('asks for a rewrite when code is pasted as plain text', () => {
    expect(looksLikeUnfencedCode('import os\nfrom openai import OpenAI\nclient = OpenAI(api_key=key)')).toBe(true);
    expect(looksLikeUnfencedCode('```python\nimport os\nprint(1)\n```')).toBe(false);
    expect(looksLikeUnfencedCode('kal ka plan kya hai?\nbas chill')).toBe(false);
    const r = checkReply({ bubbles: ['import os', 'client = OpenAI(api_key=key)'], herRecentReplies: [], gender: 'male', mode: 'task' });
    expect(r.ok).toBe(false);
  });
});
