import { ISpeechToTextProvider, STTOptions, STTTranscriptionResult } from './ISpeechToTextProvider.js';
import { ITextToSpeechProvider, TTSOptions, TTSSynthesisResult, TTSSpeechChunk } from './ITextToSpeechProvider.js';
import { MockSTTProvider } from './MockSTTProvider.js';
import { MockTTSProvider } from './MockTTSProvider.js';
import { OpenAISTTProvider } from './OpenAISTTProvider.js';
import { OpenAITTSProvider } from './OpenAITTSProvider.js';
import { ElevenLabsTTSProvider } from './ElevenLabsTTSProvider.js';
import { logger } from '../../../config/logger.js';
import { ErrorCode, ErrorCodeType } from '@ai-companion/config';
import { AppError } from '../../../shared/errors/AppError.js';

export class VoiceGatewayError extends AppError {
  constructor(message: string, errorCode: ErrorCodeType = ErrorCode.VOICE_PROVIDER_UNAVAILABLE, statusCode: number = 502) {
    super(message, statusCode, errorCode);
    this.name = 'VoiceGatewayError';
  }
}

export class VoiceGateway {
  private static instance: VoiceGateway;

  private sttProviders: Map<string, ISpeechToTextProvider> = new Map();
  private ttsProviders: Map<string, ITextToSpeechProvider> = new Map();
  private providerFailures: Map<string, number> = new Map();

  private constructor() {
    // Register STT providers
    this.registerSTT(new MockSTTProvider());
    this.registerSTT(new OpenAISTTProvider());

    // Register TTS providers
    this.registerTTS(new MockTTSProvider());
    this.registerTTS(new OpenAITTSProvider());
    this.registerTTS(new ElevenLabsTTSProvider());
  }

  public static getInstance(): VoiceGateway {
    if (!VoiceGateway.instance) {
      VoiceGateway.instance = new VoiceGateway();
    }
    return VoiceGateway.instance;
  }

  public registerSTT(provider: ISpeechToTextProvider): void {
    this.sttProviders.set(provider.providerName.toLowerCase(), provider);
  }

  public registerTTS(provider: ITextToSpeechProvider): void {
    this.ttsProviders.set(provider.providerName.toLowerCase(), provider);
  }

  public getSTTProvider(preferredProvider: string = 'openai'): ISpeechToTextProvider {
    const pName = preferredProvider.toLowerCase();
    const provider = this.sttProviders.get(pName);

    if (provider) return provider;

    const mock = this.sttProviders.get('mock');
    if (mock) {
      logger.warn(`[VoiceGateway] STT provider '${preferredProvider}' not found, falling back to mock`);
      return mock;
    }

    throw new VoiceGatewayError(`No suitable STT provider found for '${preferredProvider}'`, ErrorCode.VOICE_STT_FAILED);
  }

  public getTTSProvider(preferredProvider: string = 'elevenlabs'): ITextToSpeechProvider {
    const pName = preferredProvider.toLowerCase();
    const provider = this.ttsProviders.get(pName);

    if (provider) return provider;

    const mock = this.ttsProviders.get('mock');
    if (mock) {
      logger.warn(`[VoiceGateway] TTS provider '${preferredProvider}' not found, falling back to mock`);
      return mock;
    }

    throw new VoiceGatewayError(`No suitable TTS provider found for '${preferredProvider}'`, ErrorCode.VOICE_TTS_FAILED);
  }

  /**
   * Transcribes audio buffer with automatic provider fallback if preferred provider errors.
   */
  public async transcribe(
    audioBuffer: Buffer,
    preferredProvider: string = 'openai',
    options?: STTOptions
  ): Promise<STTTranscriptionResult> {
    const providerList = [preferredProvider.toLowerCase(), 'mock'];
    let lastError: any = null;

    for (const pName of providerList) {
      try {
        const provider = this.getSTTProvider(pName);
        const result = await provider.transcribe(audioBuffer, options);
        // Reset failures on success
        this.providerFailures.set(pName, 0);
        return result;
      } catch (err: any) {
        lastError = err;
        const fails = (this.providerFailures.get(pName) || 0) + 1;
        this.providerFailures.set(pName, fails);
        logger.warn(`[VoiceGateway] STT Provider '${pName}' failed (${fails} consecutive errors): ${err.message}`);
      }
    }

    throw new VoiceGatewayError(
      `All STT providers failed: ${lastError?.message || 'Unknown error'}`,
      ErrorCode.VOICE_STT_FAILED
    );
  }

