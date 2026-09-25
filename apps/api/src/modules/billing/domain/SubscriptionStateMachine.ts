import { SubscriptionStatus } from '@ai-companion/types';
import { BadRequestError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class SubscriptionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    trialing: ['active', 'cancelled', 'expired', 'payment_failed'],
    active: ['past_due', 'cancelled', 'paused', 'expired', 'active'],
    past_due: ['active', 'grace_period', 'expired', 'cancelled'],
    grace_period: ['active', 'expired', 'cancelled'],
    paused: ['active', 'cancelled', 'expired'],
    cancelled: ['active', 'expired'],
    expired: ['active'],
    incomplete: ['active', 'expired', 'payment_failed'],
    payment_failed: ['active', 'past_due', 'expired', 'grace_period'],
  };

  public static canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    if (from === to) return true;
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static validateTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestError(
        `Invalid subscription state transition from '${from}' to '${to}'`,
        ErrorCode.SUBSCRIPTION_CHANGE_NOT_ALLOWED
      );
    }
  }

  public static isActive(status: SubscriptionStatus): boolean {
    return status === 'active' || status === 'trialing' || status === 'grace_period';
  }

  public static isEntitlementEligible(status: SubscriptionStatus): boolean {
    return status === 'active' || status === 'trialing' || status === 'grace_period' || status === 'cancelled';
  }

  public static hasActiveEntitlements(status: SubscriptionStatus): boolean {
    return this.isEntitlementEligible(status);
  }
}
