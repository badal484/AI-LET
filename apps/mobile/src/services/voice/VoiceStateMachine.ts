import { VoiceClientState } from '@ai-companion/types';

export type StateChangeListener = (newState: VoiceClientState, prevState: VoiceClientState) => void;

export class VoiceStateMachine {
  private currentState: VoiceClientState = 'IDLE';
  private listeners: Set<StateChangeListener> = new Set();

  private static allowedTransitions: Record<VoiceClientState, VoiceClientState[]> = {
    IDLE: ['CONNECTING', 'ERROR', 'ENDED'],
    CONNECTING: ['LISTENING', 'ERROR', 'ENDED', 'RECONNECTING'],
    LISTENING: ['USER_SPEAKING', 'PROCESSING', 'AI_SPEAKING', 'INTERRUPTED', 'RECONNECTING', 'ERROR', 'ENDED'],
    USER_SPEAKING: ['PROCESSING', 'LISTENING', 'INTERRUPTED', 'ERROR', 'ENDED'],
    PROCESSING: ['AI_SPEAKING', 'LISTENING', 'INTERRUPTED', 'ERROR', 'ENDED'],
    AI_SPEAKING: ['LISTENING', 'USER_SPEAKING', 'INTERRUPTED', 'ERROR', 'ENDED'],
    INTERRUPTED: ['LISTENING', 'USER_SPEAKING', 'PROCESSING', 'ERROR', 'ENDED'],
    RECONNECTING: ['LISTENING', 'CONNECTING', 'ERROR', 'ENDED'],
    ERROR: ['CONNECTING', 'IDLE', 'ENDED'],
    ENDED: ['IDLE', 'CONNECTING'],
  };

  constructor(initialState: VoiceClientState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): VoiceClientState {
    return this.currentState;
  }

  public canTransitionTo(targetState: VoiceClientState): boolean {
    const allowed = VoiceStateMachine.allowedTransitions[this.currentState] || [];
    return allowed.includes(targetState);
  }

  public transitionTo(targetState: VoiceClientState, reason?: string): boolean {
    if (this.currentState === targetState) {
      return true;
    }

    if (!this.canTransitionTo(targetState)) {
      console.warn(
        `[VoiceStateMachine] Invalid transition from ${this.currentState} to ${targetState} (${reason || 'no reason'})`
      );
      return false;
    }

    const prevState = this.currentState;
    this.currentState = targetState;
    this.notifyListeners(targetState, prevState);
    return true;
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(newState: VoiceClientState, prevState: VoiceClientState): void {
    this.listeners.forEach((listener) => {
      try {
        listener(newState, prevState);
      } catch (err) {
        console.error('[VoiceStateMachine] Listener error:', err);
      }
    });
  }

  public reset(): void {
    const prevState = this.currentState;
    this.currentState = 'IDLE';
    this.notifyListeners('IDLE', prevState);
  }
}