  /**
   * Streams speech-to-text transcription.
   */
  public async streamTranscription(
    audioStream: AsyncIterable<Buffer>,
    preferredProvider: string = 'openai',
    options?: STTOptions & { onInterim?: (result: STTTranscriptionResult) => void },
    signal?: AbortSignal
  ): Promise<STTTranscriptionResult> {
    const provider = this.getSTTProvider(preferredProvider);
    try {
      if (provider.streamTranscription) {
        return await provider.streamTranscription(audioStream, options, signal);
      }
      throw new Error(`Provider '${preferredProvider}' does not support streaming transcription`);
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      logger.warn(`[VoiceGateway] Streaming STT on '${preferredProvider}' failed, trying mock fallback: ${err.message}`);
      const mock = this.getSTTProvider('mock');
      if (mock.streamTranscription) {
        return await mock.streamTranscription(audioStream, options, signal);
      }
      throw new VoiceGatewayError('No streaming STT provider available', ErrorCode.VOICE_STT_FAILED);
    }
  }

  /**
   * Synthesizes audio with fallback support.
   */
  public async synthesize(
    text: string,
    preferredProvider: string = 'elevenlabs',
    options: TTSOptions = {}
  ): Promise<TTSSynthesisResult> {
    const providerList = [preferredProvider.toLowerCase(), 'openai', 'mock'];
    let lastError: any = null;

    for (const pName of providerList) {
      try {
        const provider = this.getTTSProvider(pName);
        const result = await provider.synthesize(text, options);
        this.providerFailures.set(pName, 0);
        return result;
      } catch (err: any) {
        lastError = err;
        const fails = (this.providerFailures.get(pName) || 0) + 1;
        this.providerFailures.set(pName, fails);
        logger.warn(`[VoiceGateway] TTS Provider '${pName}' failed (${fails} consecutive errors): ${err.message}`);
      }
    }

    throw new VoiceGatewayError(
      `All TTS providers failed: ${lastError?.message || 'Unknown error'}`,
      ErrorCode.VOICE_TTS_FAILED
    );
  }

  /**
   * Streams speech synthesis chunks in real time.
   */
  public async streamSynthesis(
    text: string,
    preferredProvider: string = 'elevenlabs',
    options: TTSOptions = {},
    onChunk: (chunk: TTSSpeechChunk) => void = () => {},
    signal?: AbortSignal
  ): Promise<TTSSynthesisResult> {
    const provider = this.getTTSProvider(preferredProvider);
    try {
      return await provider.streamSynthesis(text, options, onChunk, signal);
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      logger.warn(`[VoiceGateway] Streaming TTS on '${preferredProvider}' failed, trying mock fallback: ${err.message}`);
      const mock = this.getTTSProvider('mock');
      return await mock.streamSynthesis(text, options, onChunk, signal);
    }
  }

  /**
   * Standardizes voice error classification into ErrorCodes.
   */
  public classifyError(err: unknown): string {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (msg.includes('permission') || msg.includes('mic')) {
      return ErrorCode.VOICE_PERMISSION_DENIED;
    }
    if (msg.includes('expired') || msg.includes('session expired')) {
      return ErrorCode.VOICE_SESSION_EXPIRED;
    }
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('quota') || msg.includes('usage limit')) {
      return ErrorCode.VOICE_USAGE_LIMIT;
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('econnrefused') || msg.includes('connection failed')) {
      return ErrorCode.VOICE_CONNECTION_FAILED;
    }
    if (msg.includes('interrupt') || msg.includes('aborted')) {
      return ErrorCode.VOICE_INTERRUPTED;
    }
    if (msg.includes('language') || msg.includes('unsupported language')) {
      return ErrorCode.VOICE_UNSUPPORTED_LANGUAGE;
    }
    if (msg.includes('character') || msg.includes('unsupported character')) {
      return ErrorCode.VOICE_UNSUPPORTED_CHARACTER;
    }
    if (msg.includes('stt') || msg.includes('transcription')) {
      return ErrorCode.VOICE_STT_FAILED;
    }
    if (msg.includes('tts') || msg.includes('synthesis') || msg.includes('audio')) {
      return ErrorCode.VOICE_TTS_FAILED;
    }
    return ErrorCode.VOICE_PROVIDER_UNAVAILABLE;
  }
}
