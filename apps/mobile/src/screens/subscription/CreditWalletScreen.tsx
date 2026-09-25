import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { CreditTransactionItem } from '@ai-companion/types';
import { IconButton } from '../../components/common/index.js';

interface PackOption {
  id: string;
  name: string;
  credits: number;
  priceUSD: string;
  popular?: boolean;
}

const CREDIT_PACKS: PackOption[] = [
  { id: 'credit_pack_500_usd', name: 'Starter Pack', credits: 500, priceUSD: '$4.99' },
  { id: 'credit_pack_2000_usd', name: 'Popular Pack', credits: 2000, priceUSD: '$14.99', popular: true },
  { id: 'credit_pack_5000_usd', name: 'Power Pack', credits: 5000, priceUSD: '$29.99' },
];

export const CreditWalletScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    creditWallet,
    recentCreditTransactions,
    isLoading,
    purchaseState,
    loadCredits,
    purchaseCreditPack,
    redeemPromoCode,
  } = useBillingStore();

  const [promoInput, setPromoInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string>(CREDIT_PACKS[1].id);

  useEffect(() => {
    loadCredits();
  }, []);

  const handleRedeem = async () => {
    if (!promoInput.trim()) {
      Alert.alert('Promo Code Required', 'Please enter a valid promotional code.');
      return;
    }

    setIsRedeeming(true);
    const result = await redeemPromoCode(promoInput.trim().toUpperCase());
    setIsRedeeming(false);

    if (result.success) {
      Alert.alert('Success', result.message);
      setPromoInput('');
    } else {
      Alert.alert('Invalid Code', result.message);
    }
  };

  const handlePurchasePack = async (pack: PackOption) => {
    try {
      const success = await purchaseCreditPack(pack.id);
      if (success) {
        Alert.alert('Credits Added!', `Successfully added ${pack.credits.toLocaleString()} AI credits to your wallet.`);
      } else {
        Alert.alert('Purchase unavailable', useBillingStore.getState().errorMessage ?? 'Could not complete credit purchase.');
      }
    } catch (err: any) {
      Alert.alert('Purchase Failed', err?.message || 'Could not complete credit purchase.');
    }
  };

  const formatTxType = (type: string) => {
    switch (type) {
      case 'purchase':
        return { label: 'Purchased Credits', sign: '+', color: darkThemeColors.success };
      case 'grant':
      case 'promotion':
      case 'trial':
        return { label: 'Promotional Grant', sign: '+', color: darkThemeColors.accent };
      case 'consumption':
        return { label: 'Used in Conversation', sign: '-', color: darkThemeColors.textMuted };
      case 'refund':
      case 'reversal':
        return { label: 'Refunded / Reversed', sign: '-', color: darkThemeColors.danger };
      default:
        return { label: type, sign: '', color: darkThemeColors.textSecondary };
    }
  };

  const isBusy = isLoading || purchaseState === 'verifying';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>AI Credits Wallet</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Wallet Balance Hero Card */}
        <View style={styles.balanceHeroCard}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceTotal}>
            {creditWallet ? creditWallet.availableBalance.toLocaleString() : '0'}{' '}
            <Text style={styles.balanceUnit}>Credits</Text>
          </Text>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownItemLabel}>Promotional</Text>
              <Text style={styles.breakdownItemVal}>
                {creditWallet?.promotionalCredits.toLocaleString() || 0}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownItemLabel}>Purchased</Text>
              <Text style={styles.breakdownItemVal}>
                {creditWallet?.purchasedCredits.toLocaleString() || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Redeem Promotion Code */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Redeem Promo Code</Text>
          <View style={styles.promoInputRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="e.g. WELCOME500"
              placeholderTextColor={darkThemeColors.textMuted}
              value={promoInput}
              onChangeText={setPromoInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.redeemButton, isRedeeming && styles.buttonDisabled]}
              onPress={handleRedeem}
              disabled={isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.redeemButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Buy Credit Packs */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Purchase Credit Packs</Text>
          <Text style={styles.sectionSub}>Credits never expire and apply when plan limits are reached.</Text>

          <View style={styles.packsList}>
            {CREDIT_PACKS.map(pack => (
              <TouchableOpacity
                key={pack.id}
                style={[
                  styles.packCard,
                  selectedPackId === pack.id && styles.packCardSelected,
                ]}
                onPress={() => setSelectedPackId(pack.id)}
                activeOpacity={0.8}
              >
                {pack.popular && (
                  <View style={styles.packBadge}>
                    <Text style={styles.packBadgeText}>BEST VALUE</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.packName}>{pack.name}</Text>
                  <Text style={styles.packCredits}>{pack.credits.toLocaleString()} Credits</Text>
                </View>

                <TouchableOpacity
                  style={[styles.buyPackButton, isBusy && styles.buttonDisabled]}
                  onPress={() => handlePurchasePack(pack)}
                  disabled={isBusy}
                >
                  <Text style={styles.buyPackButtonText}>{pack.priceUSD}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ledger Transaction History */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {recentCreditTransactions.length > 0 ? (
            <View style={styles.transactionsList}>
              {recentCreditTransactions.map((tx: CreditTransactionItem) => {
                const info = formatTxType(tx.type);
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txInfoCol}>
                      <Text style={styles.txTypeLabel}>{info.label}</Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: info.color }]}>
                      {info.sign}
                      {tx.amount.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTxBox}>
              <Text style={styles.emptyTxText}>No credit transactions yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: darkThemeColors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: darkThemeColors.textPrimary,
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  balanceHeroCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: 18,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.accent,
    letterSpacing: 0.8,
  },
  balanceTotal: {
    fontSize: 32,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    marginVertical: spacing.xs,
  },
  balanceUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: darkThemeColors.textMuted,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    width: '100%',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.border,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownItemLabel: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  breakdownItemVal: {
    fontSize: 14,
    fontWeight: '600',
    color: darkThemeColors.textSecondary,
    marginTop: 2,
  },
  breakdownDivider: {
    width: 1,
    height: 24,
    backgroundColor: darkThemeColors.border,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginBottom: spacing.sm,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  promoInput: {
    flex: 1,
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: darkThemeColors.textPrimary,
    fontSize: 14,
  },
  redeemButton: {
    backgroundColor: darkThemeColors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  packsList: {
    gap: spacing.sm,
  },
  packCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  packCardSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  packBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: darkThemeColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
  },
  packBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  packName: {
    fontSize: 15,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
  },
  packCredits: {
    fontSize: 13,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  buyPackButton: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buyPackButtonText: {
    color: darkThemeColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  transactionsList: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.border,
  },
  txInfoCol: {
    flex: 1,
  },
  txTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
  },
  txDate: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyTxBox: {
    backgroundColor: darkThemeColors.surface,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTxText: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
  },
});
