import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
// React Native's own SafeAreaView is deprecated and ignores Android's system bars under edge-to-edge.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling, type BasePlan, type StoreCatalog, type StoreOffer } from '../../services/storeBilling.js';
import { IconButton, Button, Badge, ToastService, Icon } from '../../components/common/index.js';
import type { IconName } from '../../components/common/Icon.js';
import { GradientFill } from '../../components/common/GradientFill.js';
import { Shine } from '../../components/common/Shine.js';
import { AppAlert } from '../../components/common/AppDialog.js';

/**
 * Premium: ₹1 for the first day, then ₹499/month — the only plan (no free plan) — plus ₹49 message packs.
 * Prices shown are Google Play's own (localized); the price and the auto-renewal are stated in plain
 * words right above the button — no surprise charges.
 */

const PLAN_LABEL: Record<BasePlan, { title: string; per: string; note?: string }> = {
  monthly: { title: 'Monthly', per: '/month' },
  weekly: { title: 'Weekly', per: '/week' },
  yearly: { title: 'Yearly', per: '/year', note: 'Save 17%' },
};
// One plan (owner's decision, 15 Oct 2026): monthly, starting with the ₹1 first day. The other base plans stay in
// the type so a catalog that still has them doesn't break, but they aren't offered.
const ORDER: BasePlan[] = ['monthly'];

const BENEFITS: Array<{ icon: IconName; title: string; sub: string; color: string; tint: string }> = [
  { icon: 'chat', title: 'Every character', sub: 'Up to 150 messages a day', color: '#C4B5FD', tint: 'rgba(139,92,246,0.18)' },
  { icon: 'book', title: 'Full courses and programs', sub: 'Step by step, at your pace', color: '#93C5FD', tint: 'rgba(59,130,246,0.16)' },
  { icon: 'brain', title: 'They remember you', sub: 'Your days, your people, your goals', color: '#F9A8D4', tint: 'rgba(236,72,153,0.16)' },
  { icon: 'shield', title: 'Crisis help is always free', sub: 'With or without Premium', color: '#6EE7B7', tint: 'rgba(16,185,129,0.16)' },
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

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    StoreBilling.loadCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setCatalog({ connected: false, offers: {} }));
    return () => {
      alive = false;
    };
  }, [attempt]);
  const retry = () => {
    setCatalog(null);
    setAttempt((n) => n + 1);
  };
  // As the Premium tab there's nowhere to close to; opened from a limit or a locked character, there is.
  const isTab = route.name === 'BuyPro';

  const offer: StoreOffer | undefined = catalog?.offers[selected];
  const trial = selected === 'monthly' ? offer?.trial : undefined;
  const trialDays = trial?.days ?? 1;
  const firstCharge = useMemo(() => fmtDate(new Date(Date.now() + trialDays * 86_400_000)), [trialDays]);
  const resetTime = resetsAt ? new Date(resetsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'midnight';

  const title =
    reason === 'fair_use'
      ? "You've reached today's 150 messages"
      : reason === 'free_limit'
        ? `Start chatting for ${trial?.price ?? '₹1'}`
        : 'Go Premium';
  const subtitle =
    reason === 'fair_use'
      ? `Your messages refill at ${resetTime}. Can't wait? Add 100 messages now.`
      : reason === 'free_limit'
        ? 'Premium opens every character — up to 150 messages a day. Your first day is just ₹1.'
        : 'Keep talking with the people who get you.';

  const finish = (r: { ok: boolean; message?: string }, success: string) => {
    if (r.ok) {
      ToastService.show({ message: success, type: 'success', duration: 2500 });
      void loadBillingState();
      navigation.goBack();
    } else if (r.message) {
      AppAlert.alert('Purchase', r.message);
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
    else AppAlert.alert('Nothing to restore', 'No active purchase was found on this Google account.');
  };

  const loading = catalog === null;
  const storeReady = !loading && Object.keys(catalog?.offers ?? {}).length > 0;

  const disclosure = !offer
    ? ''
    : trial
      ? `${trial.price} today. Then ${offer.price}/month from ${trialDays === 1 ? `tomorrow (${firstCharge})` : firstCharge}, charged automatically. Cancel anytime in Google Play — cancel before then and you won't be charged ${offer.price}.`
      : `${offer.price}${PLAN_LABEL[selected].per}. Renews automatically until you cancel — cancel anytime in Google Play.`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill radial colors={[['#A855F7', 0.34], ['#EC4899', 0.1], ['#0B0614', 0]]} />
      </View>
      <View style={styles.topBar}>
        {isTab ? <View /> : <IconButton icon="close" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Close" />}
        <Button label="Restore" variant="ghost" size="sm" onPress={restore} disabled={busy !== null} accessibilityLabel="Restore purchases" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.crownHalo}>
            <View style={styles.crown}>
              <GradientFill colors={['#7C3AED', '#DB2777']} />
              <Icon name="diamond" size={30} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* What Premium gives — shown right away, even before Google Play answers. */}
        {!isPremium && reason !== 'fair_use' && (
          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <View style={[styles.benefitIcon, { backgroundColor: b.tint }]}>
                  <Icon name={b.icon} size={18} color={b.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!StoreBilling.isAvailable ? (
          <Text style={styles.notice}>{StoreBilling.unavailableMessage}</Text>
        ) : loading ? (
          <ActivityIndicator color={darkThemeColors.accent} style={{ marginVertical: spacing.xl }} />
        ) : !storeReady ? (
          <View style={styles.noticeBox}>
            <Text style={styles.notice}>
              {catalog?.connected
                ? 'Premium plans are not available on this version of the app yet. Please update the app from Google Play.'
                : "Couldn't reach Google Play. Check your connection and try again."}
            </Text>
            {!catalog?.connected && <Button label="Try again" variant="secondary" size="sm" onPress={retry} accessibilityLabel="Try again" />}
          </View>
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
                          {p === 'monthly' && o.trial && <Badge label={`${o.trial.price} for ${o.trial.days === 1 ? 'the first day' : `${o.trial.days} days`}`} variant="success" size="sm" />}
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
                <View style={styles.ctaWrap}>
                  <Button
                    label={busy === 'subscribe' ? 'Opening Google Play…' : trial ? `Start for ${trial.price}` : 'Subscribe'}
                    onPress={subscribe}
                    disabled={busy !== null || !offer}
                    accessibilityLabel={disclosure}
                  />
                  <Shine active={busy === null && Boolean(offer)} />
                </View>
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
  ctaWrap: { borderRadius: radius.md, overflow: 'hidden' },
  container: { flex: 1, backgroundColor: '#0B0614' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { color: darkThemeColors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  notice: { color: darkThemeColors.textSecondary, textAlign: 'center', lineHeight: 21 },
  crownHalo: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(236,72,153,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  crown: { width: 66, height: 66, borderRadius: 33, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  benefits: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '700' },
  benefitSub: { color: darkThemeColors.textMuted, fontSize: 13, marginTop: 1 },
  noticeBox: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
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
