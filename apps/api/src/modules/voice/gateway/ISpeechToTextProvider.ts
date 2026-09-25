export interface STTWordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface STTTranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  isFinal: boolean;
  durationMs?: number;
  words?: STTWordTimestamp[];
  costUsd?: number;
}

export interface STTOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
}

export interface ISpeechToTextProvider {
  readonly providerName: string;

  /**
   * Transcribe an audio buffer (e.g. PCM 16-bit 24kHz/16kHz, WAV, WebM)
   */
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTTranscriptionResult>;

  /**
   * Optional streaming speech recognition
   */
  streamTranscription?(
    audioStream: AsyncIterable<Buffer>,
    options?: STTOptions & { onInterim?: (result: STTTranscriptionResult) => void },
    signal?: AbortSignal
  ): Promise<STTTranscriptionResult>;
}
