import { ISpeechToTextProvider, STTOptions, STTTranscriptionResult } from './ISpeechToTextProvider.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../config/logger.js';

export class OpenAISTTProvider implements ISpeechToTextProvider {
  public readonly providerName = 'openai';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'] || '';
  }

  public async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTTranscriptionResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      logger.warn('[OpenAISTTProvider] No API key configured, falling back to mock transcription');
      const durationMs = Math.max(500, Math.floor((audioBuffer.length / 48000) * 1000));
      return {
        transcript: 'Hello, how can I help you today?',
        confidence: 0.95,
        language: options?.language || 'en',
        isFinal: true,
        durationMs,
        costUsd: (durationMs / 60000) * SYSTEM_CONSTANTS.VOICE.PRICING.STT_PER_MINUTE_USD.OPENAI_WHISPER,
      };
    }

    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'audio.wav');
      formData.append('model', 'whisper-1');
      if (options?.language) {
        formData.append('language', options.language);
      }
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
      }

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI STT failed with status ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as { text: string; language?: string; duration?: number };
      const durationMs = data.duration ? Math.floor(data.duration * 1000) : Date.now() - startTime;
      const costUsd = (durationMs / 60000) * SYSTEM_CONSTANTS.VOICE.PRICING.STT_PER_MINUTE_USD.OPENAI_WHISPER;

      return {
        transcript: data.text || '',
        confidence: 0.95,
        language: data.language || options?.language || 'en',
        isFinal: true,
        durationMs,
        costUsd,
      };
    } catch (err: any) {
      logger.error(`[OpenAISTTProvider] Transcription error: ${err.message}`);
      throw err;
    }
  }
}
