import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
// React Native's own SafeAreaView is deprecated and ignores Android's system bars under edge-to-edge.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling, type BasePlan, type StoreCatalog, type StoreOffer } from '../../services/storeBilling.js';
import { IconButton, Button, Badge, ToastService } from '../../components/common/index.js';

/**
 * Premium: ₹1 for 3 days, then ₹399/month (or ₹99/week, ₹3,999/year), plus ₹49 message packs.
 * Prices shown are Google Play's own (localized); the price and the auto-renewal are stated in plain
 * words right above the button — no surprise charges.
 */

const PLAN_LABEL: Record<BasePlan, { title: string; per: string; note?: string }> = {
  monthly: { title: 'Monthly', per: '/month' },
  weekly: { title: 'Weekly', per: '/week' },
  yearly: { title: 'Yearly', per: '/year', note: 'Save 17%' },
};
const ORDER: BasePlan[] = ['monthly', 'yearly', 'weekly'];

const BENEFITS = [
  'Chat with all 32 characters — 150 messages a day',
  'Full courses and step-by-step health programs',
  'They remember your life, your days and your goals',
  'Help in a crisis is always free, with or without Premium',
];

const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const PaywallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reason: 'free_limit' | 'fair_use' | undefined = route.params?.reason;
  const resetsAt: string | undefined = route.params?.resetsAt;

  const { loadBillingState, subscription } = useBillingStore();
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [selected, setSelected] = useState<BasePlan>('monthly');
  const [busy, setBusy] = useState<'subscribe' | 'pack' | 'restore' | null>(null);

  const isPremium = Boolean(subscription && ['active', 'trialing', 'grace_period'].includes(String(subscription.status).toLowerCase()));

  useEffect(() => {
    let alive = true;
    StoreBilling.loadCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setCatalog({ connected: false, offers: {} }));
    return () => {
      alive = false;
    };
  }, []);

  const offer: StoreOffer | undefined = catalog?.offers[selected];
  const trial = selected === 'monthly' ? offer?.trial : undefined;
  const firstCharge = useMemo(() => fmtDate(new Date(Date.now() + 3 * 86_400_000)), []);
  const resetTime = resetsAt ? new Date(resetsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'midnight';

  const title =
    reason === 'fair_use'
      ? "You've reached today's 150 messages"
      : reason === 'free_limit'
        ? "You've used today's free messages"
        : 'Go Premium';
  const subtitle =
    reason === 'fair_use'
      ? `Your messages refill at ${resetTime}. Can't wait? Add 100 messages now.`
      : reason === 'free_limit'
        ? `More free messages at ${resetTime} — or keep talking right now with Premium.`
        : 'Keep talking with the people who get you.';

  const finish = (r: { ok: boolean; message?: string }, success: string) => {
    if (r.ok) {
      ToastService.show({ message: success, type: 'success', duration: 2500 });
      void loadBillingState();
      navigation.goBack();
    } else if (r.message) {
      Alert.alert('Purchase', r.message);
    }
  };

  const subscribe = async () => {
    if (!offer) return;
    setBusy('subscribe');
    const r = await StoreBilling.buySubscription(offer, Boolean(trial));
    setBusy(null);
    finish(r, 'Welcome to Premium 🎉');
  };

  const buyPack = async () => {
    setBusy('pack');
    const r = await StoreBilling.buyPack();
    setBusy(null);
    finish(r, '100 messages added ✨');
  };

  const restore = async () => {
    setBusy('restore');
    const n = await StoreBilling.restore().catch(() => 0);
    setBusy(null);
    if (n > 0) finish({ ok: true }, 'Purchases restored');
    else Alert.alert('Nothing to restore', 'No active purchase was found on this Google account.');
  };

  const loading = catalog === null;
  const storeReady = !loading && Object.keys(catalog?.offers ?? {}).length > 0;

  const disclosure = !offer
    ? ''
    : trial
      ? `${trial.price} today. Then ${offer.price}/month from ${firstCharge}. Renews automatically until you cancel — cancel anytime in Google Play, at least a day before ${firstCharge} to avoid the charge.`
      : `${offer.price}${PLAN_LABEL[selected].per}. Renews automatically until you cancel — cancel anytime in Google Play.`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <IconButton icon="close" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Close" />
        <Button label="Restore" variant="ghost" size="sm" onPress={restore} disabled={busy !== null} accessibilityLabel="Restore purchases" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Badge label="PREMIUM" variant="stage" size="sm" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {!StoreBilling.isAvailable ? (
          <Text style={styles.notice}>{StoreBilling.unavailableMessage}</Text>
        ) : loading ? (
          <ActivityIndicator color={darkThemeColors.accent} style={{ marginVertical: spacing.xl }} />
        ) : !storeReady ? (
          <Text style={styles.notice}>
            {catalog?.connected
              ? 'Premium plans are not available on this version of the app yet. Please update the app from Google Play.'
              : "Google Play isn't responding right now. Please check your connection and try again."}
          </Text>
        ) : (
          <>
            {(reason === 'fair_use' || isPremium) && catalog?.pack && (
              <View style={[styles.card, styles.packCard]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>100 extra messages</Text>
                  <Text style={styles.cardSub}>One-time, used after your daily 150. No subscription.</Text>
                </View>
                <Button label={catalog.pack.price} size="sm" onPress={buyPack} disabled={busy !== null} accessibilityLabel={`Buy 100 messages for ${catalog.pack.price}`} />
              </View>
            )}

            {!isPremium && (
              <>
                <View style={styles.benefits}>
                  {BENEFITS.map((b) => (
                    <Text key={b} style={styles.benefit}>
                      ✓ {b}
                    </Text>
                  ))}
                </View>

                {ORDER.filter((p) => catalog?.offers[p]).map((p) => {
                  const o = catalog!.offers[p]!;
                  const isSel = selected === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.card, isSel && styles.cardSelected]}
                      onPress={() => setSelected(p)}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSel }}
                      accessibilityLabel={`${PLAN_LABEL[p].title}, ${o.price}${PLAN_LABEL[p].per}`}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.row}>
                          <Text style={styles.cardTitle}>{PLAN_LABEL[p].title}</Text>
                          {p === 'monthly' && o.trial && <Badge label={`${o.trial.price} for 3 days`} variant="success" size="sm" />}
                          {PLAN_LABEL[p].note && <Badge label={PLAN_LABEL[p].note!} variant="success" size="sm" />}
                        </View>
                      </View>
                      <Text style={styles.price}>
                        {o.price}
                        <Text style={styles.per}>{PLAN_LABEL[p].per}</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.disclosure}>{disclosure}</Text>
                <Button
                  label={busy === 'subscribe' ? 'Opening Google Play…' : trial ? `Start for ${trial.price}` : 'Subscribe'}
                  onPress={subscribe}
                  disabled={busy !== null || !offer}
                  accessibilityLabel={disclosure}
                />
              </>
            )}

            {isPremium && (
              <TouchableOpacity onPress={StoreBilling.openManageSubscription} style={styles.manage}>
                <Text style={styles.link}>Manage or cancel your subscription in Google Play</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Text style={styles.fineprint}>
          Payments are handled by Google Play. Prices include taxes. You can cancel anytime from Google Play → Payments & subscriptions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
  title: { color: darkThemeColors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: darkThemeColors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  notice: { color: darkThemeColors.textSecondary, textAlign: 'center', marginVertical: spacing.xl, lineHeight: 21 },
  benefits: { marginBottom: spacing.lg, gap: spacing.xs },
  benefit: { color: darkThemeColors.textSecondary, fontSize: 14, lineHeight: 21 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: darkThemeColors.border,
    backgroundColor: darkThemeColors.surface,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  cardSelected: { borderColor: darkThemeColors.accent, backgroundColor: darkThemeColors.accentMuted },
  packCard: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { color: darkThemeColors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardSub: { color: darkThemeColors.textMuted, fontSize: 13, marginTop: 2 },
  price: { color: darkThemeColors.textPrimary, fontSize: 18, fontWeight: '800' },
  per: { color: darkThemeColors.textMuted, fontSize: 13, fontWeight: '500' },
  disclosure: { color: darkThemeColors.textSecondary, fontSize: 13, lineHeight: 19, marginVertical: spacing.md, textAlign: 'center' },
  manage: { alignItems: 'center', marginTop: spacing.lg },
  link: { color: darkThemeColors.accent, fontSize: 14, fontWeight: '600' },
  fineprint: { color: darkThemeColors.textDisabled, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.xl },
});
