import { describe, expect, it } from 'vitest';
import { splitInlineCode } from '../src/utils/inlineCode.js';

describe('Inline code in chat texts', () => {
  it('shows `node app.js` as code, not backticks', () => {
    expect(splitInlineCode('yeh command chalao: `node app.js` aur dekho')).toEqual([
      { code: false, text: 'yeh command chalao: ' },
      { code: true, text: 'node app.js' },
      { code: false, text: ' aur dekho' },
    ]);
  });

  it('leaves plain text and a lone backtick alone', () => {
    expect(splitInlineCode('bas ek ` backtick')).toEqual([{ code: false, text: 'bas ek ` backtick' }]);
    expect(splitInlineCode('hi')).toEqual([{ code: false, text: 'hi' }]);
  });
});
