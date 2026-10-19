import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
// React Native's own SafeAreaView is deprecated and ignores Android's system bars under edge-to-edge.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors, spacing } from '../../theme/index.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling } from '../../services/storeBilling.js';
import {
  Button,
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

  const detail = !isPremium
    ? 'Talk to everyone, up to 150 messages a day. Your first day is ₹1.'
    : status === 'past_due' || status === 'grace_period'
      ? 'Google Play couldn’t take the payment. Update your payment method in Google Play to keep Premium.'
      : viaPromo
        ? `Free Premium from a code, until ${periodEnd}. Nothing to pay or cancel.`
        : ending
          ? periodEnd
            ? `Premium stays on until ${periodEnd}, then it won’t renew.`
            : 'Premium won’t renew.'
          : periodEnd
            ? `Renews on ${periodEnd}. Up to 150 messages a day with every character.`
            : 'Up to 150 messages a day with every character.';

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill
          radial
          colors={[
            ['#A855F7', 0.2],
            ['#EC4899', 0.05],
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
          <Skeleton height={170} borderRadius={20} />
        ) : (
          <View style={styles.planCard}>
            <View style={styles.planTop}>
              <View style={styles.crown}>
                <Icon name="diamond" size={22} color="#F5D0FE" />
              </View>
              <Text style={styles.planName}>Loveek Premium</Text>
              <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
              </View>
            </View>
            <Text style={styles.planDetail}>{detail}</Text>
            {!isPremium && (
              <Button
                label="Start for ₹1"
                onPress={() => navigation.navigate('Paywall')}
                accessibilityLabel="Start Premium for ₹1"
                style={styles.planButton}
              />
            )}
          </View>
        )}

        <View style={styles.coinCard}>
          <Text style={styles.coinEmoji}>🪙</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.coinCount}>{coins.toLocaleString('en-IN')} coins</Text>
            <Text style={styles.coinSub}>For sending gifts</Text>
          </View>
          <Button
            label="Get coins"
            size="sm"
            variant="secondary"
            onPress={() => setCoinStoreOpen(true)}
            accessibilityLabel="Get coins"
          />
        </View>

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
            ? 'Want to keep Premium after it ends? Start it from the Premium tab any time.'
            : viaUpi
              ? 'Paid with UPI Autopay through Razorpay. Cancel anytime here or in your UPI app — no debits after you cancel.'
              : 'Payments are handled by Google Play. Cancel anytime from Google Play → Payments & subscriptions.'}
        </Text>
      </ScrollView>

      <CoinStoreSheet visible={coinStoreOpen} onClose={() => setCoinStoreOpen(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: 48 },
  planCard: {
    borderRadius: 20,
    padding: spacing.lg,
    backgroundColor: '#1A1230',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  crown: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B1D6E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  planDetail: { color: '#C9C2D9', fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  planButton: { marginTop: spacing.md },
  coinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  coinEmoji: { fontSize: 26 },
  coinCount: { color: darkThemeColors.textPrimary, fontSize: 16, fontWeight: '700' },
  coinSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 1 },
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
