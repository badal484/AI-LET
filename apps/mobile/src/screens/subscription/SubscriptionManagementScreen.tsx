import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
// React Native's own SafeAreaView is deprecated and ignores Android's system bars under edge-to-edge.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors, spacing } from '../../theme/index.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling } from '../../services/storeBilling.js';
import {
  Icon,
  IconButton,
  Skeleton,
  ToastService,
  type IconName,
} from '../../components/common/index.js';
import { PromoCodeBox } from '../../components/PromoCodeBox.js';
import { CoinStoreSheet } from '../../components/billing/CoinStoreSheet.js';
import { AppAlert } from '../../components/common/AppDialog.js';
import { cancelUpiPremium, getCachedUpiConfig, rupees } from '../../services/razorpayCheckout.js';
import { GradientFill } from '../../components/common/GradientFill.js';

/**
 * "Your Premium": one plan (₹1 first day, then monthly), so this is just its status, the renewal date, your coins,
 * and the way to manage or cancel it — which Google Play does (Google's rule).
 */

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export const SubscriptionManagementScreen: React.FC<{ isTab?: boolean }> = ({ isTab = false }) => {
  const navigation = useNavigation<any>();
  const { subscription, creditWallet, isLoading, loadBillingState, restorePurchases } =
    useBillingStore();
  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadBillingState();
  }, [loadBillingState]);

  const status = String(subscription?.status ?? '').toLowerCase();
  const periodEndMs = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : 0;
  const isPeriodActive = periodEndMs > Date.now();
  const isPremium =
    ['active', 'trialing', 'grace_period', 'past_due'].includes(status) ||
    (status === 'cancelled' && isPeriodActive);
  const upi = StoreBilling.upiConfig() ?? getCachedUpiConfig();
  const hasPriorSubscription = Boolean(subscription);
  const eligibleForTrial = Boolean(upi?.eligibleForTrial) && !hasPriorSubscription;
  const firstPrice = rupees(upi?.premium?.firstDayMinorUnits ?? 100);
  const monthlyPrice = rupees(upi?.premium?.monthlyMinorUnits ?? 49_900);
  const ctaText = eligibleForTrial ? `Start for ${firstPrice}` : `Subscribe · ${monthlyPrice}/mo`;
  const viaPromo = String(subscription?.provider ?? '') === 'promo';
  const ending = (Boolean(subscription?.cancelAtPeriodEnd) || status === 'cancelled') && !viaPromo;
  const periodEnd = fmtDate(subscription?.currentPeriodEnd);
  const coins = creditWallet?.availableBalance ?? 0;

  const pill: { label: string; color: string; bg: string } = !isPremium
    ? { label: 'Not active', color: '#C9C2D9', bg: 'rgba(255,255,255,0.08)' }
    : status === 'past_due' || status === 'grace_period'
      ? { label: 'Payment problem', color: '#FBBF24', bg: 'rgba(251,191,36,0.14)' }
      : ending
        ? { label: 'Ending', color: '#FBBF24', bg: 'rgba(251,191,36,0.14)' }
        : viaPromo
          ? { label: 'Gift 🎁', color: '#F9A8D4', bg: 'rgba(236,72,153,0.16)' }
          : status === 'trialing'
            ? { label: 'First day', color: '#C4B5FD', bg: 'rgba(139,92,246,0.18)' }
            : { label: 'Active', color: '#34D399', bg: 'rgba(52,211,153,0.14)' };

  const viaUpi = String(subscription?.provider ?? '') === 'razorpay';

  const cancelUpi = () =>
    AppAlert.alert(
      'Cancel Premium?',
      `No more ₹499 debits. You keep Premium${periodEnd ? ` until ${periodEnd}` : ' for the time you paid for'}.`,
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Premium',
          style: 'destructive',
          onPress: async () => {
            const r = await cancelUpiPremium();
            if (!r.ok)
              return AppAlert.alert(
                'Couldn’t cancel',
                r.message ?? 'Please try again in a moment.',
              );
            ToastService.show({
              message: 'Premium cancelled — no more debits',
              type: 'success',
              duration: 2500,
            });
            void loadBillingState();
          },
        },
      ],
    );

  const manage = () => {
    if (viaUpi) return cancelUpi();
    if (StoreBilling.isAvailable) {
      StoreBilling.openManageSubscription();
      return;
    }
    AppAlert.alert('Manage Premium', StoreBilling.unavailableMessage);
  };

  const restore = async () => {
    if (!StoreBilling.isAvailable) {
      AppAlert.alert('Restore unavailable', StoreBilling.unavailableMessage);
      return;
    }
    setRestoring(true);
    const n = await restorePurchases().catch(() => 0);
    setRestoring(false);
    if (n > 0)
      ToastService.show({ message: 'Purchases restored', type: 'success', duration: 2500 });
    else
      AppAlert.alert('Nothing to restore', 'No active purchase was found on this Google account.');
  };

  const Row = ({
    icon,
    label,
    onPress,
    first,
    busy,
  }: {
    icon: IconName;
    label: string;
    onPress: () => void;
    first?: boolean;
    busy?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowBorder,
        (pressed || busy) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={darkThemeColors.accent} />
      </View>
      <Text style={styles.rowLabel}>{busy ? 'Checking…' : label}</Text>
      <Icon name="arrow-right" size={16} color={darkThemeColors.textMuted} />
    </Pressable>
  );

  // How much of the current period is left — shown as "23 days left" with a bar.
  const startMs = subscription?.currentPeriodStart
    ? new Date(subscription.currentPeriodStart).getTime()
    : 0;
  const endMs = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : 0;
  const daysLeft = endMs ? Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000)) : 0;
  const leftShare =
    endMs > startMs ? Math.min(1, Math.max(0.04, (endMs - Date.now()) / (endMs - startMs))) : 0;
  const heroLine = !isPremium
    ? 'Talk to everyone, up to 150 messages a day.'
    : status === 'past_due' || status === 'grace_period'
      ? 'Payment didn’t go through — update it to keep Premium.'
      : viaPromo
        ? `Free until ${periodEnd} · nothing to pay or cancel`
        : ending
          ? `Ends ${periodEnd} · won’t renew`
          : `Renews ${periodEnd}`;

  return (
    <SafeAreaView style={styles.container} edges={isTab ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill
          radial
          colors={[
            ['#A855F7', 0.26],
            ['#EC4899', 0.07],
            ['#0B0614', 0],
          ]}
        />
      </View>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          {!isTab && (
            <IconButton
              icon="arrow-left"
              size="sm"
              variant="surface"
              onPress={() => navigation.goBack()}
              accessibilityLabel="Back"
            />
          )}
          <Text style={styles.title}>Your Premium</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && !subscription ? (
          <Skeleton height={150} borderRadius={20} />
        ) : (
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Icon name="diamond" size={18} color="#C4B5FD" />
              <Text style={styles.heroLabel}>{isPremium ? 'PREMIUM' : 'LOVEEK PREMIUM'}</Text>
              <Text style={styles.heroBadge}>{pill.label}</Text>
            </View>
            {isPremium && endMs > 0 ? (
              <>
                <Text style={styles.heroBig}>
                  {daysLeft}{' '}
                  <Text style={styles.heroBigUnit}>
                    {daysLeft === 1 ? 'day left' : 'days left'}
                  </Text>
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(leftShare * 100)}%` }]} />
                </View>
                <Text style={styles.heroLine}>{heroLine}</Text>
              </>
            ) : (
              <>
                <Text style={styles.heroLine}>{heroLine}</Text>
                {!isPremium && (
                  <Pressable
                    onPress={() => navigation.navigate('Paywall')}
                    style={({ pressed }) => [styles.heroCta, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.heroCtaText}>{ctaText}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        <Pressable
          onPress={() => setCoinStoreOpen(true)}
          style={({ pressed }) => [styles.coinRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${coins} coins, get more`}
        >
          <Text style={styles.coinEmoji}>🪙</Text>
          <Text style={styles.coinCount}>{coins.toLocaleString('en-IN')} coins</Text>
          <Text style={styles.coinGet}>Get more</Text>
          <Icon name="arrow-right" size={14} color="#8E86A3" />
        </Pressable>

        {viaPromo ? null : viaUpi ? (
          // UPI Autopay: cancelling happens right here (nothing to restore from Google Play).
          isPremium && !ending ? (
            <View style={styles.card}>
              <Row first icon="settings" label="Cancel Premium" onPress={manage} />
            </View>
          ) : null
        ) : (
          <View style={styles.card}>
            {isPremium && (
              <Row first icon="settings" label="Manage or cancel in Google Play" onPress={manage} />
            )}
            <Row
              first={!isPremium}
              icon="check"
              label="Restore purchases"
              onPress={restore}
              busy={restoring}
            />
          </View>
        )}

        <PromoCodeBox />
        <Text style={styles.fineprint}>
          {viaPromo
            ? 'When it ends, start Premium any time from the Premium tab.'
            : viaUpi
              ? 'Paid with UPI Autopay through Razorpay. Cancel here or in your UPI app — no debits after you cancel.'
              : 'Payments are handled by Google Play. Cancel anytime from Google Play → Payments & subscriptions.'}
        </Text>
      </ScrollView>

      <CoinStoreSheet visible={coinStoreOpen} onClose={() => setCoinStoreOpen(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: 14, paddingBottom: 48, maxWidth: 540, width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#140F20',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: { flex: 1, color: '#C4B5FD', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  heroBadge: { color: '#B9B2CC', fontSize: 12, fontWeight: '700' },
  heroBig: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 14,
  },
  heroBigUnit: { color: '#B9B2CC', fontSize: 15, fontWeight: '600' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#A78BFA' },
  heroLine: { color: '#9E97B0', fontSize: 13, marginTop: 10 },
  heroCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  heroCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#140F20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  coinEmoji: { fontSize: 18 },
  coinCount: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  coinGet: { color: '#A78BFA', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: darkThemeColors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  rowLabel: { flex: 1, color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  fineprint: {
    color: darkThemeColors.textDisabled,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
