import { describe, it, expect, beforeEach } from 'vitest';
import { SentenceBuffer } from '../src/modules/voice/services/SentenceBuffer.js';

describe('SentenceBuffer', () => {
  let buffer: SentenceBuffer;

  beforeEach(() => {
    buffer = new SentenceBuffer({ minChunkLength: 10, maxChunkLength: 150 });
  });

  it('buffers tokens and returns sentences on terminal punctuation (. ! ?)', () => {
    const s1 = buffer.push('Hello ');
    expect(s1).toEqual([]);

    const s2 = buffer.push('there! ');
    expect(s2).toEqual(['Hello there!']);

    const s3 = buffer.push('How are ');
    expect(s3).toEqual([]);

    const s4 = buffer.push('you doing today? ');
    expect(s4).toEqual(['How are you doing today?']);
  });

  it('handles multiple sentences in a single large token push', () => {
    const sentences = buffer.push('First sentence. Second sentence! Third one?');
    expect(sentences).toEqual(['First sentence.', 'Second sentence!', 'Third one?']);
  });

  it('splits on clause punctuation (, ;) if text exceeds minChunkLength', () => {
    const sentences = buffer.push('When we consider the full picture of this conversation, ');
    expect(sentences.length).toBe(1);
    expect(sentences[0]).toContain('When we consider the full picture of this conversation,');
  });

  it('flushes remaining unpunctuated text on flush()', () => {
    const s1 = buffer.push('And then we left without saying goodbye');
    expect(s1).toEqual([]);

    const remaining = buffer.flush();
    expect(remaining).toBe('And then we left without saying goodbye');
  });

  it('clears buffer on clear() without emitting pending text (for barge-in)', () => {
    buffer.push('This should be discarded upon interrupt');
    expect(buffer.getRawBuffer()).toBe('This should be discarded upon interrupt');

    buffer.clear();
    expect(buffer.getRawBuffer()).toBe('');
    expect(buffer.flush()).toBeNull();
  });
});
