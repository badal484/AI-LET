import { describe, expect, it } from 'vitest';
import { planReply } from '../../src/modules/conversations/human/compactPrompt.js';
import { personaPackFor } from '../../src/modules/conversations/human/personaPacks/index.js';
import { classifySituations } from '../../src/modules/conversations/human/situation.js';
import { StreamingChatService } from '../../src/modules/conversations/services/streamingChat.service.js';

// Seen live with Aanya: after she said no, "Katti" and "Baat nahi karna ab tumse" got
// "jab mann ho tab baat kar lena" — she let them go instead of winning them back.
describe('Sulking at her', () => {
  it.each(['Katti', 'katti hai tumse', 'Baat nahi karna ab tumse', 'tumse baat nahi karni', 'naraz hoon', 'tumse naraz hoon', 'gussa hoon', 'hmph', 'not talking to you'])(
    '"%s" is sulking',
    (text) => {
      expect(classifySituations(text, 0.1)[0]).toBe('sulk');
    },
  );

  it.each(['boss pe gussa hoon', 'mummy naraz hai', 'aaj din bura tha', 'tum boring ho', 'kal baat karte hain'])('"%s" is not sulking at her', (text) => {
    expect(classifySituations(text, 0.1)).not.toContain('sulk');
  });

  it('a girlfriend goes after them and finds the reason — no "jab mann ho" exit', () => {
    const plan = planReply(['sulk'], [], personaPackFor('aanya-mehta')!, {});
    expect(plan.moves).toMatch(/manana/);
    expect(plan.moves).toMatch(/PLAYFULLY/);
    expect(plan.moves).toMatch(/never begging/);
    expect(plan.moves).toMatch(/look at your last few messages/);
    expect(plan.moves).toMatch(/the no stays/);
    expect(plan.moves).toMatch(/never "jab mann ho baat karna"/i);
    expect(plan.ask).toBe(true);
  });

  it('a best friend pulls them back with a loving roast', () => {
    expect(planReply(['sulk'], [], personaPackFor('vishnu')!, {}).moves).toMatch(/best friend is sulking/);
  });

  it('no story or life update in the middle of making up', () => {
    const plan = planReply(['sulk'], [], personaPackFor('aanya-mehta')!, { continuity: { storyBeat: 'my exhibition', followUp: undefined } as never });
    expect(plan.storyBeat).toBeUndefined();
  });
});

describe('Bubble marker', () => {
  it('"[next]" with one bracket also splits, never shows as text (seen with Kiara)', () => {
    const split = (StreamingChatService as unknown as { splitBubbles: (t: string) => string[] }).splitBubbles.bind(StreamingChatService);
    expect(split('arre katti kyu? [next] sorry na 🥺')).toEqual(['arre katti kyu?', 'sorry na 🥺']);
    expect(split('ek [[next]] do')).toEqual(['ek', 'do']);
  });
});
