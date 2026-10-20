import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useBillingStore } from '../../stores/billingStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { StoreBilling, type StoreCatalog } from '../../services/storeBilling.js';
import { IconButton, ToastService, Icon } from '../../components/common/index.js';
import type { IconName } from '../../components/common/Icon.js';
import { GradientFill } from '../../components/common/GradientFill.js';
import { Shine } from '../../components/common/Shine.js';
import { AppAlert } from '../../components/common/AppDialog.js';
import {
  loadUpiConfig,
  payWithRazorpay,
  rupees,
  type UpiConfig,
} from '../../services/razorpayCheckout.js';
import { tapFeedback } from '../../utils/motion.js';
import { thumb } from '../../utils/thumb.js';

/**
 * Premium: ₹1 for the first day, then ₹499/month — the only plan — plus coin packs.
 * Three faces, one big price, four short benefits, and one button. Razorpay's own sheet picks UPI or card;
 * promo codes live on Your Premium.
 * Pays with Google Play (and its "Play or UPI" choice) when Play can sell; otherwise UPI / cards via Razorpay.
 */

const LOGO = require('../../assets/brand/logo.png');

type Benefit = { icon: IconName; title: string; sub: string; from: string; to: string };
const benefits = (hinglish: boolean): Benefit[] => [
  {
    icon: 'chat',
    title: 'Talk every day',
    sub: hinglish ? 'roz 150 messages, bina rukawat' : '150 messages a day, no waiting',
    from: '#7C3AED',
    to: '#4F46E5',
  },
  {
    icon: 'brain',
    title: 'They remember you',
    sub: hinglish ? 'tumhari har baat yaad rahegi' : 'your days, your people, your goals',
    from: '#DB2777',
    to: '#9333EA',
  },
  {
    icon: 'heart-filled',
    title: 'Deeper connection',
    sub: hinglish ? 'sacha aur pyara rishta' : 'a real, warm bond',
    from: '#E11D48',
    to: '#C026D3',
  },
  {
    icon: 'book',
    title: 'Learn & earn',
    sub: hinglish ? 'coding, freelancing, jobs, YouTube, Instagram — kamai ke raaste' : 'coding, freelancing, jobs, YouTube, Instagram — ways to earn',
    from: '#059669',
    to: '#2563EB',
  },
];

