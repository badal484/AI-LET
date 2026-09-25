import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceStateMachine } from '../../mobile/src/services/voice/VoiceStateMachine.js';

describe('VoiceStateMachine', () => {
  let fsm: VoiceStateMachine;

  beforeEach(() => {
    fsm = new VoiceStateMachine();
  });

  it('initializes in IDLE state', () => {
    expect(fsm.getState()).toBe('IDLE');
    expect(fsm.canTransitionTo('CONNECTING')).toBe(true);
    expect(fsm.canTransitionTo('AI_SPEAKING')).toBe(false);
  });

  it('transitions through standard conversation flow', () => {
    const states: string[] = [];
    fsm.subscribe((to, from) => states.push(`${from}->${to}`));

    expect(fsm.transitionTo('CONNECTING')).toBe(true);
    expect(fsm.getState()).toBe('CONNECTING');

    expect(fsm.transitionTo('LISTENING')).toBe(true);
    expect(fsm.getState()).toBe('LISTENING');

    expect(fsm.transitionTo('USER_SPEAKING')).toBe(true);
    expect(fsm.getState()).toBe('USER_SPEAKING');

    expect(fsm.transitionTo('PROCESSING')).toBe(true);
    expect(fsm.getState()).toBe('PROCESSING');

    expect(fsm.transitionTo('AI_SPEAKING')).toBe(true);
    expect(fsm.getState()).toBe('AI_SPEAKING');

    expect(fsm.transitionTo('LISTENING')).toBe(true);
    expect(fsm.getState()).toBe('LISTENING');

    expect(states).toEqual([
      'IDLE->CONNECTING',
      'CONNECTING->LISTENING',
      'LISTENING->USER_SPEAKING',
      'USER_SPEAKING->PROCESSING',
      'PROCESSING->AI_SPEAKING',
      'AI_SPEAKING->LISTENING',
    ]);
  });

  it('supports Barge-In interruption from AI_SPEAKING to INTERRUPTED and USER_SPEAKING', () => {
    fsm.transitionTo('CONNECTING');
    fsm.transitionTo('LISTENING');
    fsm.transitionTo('USER_SPEAKING');
    fsm.transitionTo('PROCESSING');
    fsm.transitionTo('AI_SPEAKING');

    // Barge-in occurs
    expect(fsm.transitionTo('INTERRUPTED', 'User started speaking during AI playback')).toBe(true);
    expect(fsm.getState()).toBe('INTERRUPTED');

    expect(fsm.transitionTo('USER_SPEAKING')).toBe(true);
    expect(fsm.getState()).toBe('USER_SPEAKING');
  });

  it('transitions to ERROR and allows RECONNECTING or ENDED', () => {
    fsm.transitionTo('CONNECTING');
    expect(fsm.transitionTo('ERROR', 'Socket connection lost')).toBe(true);
    expect(fsm.getState()).toBe('ERROR');

    // ERROR can go to CONNECTING, IDLE, or ENDED
    expect(fsm.transitionTo('CONNECTING')).toBe(true);
    expect(fsm.getState()).toBe('CONNECTING');

    fsm.transitionTo('ERROR');
    expect(fsm.transitionTo('ENDED')).toBe(true);
    expect(fsm.getState()).toBe('ENDED');
  });

  it('guards against illegal state transitions', () => {
    // Cannot transition from IDLE directly to AI_SPEAKING
    expect(fsm.transitionTo('AI_SPEAKING')).toBe(false);
    expect(fsm.getState()).toBe('IDLE');

    fsm.transitionTo('CONNECTING');
    fsm.transitionTo('ENDED');

    // Cannot jump from ENDED directly to AI_SPEAKING
    expect(fsm.transitionTo('AI_SPEAKING')).toBe(false);
    expect(fsm.getState()).toBe('ENDED');
  });
});
