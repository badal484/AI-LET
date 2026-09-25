import { ISpeechToTextProvider, STTOptions, STTTranscriptionResult } from './ISpeechToTextProvider.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class MockSTTProvider implements ISpeechToTextProvider {
  public readonly providerName = 'mock';

  public async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTTranscriptionResult> {
    const durationMs = Math.max(500, Math.min(10000, Math.floor((audioBuffer.length / 48000) * 1000)));
    const durationMinutes = durationMs / 60000;
    const costUsd = durationMinutes * SYSTEM_CONSTANTS.VOICE.PRICING.STT_PER_MINUTE_USD.MOCK;

    // Simulate realistic response
    return {
      transcript: 'Hello, how are you doing today?',
      confidence: 0.98,
      language: options?.language || 'en',
      isFinal: true,
      durationMs,
      words: [
        { word: 'Hello,', startMs: 0, endMs: 300, confidence: 0.99 },
        { word: 'how', startMs: 310, endMs: 500, confidence: 0.98 },
        { word: 'are', startMs: 510, endMs: 650, confidence: 0.97 },
        { word: 'you', startMs: 660, endMs: 800, confidence: 0.99 },
        { word: 'doing', startMs: 810, endMs: 1100, confidence: 0.98 },
        { word: 'today?', startMs: 1110, endMs: 1400, confidence: 0.97 },
      ],
      costUsd,
    };
  }

  public async streamTranscription(
    audioStream: AsyncIterable<Buffer>,
    options?: STTOptions & { onInterim?: (result: STTTranscriptionResult) => void },
    signal?: AbortSignal
  ): Promise<STTTranscriptionResult> {
    let totalBytes = 0;
    let interimCounter = 0;

    for await (const chunk of audioStream) {
      if (signal?.aborted) {
        throw new Error('STT stream aborted');
      }
      totalBytes += chunk.length;
      interimCounter++;

      if (options?.onInterim && interimCounter % 2 === 0) {
        options.onInterim({
          transcript: 'Hello, how are you...',
          confidence: 0.85,
          language: options.language || 'en',
          isFinal: false,
        });
      }
    }

    const durationMs = Math.max(500, Math.floor((totalBytes / 48000) * 1000));
    return {
      transcript: 'Hello, how are you doing today?',
      confidence: 0.98,
      language: options?.language || 'en',
      isFinal: true,
      durationMs,
      costUsd: (durationMs / 60000) * SYSTEM_CONSTANTS.VOICE.PRICING.STT_PER_MINUTE_USD.MOCK,
    };
  }
}
