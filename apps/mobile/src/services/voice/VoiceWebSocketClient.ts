import {
  VoiceRealtimeEvent,
  VoiceEventType,
} from '@ai-companion/types';
import { VoiceStateMachine } from './VoiceStateMachine.js';
import { AudioCaptureService } from './AudioCaptureService.js';
import { WS_ORIGIN } from '../../config/appInfo.js';
import { AudioPlaybackService } from './AudioPlaybackService.js';

export interface VoiceClientConfig {
  baseUrl?: string;
  reconnectAttempts?: number;
}

export type TranscriptListener = (text: string, isUser: boolean, isFinal: boolean) => void;
export type VoiceEventListener = (event: VoiceRealtimeEvent) => void;

export class VoiceWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId = '';
  private token = '';
  private sequenceCounter = 1;
  private isExplicitlyClosed = false;
  private reconnectCount = 0;
  private maxReconnectAttempts = 5;

  public stateMachine: VoiceStateMachine;
  public audioCapture: AudioCaptureService;
  public audioPlayback: AudioPlaybackService;

  private transcriptListeners: Set<TranscriptListener> = new Set();
  private eventListeners: Set<VoiceEventListener> = new Set();

  constructor(config?: VoiceClientConfig) {
    this.maxReconnectAttempts = config?.reconnectAttempts ?? 5;
    this.stateMachine = new VoiceStateMachine('IDLE');
    this.audioCapture = new AudioCaptureService();
    this.audioPlayback = new AudioPlaybackService();

    // Hook audio capture speech events
    this.audioCapture.onSpeechActivity((isSpeaking) => {
      if (isSpeaking) {
        // User started speaking -> instant barge-in if AI was speaking!
        if (this.stateMachine.getState() === 'AI_SPEAKING') {
          this.interruptAI();
        }
        this.stateMachine.transitionTo('USER_SPEAKING');
        this.sendEvent('voice.audio.started', {});
      } else {
        this.stateMachine.transitionTo('PROCESSING');
        this.sendEvent('voice.audio.stopped', {});
      }
    });

    // Hook audio capture chunks
    this.audioCapture.onChunk((chunkBase64) => {
      if (this.stateMachine.getState() === 'USER_SPEAKING') {
        this.sendEvent('voice.audio.chunk', { audioBase64: chunkBase64 });
      }
    });

    // Hook playback state to state machine
    this.audioPlayback.onPlaybackState((isPlaying) => {
      if (isPlaying && this.stateMachine.getState() !== 'USER_SPEAKING') {
        this.stateMachine.transitionTo('AI_SPEAKING');
      } else if (!isPlaying && this.stateMachine.getState() === 'AI_SPEAKING') {
        this.stateMachine.transitionTo('LISTENING');
      }
    });
  }

  public onTranscript(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  public onEvent(listener: VoiceEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Connects to the real-time Voice WebSocket session.
   */
  public async connect(websocketUrl: string, sessionId: string, token: string): Promise<void> {
    this.sessionId = sessionId;
    this.token = token;
    this.isExplicitlyClosed = false;
    this.stateMachine.transitionTo('CONNECTING');

    try {
      // Resolve full ws URL if relative
      const fullUrl = websocketUrl.startsWith('http')
        ? websocketUrl.replace(/^http/, 'ws')
        : websocketUrl.startsWith('ws')
        ? websocketUrl
        : `${WS_ORIGIN}${websocketUrl}`;

      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.reconnectCount = 0;
        this.stateMachine.transitionTo('LISTENING');
        this.audioCapture.startCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as VoiceRealtimeEvent;
          this.handleServerEvent(parsed);
        } catch (err) {
          console.error('[VoiceWebSocketClient] Parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceWebSocketClient] Socket error:', error);
        this.stateMachine.transitionTo('ERROR');
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed && this.reconnectCount < this.maxReconnectAttempts) {
          this.attemptReconnect(websocketUrl);
        } else {
          this.cleanup();
          this.stateMachine.transitionTo('ENDED');
        }
      };
    } catch (err) {
      console.error('[VoiceWebSocketClient] Connection failed:', err);
      this.stateMachine.transitionTo('ERROR');
    }
  }

  /**
   * Interrupts AI speech immediately (Barge-In).
   */
  public interruptAI(): void {
    this.audioPlayback.stopAndClear();
    this.stateMachine.transitionTo('INTERRUPTED');
    this.sendEvent('voice.interrupted', { reason: 'user_barge_in' });
  }

  /**
   * Handles incoming typed events from server.
   */
  private handleServerEvent(event: VoiceRealtimeEvent): void {
    this.eventListeners.forEach((l) => l(event));

    switch (event.type) {
      case 'voice.session.ready': {
        this.stateMachine.transitionTo('LISTENING');
        break;
      }

      case 'voice.transcript.interim': {
        this.notifyTranscript(event.payload.transcript, true, false);
        break;
      }

      case 'voice.transcript.final': {
        this.notifyTranscript(event.payload.transcript, true, true);
        break;
      }

      case 'voice.generation.delta': {
        this.notifyTranscript(event.payload.accumulated, false, false);
        break;
      }

      case 'voice.tts.audio': {
        // Enqueue audio chunk into playback service
        this.audioPlayback.enqueueChunk({
          sequence: event.payload.sequence,
          audioBase64: event.payload.audioBase64,
          format: event.payload.format,
          sampleRate: event.payload.sampleRate,
          isFinal: event.payload.isFinal,
        });
        break;
      }

      case 'voice.interrupted': {
        this.audioPlayback.stopAndClear();
        this.stateMachine.transitionTo('LISTENING');
        break;
      }

      case 'voice.error': {
        this.stateMachine.transitionTo('ERROR');
        break;
      }

      case 'voice.session.ended': {
        this.disconnect();
        break;
      }

      default:
        break;
    }
  }

  /**
   * Sends a typed realtime event to the server.
   */
  public sendEvent(type: VoiceEventType, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const event: VoiceRealtimeEvent = {
      id: `client_evt_${Date.now()}_${this.sequenceCounter}`,
      sessionId: this.sessionId,
      type,
      sequence: this.sequenceCounter++,
      timestamp: new Date().toISOString(),
      payload,
    };

    this.ws.send(JSON.stringify(event));
  }

  private attemptReconnect(websocketUrl: string): void {
    this.reconnectCount++;
    this.stateMachine.transitionTo('RECONNECTING');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 10000);

    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect(websocketUrl, this.sessionId, this.token);
      }
    }, delay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.cleanup();
    this.stateMachine.transitionTo('ENDED');
  }

  private cleanup(): void {
    this.audioCapture.stopCapture();
    this.audioPlayback.reset();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private notifyTranscript(text: string, isUser: boolean, isFinal: boolean): void {
    this.transcriptListeners.forEach((l) => l(text, isUser, isFinal));
  }
}