export const PaywallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const reason: 'free_limit' | 'fair_use' | undefined = route.params?.reason;
  const resetsAt: string | undefined = route.params?.resetsAt;
  const isTab = route.name === 'BuyPro';

  const { loadBillingState, subscription } = useBillingStore();
  const user = useAuthStore(s => s.user);
  const hinglish = (user?.profile?.preferredLanguage ?? 'hinglish') !== 'en';
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [payRoute, setPayRoute] = useState<'choice' | 'upi' | 'play' | 'none' | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Always opens at the top (the faces and the price), never where it was last scrolled.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Android scrolls a page to a focused button when content loads in (the faces, the price): keep it at the top
  // until they scroll themselves.
  const userScrolled = useRef(false);
  const toTop = useCallback(() => {
    if (!userScrolled.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      userScrolled.current = false;
      toTop();
      void loadBillingState();
      const t1 = setTimeout(toTop, 50);
      const t2 = setTimeout(toTop, 200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [toTop, loadBillingState]),
  );

  // Typing a code: lift the page above the keyboard (and hide the pay bar meanwhile) so the box stays visible.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboard(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  // The face on top: one character chosen in admin Settings, with their photo as it is now (fetched fresh, so a
  // new photo or a different character shows without an app update).
  const [face, setFace] = useState<{ name: string; uri: string } | null>(null);
  const [sides, setSides] = useState<string[]>([]);
  const [upi, setUpi] = useState<UpiConfig | null>(() => StoreBilling.upiConfig());

  useEffect(() => {
    let alive = true;
    void loadUpiConfig(true).then(c => {
      if (!alive) return;
      if (c) setUpi(c);
      setFace(c?.face ? { name: c.face.name, uri: c.face.avatarUrl } : null);
      setSides((c?.sideFaces ?? []).map(f => f.avatarUrl));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    StoreBilling.loadCatalog()
      .then(c => alive && setCatalog(c))
      .catch(() => alive && setCatalog({ connected: false, offers: {} }));
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (catalog === null) return;
    let alive = true;
    void StoreBilling.route(Object.keys(catalog.offers).length > 0).then(
      r => alive && setPayRoute(r),
    );
    return () => {
      alive = false;
    };
  }, [catalog]);

  useEffect(() => {
    toTop();
    const t = setTimeout(toTop, 150);
    return () => clearTimeout(t);
  }, [face, sides, catalog, payRoute, toTop]);

  // Prices: Google Play's own when it sells; otherwise the server's (Razorpay).
  const playOffer = catalog?.offers.monthly;
  const viaPlay = payRoute === 'choice' || payRoute === 'play';
  // A user who already has or had a subscription record (active, trialed, or cancelled) is never eligible for ₹1 trial.
  const hasPriorSubscription = Boolean(subscription);
  const eligibleForTrial =
    upi?.eligibleForTrial !== undefined ? upi.eligibleForTrial : !hasPriorSubscription;
  const firstIsTrial = viaPlay ? Boolean(playOffer?.trial) : eligibleForTrial;
  const first = viaPlay
    ? (playOffer?.trial?.price ?? playOffer?.price ?? '₹1')
    : rupees(upi?.premium.firstDayMinorUnits ?? 100);
  const monthly = viaPlay
    ? (playOffer?.price ?? '₹499')
    : rupees(upi?.premium.monthlyMinorUnits ?? 49_900);
  const packPrice = viaPlay
    ? catalog?.pack?.price
    : upi?.coinPacks.find(p => p.id === 'coins_100') &&
      rupees(upi!.coinPacks.find(p => p.id === 'coins_100')!.amountMinorUnits);
  const loading = catalog === null || payRoute === null;
  const canSell = payRoute !== null && payRoute !== 'none';

  const mode: 'premium' | 'pack' | 'manage' =
    isPremium && reason !== 'fair_use' ? 'manage' : reason === 'fair_use' ? 'pack' : 'premium';

  const finish = (r: { ok: boolean; message?: string }, success: string) => {
    if (r.ok) {
      ToastService.show({ message: success, type: 'success', duration: 2500 });
      void loadBillingState();
      if (!isTab) navigation.goBack();
    } else if (r.message) {
      AppAlert.alert('Payment', r.message);
    }
  };

  const go = async () => {
    tapFeedback();
    if (mode === 'manage') return navigation.navigate('SubscriptionManagement');
    if (!canSell) return;
    setBusy(true);
    let r: { ok: boolean; message?: string };
    if (mode === 'pack') {
      r = viaPlay
        ? await StoreBilling.buyPack()
        : await payWithRazorpay({ kind: 'coins', packId: 'coins_100' });
    } else {
      r =
        viaPlay && playOffer
          ? await StoreBilling.buySubscription(playOffer, Boolean(playOffer.trial))
          : await payWithRazorpay({ kind: 'premium' });
    }
    setBusy(false);
    finish(r, mode === 'pack' ? '100 coins added — 50 more messages ✨' : 'Welcome to Premium 💜');
  };

  const restore = async () => {
    const n = await StoreBilling.restore().catch(() => 0);
    if (n > 0) finish({ ok: true }, 'Purchases restored');
    else
      AppAlert.alert('Nothing to restore', 'No active purchase was found on this Google account.');
  };

  const resetTime = resetsAt
    ? new Date(resetsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : 'midnight';
  const ctaLabel = busy
    ? 'Opening…'
    : mode === 'manage'
      ? 'Manage Premium'
      : mode === 'pack'
        ? `Add 50 messages · ${packPrice ?? '₹49'}`
        : firstIsTrial
          ? `Start for ${first}`
          : `Subscribe · ${monthly}/mo`;
  // Premium's terms are already in the price line above (and in the button's label for screen readers).
  const legal =
    mode === 'pack'
      ? '100 coins, one-time. Each extra message after your daily 150 is 2 coins.'
      : '';
  const terms = firstIsTrial
    ? `${first} today, then ${monthly}/month. Auto-renews · cancel anytime${viaPlay ? ' in Google Play' : ''}.`
    : `${monthly}/month. Auto-renews · cancel anytime${viaPlay ? ' in Google Play' : ''}.`;

  return (
    <View style={styles.container}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill
          radial
          colors={[
            ['#7C3AED', 0.45],
            ['#4338CA', 0.18],
            ['#0B0614', 0],
          ]}
        />
      </View>

      {/* Floating top bar — never creates an artificial clipping line / empty block */}
      {!isTab || (viaPlay && mode !== 'manage') ? (
        <View style={[styles.topBar, { top: insets.top }]}>
          {!isTab ? (
            <IconButton
              icon="close"
              size="sm"
              variant="glass"
              onPress={() => navigation.goBack()}
              accessibilityLabel="Close"
            />
          ) : (
            <View />
          )}
          {viaPlay && mode !== 'manage' ? (
            <Pressable onPress={restore} hitSlop={10} accessibilityRole="button">
              <Text style={styles.restore}>Restore</Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (isTab ? 12 : 48),
            paddingBottom: keyboard ? keyboard + 24 : 110 + (isTab ? 0 : insets.bottom),
          },
        ]}
      >
        {/* The person they talk to — in a soft glowing shape, saying hi. */}
        <View style={styles.hero}>
          {/* Two more faces behind, tilted out to the sides — a glimpse of who else is there. */}
          {sides.map((uri, i) => (
            <View key={uri + i} style={[styles.side, i === 0 ? styles.sideLeft : styles.sideRight]}>
              <View style={styles.sideBlob}>
                <GradientFill
                  colors={i === 0 ? ['#4338CA', '#7C3AED'] : ['#9333EA', '#DB2777']}
                  vertical
                />
              </View>
              <View style={styles.sideRing}>
                <Image source={{ uri: thumb(uri, 110) }} style={styles.photo} resizeMode="cover" />
              </View>
            </View>
          ))}
          <View style={styles.blobBack}>
            <GradientFill colors={['#6D28D9', '#4338CA']} vertical />
          </View>
          <View style={styles.blobFront}>
            <GradientFill colors={['#DB2777', '#7C3AED']} vertical />
          </View>
          <View style={styles.photoRing}>
            <Image
              source={face ? { uri: thumb(face.uri, 150) } : LOGO}
              style={styles.photo}
              resizeMode="cover"
            />
          </View>
          {face ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {hinglish ? `Hey, main ${face.name} hoon 💜` : `Hey, it's ${face.name} 💜`}
              </Text>
            </View>
          ) : null}
        </View>

        {mode === 'premium' && (
          <View style={styles.priceBlock}>
            <Text style={styles.kicker}>
              {reason === 'free_limit' ? 'Keep talking' : 'Start Premium'}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.at}>{firstIsTrial ? 'at' : ''}</Text>
              <Text style={styles.bigPrice} adjustsFontSizeToFit numberOfLines={1}>
                {firstIsTrial ? first : monthly}
              </Text>
            </View>
            <Text style={styles.priceSub}>
              {firstIsTrial
                ? `then ${monthly}/month · auto-renews · cancel anytime`
                : 'per month · auto-renews · cancel anytime'}
            </Text>
          </View>
        )}
        {mode === 'pack' && (
          <View style={styles.priceBlock}>
            <Text style={styles.title}>You've used today's 150</Text>
            <Text style={styles.priceSub}>Messages refill at {resetTime}. Can't wait?</Text>
          </View>
        )}
        {mode === 'manage' && (
          <View style={styles.priceBlock}>
            <Text style={styles.title}>You're Premium 💜</Text>
            <Text style={styles.priceSub}>
              Talk as much as you like.
            </Text>
          </View>
        )}

        {mode !== 'pack' && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>
                {mode === 'manage' ? 'Your Premium' : 'What you get'}
              </Text>
              <View style={styles.line} />
            </View>
            {benefits(hinglish).map(b => (
              <View key={b.title} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <GradientFill colors={[b.from, b.to]} />
                  <Icon name={b.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {!loading && !canSell && mode !== 'manage' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {catalog?.connected
                ? 'Payments aren’t available on this version yet — please update the app.'
                : 'Couldn’t connect. Check your internet and try again.'}
            </Text>
            <Pressable
              onPress={() => {
                setPayRoute(null);
                setCatalog(null);
                setAttempt(n => n + 1);
              }}
              hitSlop={8}
            >
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* The bar: how they pay, and the button — always in reach. */}
      {/* As a tab, the tab bar already sits below (and keeps clear of the phone's gesture bar). */}
      {keyboard === 0 && (
        <View style={[styles.bar, { paddingBottom: isTab ? 8 : 8 + insets.bottom }]}>
          <View style={styles.barRow}>
            <Pressable
              onPress={go}
              disabled={busy || (mode !== 'manage' && (loading || !canSell))}
              style={({ pressed }) => [
                styles.cta,
                (busy || (mode !== 'manage' && (loading || !canSell))) && styles.ctaOff,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'premium'
                  ? `${ctaLabel}. ${terms}`
                  : legal
                    ? `${ctaLabel}. ${legal}`
                    : ctaLabel
              }
            >
              <GradientFill colors={['#7C3AED', '#DB2777']} />
              {loading && mode !== 'manage' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              )}
              <Shine active={!busy && !loading && canSell} />
            </Pressable>
          </View>
          {legal ? <Text style={styles.legal}>{legal}</Text> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0614' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 460 },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    height: 48,
  },
  restore: { color: '#C4B5FD', fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 20 },

  hero: { alignItems: 'center', justifyContent: 'center', height: 226, marginTop: 4 },
  blobBack: {
    position: 'absolute',
    width: 170,
    height: 150,
    borderRadius: 64,
    overflow: 'hidden',
    transform: [{ rotate: '-14deg' }, { translateX: -18 }],
    opacity: 0.9,
  },
  blobFront: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 72,
    overflow: 'hidden',
    transform: [{ rotate: '22deg' }, { translateX: 20 }, { translateY: 10 }],
    opacity: 0.85,
  },
  side: {
    position: 'absolute',
    top: 36,
    width: 112,
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.88,
  },
  sideLeft: { left: 4, transform: [{ rotate: '-10deg' }] },
  sideRight: { right: 4, transform: [{ rotate: '10deg' }] },
  sideBlob: {
    position: 'absolute',
    width: 120,
    height: 132,
    borderRadius: 56,
    overflow: 'hidden',
    opacity: 0.75,
  },
  sideRing: {
    width: 98,
    height: 124,
    borderRadius: 49,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: '#1A1230',
  },
  photoRing: {
    width: 150,
    height: 186,
    borderRadius: 75,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: '#1A1230',
  },
  photo: { width: '100%', height: '100%' },
  tag: {
    position: 'absolute',
    bottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#130B24',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.5)',
    maxWidth: '80%',
  },
  tagText: { color: '#F5E9FF', fontSize: 13, fontWeight: '700', fontStyle: 'italic' },

  priceBlock: { alignItems: 'center', marginTop: 10 },
  kicker: { color: '#E9D5FF', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: -2 },
  at: { color: '#E9D5FF', fontSize: 26, fontWeight: '700' },
  bigPrice: {
    color: '#F0ABFC',
    fontSize: 76,
    fontWeight: '900',
    letterSpacing: -2,
    textShadowColor: 'rgba(219,39,119,0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  priceSub: { color: '#B9B2CC', fontSize: 15, marginTop: 2, textAlign: 'center' },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 8,
  },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(196,181,253,0.25)' },
  dividerText: { color: '#C4B5FD', fontSize: 15, fontWeight: '700' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 11 },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  benefitSub: { color: '#B9B2CC', fontSize: 14, marginTop: 1 },

  notice: { alignItems: 'center', gap: 8, marginTop: 20 },
  noticeText: { color: '#B9B2CC', fontSize: 14, textAlign: 'center' },
  retry: { color: '#C4B5FD', fontSize: 14, fontWeight: '700' },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#0B0614',
    borderTopWidth: 1,
    borderTopColor: 'rgba(196,181,253,0.12)',
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cta: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.98 }] },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  legal: { color: '#8E86A3', fontSize: 11.5, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
