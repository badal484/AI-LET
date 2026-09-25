export interface TTSOptions {
  voiceId?: string;
  language?: string;
  speed?: number;
  pitch?: number;
  stability?: number;
  speakingStyle?: string;
  sampleRate?: number;
  format?: 'pcm16' | 'mp3' | 'opus' | 'wav';
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer;
  format: string;
  sampleRate: number;
  durationSeconds: number;
  charactersCount: number;
  latencyMs: number;
  costUsd: number;
}

export interface TTSSpeechChunk {
  audioChunk: Buffer;
  sequence: number;
  isFinal: boolean;
  sampleRate: number;
  format: string;
}

export interface ITextToSpeechProvider {
  readonly providerName: string;

  /**
   * Synthesizes a text string into an audio buffer.
   */
  synthesize(text: string, options: TTSOptions): Promise<TTSSynthesisResult>;

  /**
   * Streams audio chunks in real-time as text is provided or processed.
   */
  streamSynthesis(
    text: string,
    options: TTSOptions,
    onChunk: (chunk: TTSSpeechChunk) => void,
    signal?: AbortSignal
  ): Promise<TTSSynthesisResult>;
}
