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
const BADGE: Record<string, string> = {
  coins_100: 'Starter',
  coins_330: '+10% Bonus',
  coins_1000: '🔥 Best · +25%',
};

const FALLBACK_PRICES: Record<string, string> = {
  coins_100: '₹49',
  coins_330: '₹149',
  coins_1000: '₹399',
};

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
      const playHasValidPrices = play.length > 0 && play.every((p) => Boolean(p.price));
      if (playHasValidPrices || !cfg?.enabled) {
        if (alive) {
          const withPrices = (play.length > 0 ? play : [
            { id: 'coins_100', coins: 100, price: '₹49' },
            { id: 'coins_330', coins: 330, price: '₹149' },
            { id: 'coins_1000', coins: 1000, price: '₹399' },
          ]).map((p) => ({ ...p, price: p.price || FALLBACK_PRICES[p.id] || 'Buy' }));
          setPacks(withPrices);
        }
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
            <GradientFill radial colors={[['#F59E0B', 0.45], ['#A855F7', 0.18], ['#130D22', 0]]} />
          </View>
          <Text style={styles.heroCoin}>🪙</Text>
          <Text style={styles.heroTitle}>Get Coins</Text>
          
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceLabel}>Your Balance: </Text>
            <Text style={styles.heroBalance}>🪙 {balance.toLocaleString('en-IN')} coins</Text>
          </View>
          <Text style={styles.heroSub}>Use coins for romantic gifts & unlocking extra messages</Text>
        </View>

        {reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reason}>{reason}</Text>
          </View>
        ) : null}

        {packs === null ? (
          <ActivityIndicator color="#C4B5FD" style={{ marginVertical: 28 }} />
        ) : packs.length === 0 ? (
          <Text style={styles.empty}>Coin packs aren't available right now. Please try again later.</Text>
        ) : (
          <View style={styles.grid}>
            {packs.map((pack) => {
              const best = pack.id === 'coins_1000';
              const displayPrice = pack.price || FALLBACK_PRICES[pack.id] || 'Buy';
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => buy(pack)}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.tile, best && styles.tileBest, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${pack.coins} coins for ${displayPrice}`}
                >
                  {best && <GradientFill colors={[['#8B5CF6', 0.6], ['#EC4899', 0.45]]} vertical />}
                  
                  {BADGE[pack.id] ? (
                    <View style={[styles.ribbon, best && styles.ribbonBest]}>
                      <Text style={[styles.ribbonText, best && styles.ribbonTextBest]}>{BADGE[pack.id]}</Text>
                    </View>
                  ) : (
                    <View style={styles.ribbonSpace} />
                  )}

                  <View style={[styles.coinHalo, best && styles.coinHaloBest]}>
                    <Text style={styles.tileCoin}>{best ? '💰' : '🪙'}</Text>
                  </View>

                  <Text style={styles.tileCount}>{pack.coins.toLocaleString('en-IN')}</Text>
                  <Text style={styles.tileUnit}>coins</Text>

                  <View style={[styles.pricePill, best && styles.pricePillBest]}>
                    {busy === pack.id ? (
                      <ActivityIndicator color={best ? '#4C1D95' : '#FFFFFF'} size="small" />
                    ) : (
                      <Text style={[styles.priceText, best && styles.priceTextBest]}>{displayPrice}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 10 },
  hero: { alignItems: 'center', paddingTop: 2, paddingBottom: 6 },
  heroGlow: { position: 'absolute', top: -30, left: -40, right: -40, height: 180 },
  heroCoin: { fontSize: 46 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 4, letterSpacing: -0.3 },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  balanceLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  heroBalance: { color: '#FCD34D', fontSize: 13.5, fontWeight: '800' },
  heroSub: { color: '#C4B5FD', fontSize: 13, marginTop: 7, textAlign: 'center', fontWeight: '500' },
  reasonBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  reason: { color: '#F5E9FF', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  empty: { color: '#C4B5FD', fontSize: 14, textAlign: 'center', marginVertical: 18 },
  grid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1E1632',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
  },
  tileBest: {
    borderColor: '#F472B6',
    borderWidth: 1.5,
    backgroundColor: '#24143D',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  ribbon: {
    alignSelf: 'stretch',
    paddingVertical: 4.5,
    backgroundColor: 'rgba(139, 92, 246, 0.32)',
    alignItems: 'center',
  },
  ribbonBest: {
    backgroundColor: 'rgba(236, 72, 153, 0.45)',
  },
  ribbonSpace: { height: 24 },
  ribbonText: { color: '#E9D5FF', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  ribbonTextBest: { color: '#FFFFFF', fontWeight: '900' },
  coinHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  coinHaloBest: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  tileCoin: { fontSize: 28 },
  tileCount: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 6 },
  tileUnit: { color: '#D8B4FE', fontSize: 12, marginTop: -2, fontWeight: '600' },
  pricePill: {
    marginTop: 12,
    minWidth: 72,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  pricePillBest: {
    backgroundColor: '#FDE047',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.5,
  },
  priceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  priceTextBest: { color: '#3B0764', fontSize: 14, fontWeight: '900' },
});
