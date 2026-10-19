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
import { cancelUpiPremium } from '../../services/razorpayCheckout.js';
import { GradientFill } from '../../components/common/GradientFill.js';

/**
 * "Your Premium": one plan (₹1 first day, then monthly), so this is just its status, the renewal date, your coins,
 * and the way to manage or cancel it — which Google Play does (Google's rule).
 */

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export const SubscriptionManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { subscription, creditWallet, isLoading, loadBillingState, restorePurchases } =
    useBillingStore();
  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadBillingState();
  }, [loadBillingState]);

  const status = String(subscription?.status ?? '').toLowerCase();
  const isPremium = ['active', 'trialing', 'grace_period', 'past_due'].includes(status);
  const viaPromo = String(subscription?.provider ?? '') === 'promo';
  const ending = Boolean(subscription?.cancelAtPeriodEnd) && !viaPromo;
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
  const heroTitle = !isPremium
    ? 'Loveek Premium'
    : viaPromo
      ? 'Premium · gifted'
      : status === 'trialing'
        ? 'Premium · first day'
        : 'Premium';
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="surface"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        />
        <Text style={styles.title}>Your Premium</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && !subscription ? (
          <Skeleton height={210} borderRadius={26} />
        ) : (
          <View style={styles.hero}>
            <GradientFill colors={isPremium ? ['#6D28D9', '#BE185D'] : ['#2A1F45', '#3B1D4E']} />
            <View style={styles.heroTop}>
              <View style={styles.crown}>
                <Icon name="diamond" size={24} color="#FFFFFF" />
              </View>
              <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                <Text style={[styles.pillText, { color: '#FFFFFF' }]}>{pill.label}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroLine}>{heroLine}</Text>

            {isPremium && endMs > 0 && (
              <View style={styles.countdown}>
                <View style={styles.countRow}>
                  <Text style={styles.countBig}>{daysLeft}</Text>
                  <Text style={styles.countUnit}>{daysLeft === 1 ? 'day left' : 'days left'}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(leftShare * 100)}%` }]} />
                </View>
              </View>
            )}

            {!isPremium && (
              <Pressable
                onPress={() => navigation.navigate('Paywall')}
                style={({ pressed }) => [styles.heroCta, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.heroCtaText}>Start for ₹1</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* What Premium includes, at a glance. */}
        {isPremium && (
          <View style={styles.perks}>
            {[
              ['💬', '150 / day'],
              ['🧠', 'Remembers you'],
              ['💜', 'Deeper bond'],
              ['📚', 'Courses'],
            ].map(([icon, label]) => (
              <View key={label} style={styles.perk}>
                <Text style={styles.perkIcon}>{icon}</Text>
                <Text style={styles.perkText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => setCoinStoreOpen(true)}
          style={({ pressed }) => [styles.coinCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${coins} coins, get more`}
        >
          <GradientFill
            colors={[
              ['#F59E0B', 0.22],
              ['#F59E0B', 0.04],
            ]}
          />
          <Text style={styles.coinEmoji}>🪙</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.coinCount}>{coins.toLocaleString('en-IN')} coins</Text>
            <Text style={styles.coinSub}>Gifts · 2 coins per extra message</Text>
          </View>
          <View style={styles.coinBtn}>
            <Text style={styles.coinBtnText}>+ Get</Text>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: 14, paddingBottom: 48 },
  hero: { borderRadius: 26, padding: 20, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crown: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 12, fontWeight: '800' },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 14,
  },
  heroLine: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 3 },
  countdown: { marginTop: 18 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  countBig: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  countUnit: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  heroCta: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  heroCtaText: { color: '#6D28D9', fontSize: 15, fontWeight: '800' },
  perks: { flexDirection: 'row', gap: 8 },
  perk: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  perkIcon: { fontSize: 20 },
  perkText: { color: '#C9C2D9', fontSize: 11, fontWeight: '700', marginTop: 4 },
  coinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#17120A',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.3)',
  },
  coinEmoji: { fontSize: 30 },
  coinCount: { color: '#FCD34D', fontSize: 18, fontWeight: '900' },
  coinSub: { color: '#C9B98A', fontSize: 12, marginTop: 1 },
  coinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FCD34D',
  },
  coinBtnText: { color: '#1A1205', fontSize: 13, fontWeight: '900' },
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
