import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../common/BottomSheet.js';
import { ToastService } from '../common/Toast.js';
import { StoreBilling, type CoinPack } from '../../services/storeBilling.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { tapFeedback } from '../../utils/motion.js';

/**
 * "Get coins": the three Google Play coin packs. Coins pay for gifts and for messages beyond the daily
 * allowance. Prices are Play's own (localized); how many coins each pack gives is our server's.
 */
const BADGE: Record<string, string> = { coins_330: '+10% extra', coins_1000: 'Best value · +25%' };

export const CoinStoreSheet: React.FC<{ visible: boolean; onClose: () => void; reason?: string }> = ({ visible, onClose, reason }) => {
  const [packs, setPacks] = useState<CoinPack[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const balance = useBillingStore((s) => s.creditWallet?.availableBalance ?? 0);
  const reload = useBillingStore((s) => s.loadBillingState);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setPacks(null);
    void reload().catch(() => undefined); // their current balance
    StoreBilling.loadCoinPacks()
      .then((p) => alive && setPacks(p))
      .catch(() => alive && setPacks([]));
    return () => {
      alive = false;
    };
  }, [visible, reload]);

  const buy = async (pack: CoinPack) => {
    tapFeedback();
    setBusy(pack.id);
    const r = await StoreBilling.buyCoins(pack.id);
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
    <BottomSheet visible={visible} onClose={onClose} title="Get coins">
      <View style={styles.body}>
        <Text style={styles.balance}>You have 🪙 {balance.toLocaleString('en-IN')}</Text>
        {reason ? <Text style={styles.reason}>{reason}</Text> : null}

        {packs === null ? (
          <ActivityIndicator color="#C4B5FD" style={{ marginVertical: 24 }} />
        ) : packs.length === 0 ? (
          <Text style={styles.empty}>Coin packs aren't available right now. Please try again later.</Text>
        ) : (
          packs.map((pack) => (
            <Pressable
              key={pack.id}
              onPress={() => buy(pack)}
              disabled={busy !== null}
              style={({ pressed }) => [styles.pack, pack.id === 'coins_1000' && styles.packBest, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${pack.coins} coins for ${pack.price}`}
            >
              <Text style={styles.coinIcon}>🪙</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.coins}>{pack.coins.toLocaleString('en-IN')} coins</Text>
                {BADGE[pack.id] ? <Text style={styles.badge}>{BADGE[pack.id]}</Text> : null}
              </View>
              {busy === pack.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.price}>{pack.price}</Text>}
            </Pressable>
          ))
        )}

        <Text style={styles.note}>Coins pay for gifts and for messages after your daily 150. They never expire.</Text>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 8 },
  balance: { color: '#F5E9FF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  reason: { color: '#B9B2CC', fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  empty: { color: '#9E97B0', fontSize: 14, textAlign: 'center', marginVertical: 16 },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#1A1428',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  packBest: { borderColor: '#A78BFA', backgroundColor: '#211836' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  coinIcon: { fontSize: 28 },
  coins: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  badge: { color: '#C4B5FD', fontSize: 12, fontWeight: '700', marginTop: 2 },
  price: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  note: { color: '#7E778F', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
