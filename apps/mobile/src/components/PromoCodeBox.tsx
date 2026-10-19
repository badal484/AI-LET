import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useBillingStore } from '../stores/billingStore.js';
import { Icon } from './common/index.js';
import { GradientFill } from './common/GradientFill.js';
import { tapFeedback } from '../utils/motion.js';

/**
 * "Have a code?" — codes made in the admin console (Settings → Promo codes): free Premium days or free coins.
 * Folded into one quiet row until tapped; the result (what they got) is shown right in the box.
 */
export const PromoCodeBox: React.FC = () => {
  const { redeemPromoCode, loadBillingState } = useBillingStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const redeem = async () => {
    if (code.trim().length < 3 || busy) return;
    tapFeedback();
    setBusy(true);
    setResult(null);
    const r = await redeemPromoCode(code.trim().toUpperCase()).catch(() => ({
      success: false,
      message: "Couldn't check the code.",
    }));
    setBusy(false);
    setResult({ ok: r.success, text: r.success ? r.message : cleanError(r.message) });
    if (r.success) {
      setCode('');
      void loadBillingState();
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.rowEmoji}>🎁</Text>
        <Text style={styles.rowText}>Have a code?</Text>
        <Icon name="arrow-right" size={16} color="#8E86A3" />
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <GradientFill
        radial
        colors={[
          ['#EC4899', 0.2],
          ['#8B5CF6', 0.06],
          ['#1A1428', 0],
        ]}
      />
      <Text style={styles.title}>Enter your code</Text>
      <Text style={styles.sub}>Free Premium days or coins — from Loveek or a friend.</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={code}
          onChangeText={t => {
            setCode(t.toUpperCase().replace(/\s/g, ''));
            setResult(null);
          }}
          placeholder="LAUNCH30"
          placeholderTextColor="#5E5670"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={30}
          style={styles.input}
          onSubmitEditing={() => void redeem()}
          returnKeyType="done"
        />
        <Pressable
          onPress={() => void redeem()}
          disabled={busy || code.trim().length < 3}
          style={({ pressed }) => [
            styles.apply,
            (busy || code.trim().length < 3) && styles.off,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <GradientFill colors={['#7C3AED', '#DB2777']} />
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.applyText}>Apply</Text>
          )}
        </Pressable>
      </View>
      {result ? (
        <Text style={[styles.result, result.ok ? styles.ok : styles.bad]}>{result.text}</Text>
      ) : null}
    </View>
  );
};

/** "Promotion code 'X' has expired" → "This code has expired." */
function cleanError(m: string): string {
  if (/already redeemed/i.test(m)) return 'You’ve already used this code.';
  if (/expired|limit/i.test(m)) return 'This code has expired.';
  if (/invalid|not found|can.t be used/i.test(m))
    return 'That code doesn’t work. Check the spelling?';
  return m || 'That code doesn’t work.';
}

const styles = StyleSheet.create({
  row: {
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
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.14)',
  },
  rowEmoji: { fontSize: 18 },
  rowText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  box: {
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1428',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  sub: { color: '#B9B2CC', fontSize: 13, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  input: {
    flex: 1,
    height: 50,
    color: '#FFFFFF',
    backgroundColor: '#120D1D',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.5)',
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
  },
  apply: {
    width: 92,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.5 },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  result: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  ok: { color: '#6EE7B7' },
  bad: { color: '#FCA5A5' },
});
