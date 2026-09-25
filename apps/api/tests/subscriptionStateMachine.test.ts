import { describe, it, expect } from 'vitest';
import { SubscriptionStateMachine } from '../src/modules/billing/domain/SubscriptionStateMachine.js';

describe('SubscriptionStateMachine', () => {
  it('allows valid transitions from trialing', () => {
    expect(SubscriptionStateMachine.canTransition('trialing', 'active')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('trialing', 'cancelled')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('trialing', 'expired')).toBe(true);
  });

  it('allows valid transitions from active', () => {
    expect(SubscriptionStateMachine.canTransition('active', 'past_due')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('active', 'cancelled')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('active', 'expired')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('active', 'paused')).toBe(true);
  });

  it('allows grace period transitions from past_due', () => {
    expect(SubscriptionStateMachine.canTransition('past_due', 'active')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('past_due', 'grace_period')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('past_due', 'expired')).toBe(true);
  });

  it('allows recovery from grace_period or cancellation before expiry', () => {
    expect(SubscriptionStateMachine.canTransition('grace_period', 'active')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('grace_period', 'expired')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('cancelled', 'active')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('cancelled', 'expired')).toBe(true);
  });

  it('rejects illegal state transitions and throws on validateTransition', () => {
    // expired cannot go to trialing, past_due, or grace_period
    expect(SubscriptionStateMachine.canTransition('expired', 'trialing')).toBe(false);
    expect(SubscriptionStateMachine.canTransition('expired', 'past_due')).toBe(false);
    expect(SubscriptionStateMachine.canTransition('expired', 'grace_period')).toBe(false);

    // incomplete cannot transition to paused
    expect(SubscriptionStateMachine.canTransition('incomplete', 'paused')).toBe(false);

    expect(() => SubscriptionStateMachine.validateTransition('expired', 'trialing')).toThrow(
      /invalid subscription state transition/i,
    );
  });

  it('identifies whether entitlements should remain active', () => {
    expect(SubscriptionStateMachine.hasActiveEntitlements('active')).toBe(true);
    expect(SubscriptionStateMachine.hasActiveEntitlements('trialing')).toBe(true);
    expect(SubscriptionStateMachine.hasActiveEntitlements('grace_period')).toBe(true);
    expect(SubscriptionStateMachine.hasActiveEntitlements('cancelled')).toBe(true); // User keeps benefits until end of paid period

    expect(SubscriptionStateMachine.hasActiveEntitlements('expired')).toBe(false);
    expect(SubscriptionStateMachine.hasActiveEntitlements('payment_failed')).toBe(false);
    expect(SubscriptionStateMachine.hasActiveEntitlements('incomplete')).toBe(false);
  });
});
