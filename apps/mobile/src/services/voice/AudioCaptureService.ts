import { VoiceMode } from '@ai-companion/types';

export interface AudioCaptureConfig {
  sampleRate?: number;
  channels?: number;
  vadSilenceMs?: number;
  vadSpeechThreshold?: number;
  mode?: VoiceMode;
}

export type AudioChunkHandler = (chunkBase64: string, volume: number) => void;
export type SpeechActivityHandler = (isSpeaking: boolean) => void;

/**
 * Native microphone capture and PCM playback are not integrated in this build (no audio module is
 * installed), so the capture loop below can only produce silent frames. Voice calls are therefore
 * reported as unavailable instead of streaming silence to the server and billing a session that can
 * never hear the user. Flip this once a real audio module feeds `startCapture`/playback.
 */
export const NATIVE_AUDIO_AVAILABLE = false as boolean;
export const VOICE_UNAVAILABLE_MESSAGE =
  'Voice calls are not available in this version of the app yet. You can keep chatting by text.';

export class AudioCaptureService {
  private isCapturing = false;
  private isSpeaking = false;
  private mode: VoiceMode = 'hands_free';
  public sampleRate = 24000;
  private vadSilenceMs = 800;
  private lastSpeechTimestamp = 0;
  private captureInterval: any = null;

  private onAudioChunkCallbacks: Set<AudioChunkHandler> = new Set();
  private onSpeechActivityCallbacks: Set<SpeechActivityHandler> = new Set();

  constructor(config?: AudioCaptureConfig) {
    if (config?.mode) this.mode = config.mode;
    if (config?.sampleRate) this.sampleRate = config.sampleRate;
    if (config?.vadSilenceMs) this.vadSilenceMs = config.vadSilenceMs;
  }

  public setMode(mode: VoiceMode): void {
    this.mode = mode;
  }

  public getMode(): VoiceMode {
    return this.mode;
  }

  public onChunk(callback: AudioChunkHandler): () => void {
    this.onAudioChunkCallbacks.add(callback);
    return () => this.onAudioChunkCallbacks.delete(callback);
  }

  public onSpeechActivity(callback: SpeechActivityHandler): () => void {
    this.onSpeechActivityCallbacks.add(callback);
    return () => this.onSpeechActivityCallbacks.delete(callback);
  }

  /**
   * Starts capturing microphone audio.
   */
  public async startCapture(): Promise<void> {
    if (this.isCapturing) return;
    this.isCapturing = true;
    this.lastSpeechTimestamp = Date.now();

    // Stream simulated 20ms PCM audio frames with VAD volume simulation
    this.captureInterval = setInterval(() => {
      if (!this.isCapturing) return;

      // Simulate ambient audio frame (960 bytes = 20ms @ 24kHz 16-bit mono)
      const frameBytes = 960;
      const dummyBuffer = new Uint8Array(frameBytes);
      // In web/simulator/mock test mode, generate synthetic volume
      const volume = this.isSpeaking ? 0.6 + Math.random() * 0.4 : 0.05 + Math.random() * 0.05;

      const base64Chunk = this.uint8ToBase64(dummyBuffer);

      // Notify chunk listeners
      this.onAudioChunkCallbacks.forEach((cb) => cb(base64Chunk, volume));

      // In hands-free mode, check VAD silence timeout
      if (this.mode === 'hands_free' && this.isSpeaking) {
        if (Date.now() - this.lastSpeechTimestamp > this.vadSilenceMs) {
          this.isSpeaking = false;
          this.notifySpeechActivity(false);
        }
      }
    }, 50);
  }

  /**
   * Called when user presses microphone in Push-to-Talk mode or speech is detected.
   */
  public triggerSpeechStart(): void {
    this.isSpeaking = true;
    this.lastSpeechTimestamp = Date.now();
    this.notifySpeechActivity(true);
  }

  /**
   * Called when user releases microphone in Push-to-Talk mode.
   */
  public triggerSpeechEnd(): void {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifySpeechActivity(false);
    }
  }

  /**
   * Stops audio capture.
   */
  public stopCapture(): void {
    this.isCapturing = false;
    this.isSpeaking = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  private notifySpeechActivity(isSpeaking: boolean): void {
    this.onSpeechActivityCallbacks.forEach((cb) => cb(isSpeaking));
  }

  private uint8ToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i] || 0);
    }
    return typeof btoa !== 'undefined' ? btoa(binary) : '';
  }
}
