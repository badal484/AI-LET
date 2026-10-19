import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../common/BottomSheet.js';
import { ToastService } from '../common/Toast.js';
import { StoreBilling, type CoinPack } from '../../services/storeBilling.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { tapFeedback } from '../../utils/motion.js';
import { GradientFill } from '../common/GradientFill.js';
import { loadUpiConfig, payWithRazorpay, rupees } from '../../services/razorpayCheckout.js';

/**
 * "Get coins": the three Google Play coin packs. Coins pay for gifts and for messages beyond the daily
 * allowance. Prices are Play's own (localized); how many coins each pack gives is our server's.
 */
const BADGE: Record<string, string> = { coins_100: 'Starter', coins_330: '+10% extra', coins_1000: 'BEST · +25%' };

export const CoinStoreSheet: React.FC<{ visible: boolean; onClose: () => void; reason?: string }> = ({ visible, onClose, reason }) => {
  const [packs, setPacks] = useState<CoinPack[] | null>(null);
  /** Google Play's packs when Play can sell them; otherwise the same packs paid with UPI (Razorpay). */
  const [viaUpi, setViaUpi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const balance = useBillingStore((s) => s.creditWallet?.availableBalance ?? 0);
  const reload = useBillingStore((s) => s.loadBillingState);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setPacks(null);
    void reload().catch(() => undefined); // their current balance
    (async () => {
      const play = await StoreBilling.loadCoinPacks().catch(() => [] as CoinPack[]);
      const cfg = await loadUpiConfig();
      // Play's own sheet already offers UPI when user choice billing is on; without Play packs, go straight to UPI.
      if (play.length > 0 || !cfg?.enabled) {
        if (alive) setPacks(play);
        return;
      }
      if (!alive) return;
      setViaUpi(true);
      setPacks(cfg.coinPacks.map((p) => ({ id: p.id, coins: p.coins, price: rupees(p.amountMinorUnits) })));
    })();
    return () => {
      alive = false;
    };
  }, [visible, reload]);

  const buy = async (pack: CoinPack) => {
    tapFeedback();
    setBusy(pack.id);
    const r = viaUpi ? await payWithRazorpay({ kind: 'coins', packId: pack.id }) : await StoreBilling.buyCoins(pack.id);
    setBusy(null);
    if (r.ok) {
      await reload().catch(() => undefined);
      ToastService.show({ message: `🪙 ${pack.coins} coins added`, type: 'success', duration: 2500 });
      onClose();
    } else if (r.message) {
      ToastService.show({ message: r.message, type: 'error', duration: 3500 });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        {/* A glowing coin and what they have now. */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} pointerEvents="none">
            <GradientFill radial colors={[['#F59E0B', 0.35], ['#A855F7', 0.12], ['#0B0614', 0]]} />
          </View>
          <Text style={styles.heroCoin}>🪙</Text>
          <Text style={styles.heroTitle}>Get coins</Text>
          <Text style={styles.heroSub}>
            You have <Text style={styles.heroBalance}>{balance.toLocaleString('en-IN')}</Text> · for gifts and extra messages
          </Text>
        </View>
        {reason ? <Text style={styles.reason}>{reason}</Text> : null}

        {packs === null ? (
          <ActivityIndicator color="#C4B5FD" style={{ marginVertical: 24 }} />
        ) : packs.length === 0 ? (
          <Text style={styles.empty}>Coin packs aren't available right now. Please try again later.</Text>
        ) : (
          <View style={styles.grid}>
            {packs.map((pack) => {
              const best = pack.id === 'coins_1000';
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => buy(pack)}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.tile, best && styles.tileBest, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${pack.coins} coins for ${pack.price}`}
                >
                  {best && <GradientFill colors={[['#7C3AED', 0.55], ['#DB2777', 0.45]]} vertical />}
                  {BADGE[pack.id] ? (
                    <View style={[styles.ribbon, best && styles.ribbonBest]}>
                      <Text style={styles.ribbonText}>{BADGE[pack.id]}</Text>
                    </View>
                  ) : (
                    <View style={styles.ribbonSpace} />
                  )}
                  <Text style={styles.tileCoin}>{best ? '💰' : '🪙'}</Text>
                  <Text style={styles.tileCount}>{pack.coins.toLocaleString('en-IN')}</Text>
                  <Text style={styles.tileUnit}>coins</Text>
                  <View style={[styles.pricePill, best && styles.pricePillBest]}>
                    {busy === pack.id ? <ActivityIndicator color={best ? '#6D28D9' : '#FFFFFF'} size="small" /> : <Text style={[styles.priceText, best && styles.priceTextBest]}>{pack.price}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.note}>Coins never expire</Text>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8 },
  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
  heroGlow: { position: 'absolute', top: -30, left: -40, right: -40, height: 170 },
  heroCoin: { fontSize: 44 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  heroSub: { color: '#B9B2CC', fontSize: 13.5, marginTop: 4, textAlign: 'center' },
  heroBalance: { color: '#FCD34D', fontWeight: '800' },
  reason: { color: '#B9B2CC', fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  empty: { color: '#9E97B0', fontSize: 14, textAlign: 'center', marginVertical: 16 },
  grid: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1428',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tileBest: { borderColor: '#E879F9', borderWidth: 1.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  ribbon: { alignSelf: 'stretch', paddingVertical: 4, backgroundColor: 'rgba(167,139,250,0.22)', alignItems: 'center' },
  ribbonBest: { backgroundColor: 'rgba(0,0,0,0.25)' },
  ribbonSpace: { height: 22 },
  ribbonText: { color: '#F5E9FF', fontSize: 10.5, fontWeight: '800' },
  tileCoin: { fontSize: 30, marginTop: 10 },
  tileCount: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 4 },
  tileUnit: { color: '#C9C2D9', fontSize: 12, marginTop: -2 },
  pricePill: { marginTop: 10, minWidth: 64, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pricePillBest: { backgroundColor: '#FFFFFF' },
  priceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  priceTextBest: { color: '#6D28D9' },
  note: { color: '#7E778F', fontSize: 12, textAlign: 'center' },
});
