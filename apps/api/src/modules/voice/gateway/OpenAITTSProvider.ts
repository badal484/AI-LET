import { ITextToSpeechProvider, TTSOptions, TTSSynthesisResult, TTSSpeechChunk } from './ITextToSpeechProvider.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../config/logger.js';

export class OpenAITTSProvider implements ITextToSpeechProvider {
  public readonly providerName = 'openai';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'] || '';
  }

  public async synthesize(text: string, options: TTSOptions): Promise<TTSSynthesisResult> {
    const startTime = Date.now();
    const chars = text.length;

    if (!this.apiKey) {
      logger.warn('[OpenAITTSProvider] No API key configured, falling back to simulated speech synthesis');
      const durationSeconds = Math.max(0.5, chars / 15);
      const sampleRate = options.sampleRate || SYSTEM_CONSTANTS.VOICE.DEFAULT_SAMPLE_RATE;
      const buffer = Buffer.alloc(Math.floor(sampleRate * 2 * durationSeconds), 0);
      const costUsd = (chars / 1000) * SYSTEM_CONSTANTS.VOICE.PRICING.TTS_PER_1K_CHARS_USD.OPENAI_TTS_1;

      return {
        audioBuffer: buffer,
        format: options.format || 'pcm16',
        sampleRate,
        durationSeconds,
        charactersCount: chars,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    }

    try {
      const model = 'tts-1';
      const voice = options.voiceId || 'alloy';
      const speed = options.speed || 1.0;

      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: options.format === 'mp3' ? 'mp3' : 'pcm',
          speed,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI TTS synthesis failed (${res.status}): ${errorText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const sampleRate = options.sampleRate || 24000;
      const durationSeconds = Math.max(0.5, audioBuffer.length / (sampleRate * 2));
      const costUsd = (chars / 1000) * SYSTEM_CONSTANTS.VOICE.PRICING.TTS_PER_1K_CHARS_USD.OPENAI_TTS_1;

      return {
        audioBuffer,
        format: options.format || 'pcm16',
        sampleRate,
        durationSeconds,
        charactersCount: chars,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    } catch (err: any) {
      logger.error(`[OpenAITTSProvider] Error: ${err.message}`);
      throw err;
    }
  }

  public async streamSynthesis(
    text: string,
    options: TTSOptions,
    onChunk: (chunk: TTSSpeechChunk) => void,
    signal?: AbortSignal
  ): Promise<TTSSynthesisResult> {
    const startTime = Date.now();
    const chars = text.length;

    if (!this.apiKey) {
      const sampleRate = options.sampleRate || SYSTEM_CONSTANTS.VOICE.DEFAULT_SAMPLE_RATE;
      const durationSeconds = Math.max(0.5, chars / 15);
      const chunkSize = SYSTEM_CONSTANTS.VOICE.CHUNK_SIZE_BYTES;
      const totalBytes = Math.floor(sampleRate * 2 * durationSeconds);
      const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));
      const fullBuffer = Buffer.alloc(totalBytes, 0);

      for (let i = 0; i < totalChunks; i++) {
        if (signal?.aborted) {
          throw new Error('TTS stream synthesis aborted');
        }
        const isFinal = i === totalChunks - 1;
        const start = i * chunkSize;
        const end = Math.min(totalBytes, start + chunkSize);
        onChunk({
          audioChunk: fullBuffer.subarray(start, end),
          sequence: i + 1,
          isFinal,
          sampleRate,
          format: options.format || 'pcm16',
        });
      }

      return {
        audioBuffer: fullBuffer,
        format: options.format || 'pcm16',
        sampleRate,
        durationSeconds,
        charactersCount: chars,
        latencyMs: Date.now() - startTime,
        costUsd: (chars / 1000) * SYSTEM_CONSTANTS.VOICE.PRICING.TTS_PER_1K_CHARS_USD.OPENAI_TTS_1,
      };
    }

    const result = await this.synthesize(text, options);
    const chunkSize = SYSTEM_CONSTANTS.VOICE.CHUNK_SIZE_BYTES;
    const totalChunks = Math.max(1, Math.ceil(result.audioBuffer.length / chunkSize));

    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) {
        throw new Error('TTS stream synthesis aborted');
      }
      const isFinal = i === totalChunks - 1;
      const start = i * chunkSize;
      const end = Math.min(result.audioBuffer.length, start + chunkSize);
      onChunk({
        audioChunk: result.audioBuffer.subarray(start, end),
        sequence: i + 1,
        isFinal,
        sampleRate: result.sampleRate,
        format: result.format,
      });
    }

    return result;
  }
}
