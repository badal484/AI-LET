import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBillingStore } from '../stores/billingStore.js';
import { ToastService } from './common/index.js';
import { darkThemeColors, spacing } from '../theme/index.js';

/** "Have a promo code?" — codes made in the admin console (Settings → Promo codes). */
export const PromoCodeBox: React.FC = () => {
  const { redeemPromoCode, loadBillingState } = useBillingStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    setBusy(true);
    const r = await redeemPromoCode(code.trim().toUpperCase()).catch(() => ({ success: false, message: 'Could not check the code.' }));
    setBusy(false);
    ToastService.show({ message: r.message || (r.success ? 'Code applied 🎉' : 'That code does not work.'), type: r.success ? 'success' : 'error', duration: 3000 });
    if (r.success) {
      setCode('');
      setOpen(false);
      void loadBillingState();
    }
  };

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.link} accessibilityRole="button">
        <Text style={styles.linkText}>Have a promo code?</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.box}>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="e.g. FRIEND50"
        placeholderTextColor={darkThemeColors.textMuted}
        autoCapitalize="characters"
        autoFocus
        style={styles.input}
        onSubmitEditing={() => void redeem()}
      />
      <TouchableOpacity onPress={() => void redeem()} disabled={busy || code.trim().length < 3} style={[styles.apply, (busy || code.trim().length < 3) && styles.disabled]}>
        <Text style={styles.applyText}>{busy ? '…' : 'Apply'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: spacing.md },
  linkText: { color: '#F472B6', fontSize: 14, fontWeight: '600' },
  box: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  input: {
    flex: 1,
    color: darkThemeColors.textPrimary,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    letterSpacing: 1,
  },
  apply: { paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, backgroundColor: darkThemeColors.accent },
  disabled: { opacity: 0.5 },
  applyText: { color: '#FFFFFF', fontWeight: '700' },
});
