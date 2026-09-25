import { ITextToSpeechProvider, TTSOptions, TTSSynthesisResult, TTSSpeechChunk } from './ITextToSpeechProvider.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class MockTTSProvider implements ITextToSpeechProvider {
  public readonly providerName = 'mock';

  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const startTime = Date.now();
    const chars = text.length;
    // Produce dummy PCM 16-bit 24kHz audio (approx 120ms per 10 characters)
    const durationSeconds = Math.max(0.5, (chars / 15));
    const sampleRate = options.sampleRate || SYSTEM_CONSTANTS.VOICE.DEFAULT_SAMPLE_RATE;
    const totalBytes = Math.floor(sampleRate * 2 * durationSeconds); // 16-bit mono
    const dummyAudio = Buffer.alloc(totalBytes, 0);

    const costUsd = (chars / 1000) * SYSTEM_CONSTANTS.VOICE.PRICING.TTS_PER_1K_CHARS_USD.MOCK;

    return {
      audioBuffer: dummyAudio,
      format: options.format || 'pcm16',
      sampleRate,
      durationSeconds,
      charactersCount: chars,
      latencyMs: Date.now() - startTime,
      costUsd,
    };
  }

  public async streamSynthesis(
    text: string,
    options: TTSOptions = {},
    onChunk: (chunk: TTSSpeechChunk) => void,
    signal?: AbortSignal
  ): Promise<TTSSynthesisResult> {
    const startTime = Date.now();
    const chars = text.length;
    const sampleRate = options.sampleRate || SYSTEM_CONSTANTS.VOICE.DEFAULT_SAMPLE_RATE;
    const durationSeconds = Math.max(0.5, (chars / 15));
    const chunkSize = SYSTEM_CONSTANTS.VOICE.CHUNK_SIZE_BYTES;
    const totalBytes = Math.floor(sampleRate * 2 * durationSeconds);
    const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));

    const fullBuffer = Buffer.alloc(totalBytes, 0);

    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) {
        throw new Error('TTS stream synthesis cancelled');
      }

      const isFinal = i === totalChunks - 1;
      const start = i * chunkSize;
      const end = Math.min(totalBytes, start + chunkSize);
      const chunkBuffer = fullBuffer.subarray(start, end);

      onChunk({
        audioChunk: chunkBuffer,
        sequence: i + 1,
        isFinal,
        sampleRate,
        format: options.format || 'pcm16',
      });
    }

    const costUsd = (chars / 1000) * SYSTEM_CONSTANTS.VOICE.PRICING.TTS_PER_1K_CHARS_USD.MOCK;

    return {
      audioBuffer: fullBuffer,
      format: options.format || 'pcm16',
      sampleRate,
      durationSeconds,
      charactersCount: chars,
      latencyMs: Date.now() - startTime,
      costUsd,
    };
  }
}
