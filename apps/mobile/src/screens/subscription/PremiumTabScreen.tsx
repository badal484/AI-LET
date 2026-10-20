import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useBillingStore } from '../../stores/billingStore.js';
import { PaywallScreen } from './PaywallScreen.js';
import { SubscriptionManagementScreen } from './SubscriptionManagementScreen.js';

/**
 * Premium Tab:
 * - If the user has an active Premium plan, shows their subscription dashboard ("Your Premium", renewal date, coins, cancel/manage).
 * - If the user is a free user, shows the Paywall sales screen ("Start Premium at ₹1").
 */
export const PremiumTabScreen: React.FC = () => {
  const { subscription, loadBillingState } = useBillingStore();

  useFocusEffect(
    useCallback(() => {
      void loadBillingState();
    }, [loadBillingState]),
  );

  const status = String(subscription?.status ?? '').toLowerCase();
  const periodEndMs = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : 0;
  const isPeriodActive = periodEndMs > Date.now();
  const isPremium = Boolean(
    subscription &&
    (['active', 'trialing', 'grace_period', 'past_due'].includes(status) ||
      (status === 'cancelled' && isPeriodActive)),
  );

  if (isPremium) {
    return <SubscriptionManagementScreen isTab />;
  }

  return <PaywallScreen />;
};
