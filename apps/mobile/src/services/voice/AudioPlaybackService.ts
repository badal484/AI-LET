export interface QueuedAudioChunk {
  sequence: number;
  audioBase64: string;
  format: string;
  sampleRate: number;
  isFinal: boolean;
}

export type PlaybackVolumeListener = (volume: number) => void;
export type PlaybackStateListener = (isPlaying: boolean) => void;

export class AudioPlaybackService {
  private queue: QueuedAudioChunk[] = [];
  private playedSequences: Set<number> = new Set();
  private isPlaying = false;
  private isMuted = false;
  private isSpeakerOn = true;
  private playbackTimer: any = null;

  private volumeListeners: Set<PlaybackVolumeListener> = new Set();
  private stateListeners: Set<PlaybackStateListener> = new Set();

  public onVolume(listener: PlaybackVolumeListener): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  public onPlaybackState(listener: PlaybackStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Enqueues an incoming TTS audio chunk.
   */
  public enqueueChunk(chunk: QueuedAudioChunk): void {
    // Avoid duplicates
    if (this.playedSequences.has(chunk.sequence)) {
      return;
    }

    this.queue.push(chunk);
    // Sort by sequence number in case of network packet reordering
    this.queue.sort((a, b) => a.sequence - b.sequence);

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Plays the next audio chunk in the queue.
   */
  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.notifyState(false);
      this.notifyVolume(0);
      return;
    }

    this.isPlaying = true;
    this.notifyState(true);

    const chunk = this.queue.shift()!;
    this.playedSequences.add(chunk.sequence);

    // Simulate audio frame playback duration (~150ms per chunk)
    const simulatedDurationMs = Math.max(100, Math.min(600, (chunk.audioBase64.length / 50)));

    // Emit simulated waveform levels
    const interval = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(interval);
        return;
      }
      const vol = this.isMuted ? 0 : 0.4 + Math.random() * 0.5;
      this.notifyVolume(vol);
    }, 40);

    this.playbackTimer = setTimeout(() => {
      clearInterval(interval);
      this.playNext();
    }, simulatedDurationMs);
  }

  /**
   * Instant barge-in / interruption stop: stops playback and clears all buffered audio chunks immediately.
   */
  public stopAndClear(): void {
    this.queue = [];
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.notifyState(false);
    this.notifyVolume(0);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setSpeaker(speaker: boolean): void {
    this.isSpeakerOn = speaker;
  }

  public getSpeaker(): boolean {
    return this.isSpeakerOn;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public reset(): void {
    this.stopAndClear();
    this.playedSequences.clear();
  }

  private notifyVolume(volume: number): void {
    this.volumeListeners.forEach((l) => l(volume));
  }

  private notifyState(isPlaying: boolean): void {
    this.stateListeners.forEach((l) => l(isPlaying));
  }
}
