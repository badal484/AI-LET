import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling } from '../../services/storeBilling.js';
import {
  IconButton,
  Button,
  Badge,
  Banner,
  Skeleton,
  ToastService,
  Icon,
} from '../../components/common/index.js';
import { BillingPlan, BillingPrice } from '@ai-companion/types';

export const PaywallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const featureParam = route.params?.feature;

  const {
    plans,
    isLoading,
    purchaseState,
    errorMessage,
    loadPlans,
    restorePurchases,
    resetPurchaseState,
  } = useBillingStore();

  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    loadPlans();
    return () => {
      resetPurchaseState();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Filter out free plan for paywall offerings
  const paidPlans = plans.filter((p) => p.code !== 'FREE');

  useEffect(() => {
    if (paidPlans.length > 0 && !selectedPlanId) {
      const featured = paidPlans.find((p) => p.isPopular) || paidPlans[0];
      if (featured) {
        setSelectedPlanId(featured.id);
      }
    }
  }, [paidPlans, selectedPlanId]);

  const selectedPlan = paidPlans.find((p) => p.id === selectedPlanId);

  const getPriceForPlan = (plan: BillingPlan): BillingPrice | undefined => {
    if (!plan.prices || plan.prices.length === 0) return undefined;
    return (
      plan.prices.find((p) => p.billingInterval === billingInterval && p.active) ||
      plan.prices.find((p) => p.active)
    );
  };

  const formatPrice = (price?: BillingPrice): string => {
    if (!price) return 'Free';
    const amount = (price.amountMinorUnits / 100).toFixed(
      price.amountMinorUnits % 100 === 0 ? 0 : 2,
    );
    const symbol = price.currency === 'INR' ? '₹' : '$';
    return `${symbol}${amount}`;
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    // No native store SDK is integrated, so there is no real receipt to verify. Never fabricate one:
    // tell the user plainly instead of pretending to charge them.
    if (!StoreBilling.isAvailable) {
      Alert.alert('Purchases unavailable', StoreBilling.unavailableMessage);
      return;
    }
  };

  const handleRestore = async () => {
    const count = await restorePurchases();
    if (count > 0) {
      ToastService.show({
        message: `Restored ${count} active subscription`,
        type: 'success',
        duration: 2500,
      });
      navigation.goBack();
    } else if (!StoreBilling.isAvailable) {
      resetPurchaseState();
      Alert.alert('Restore unavailable', StoreBilling.unavailableMessage);
    } else {
      Alert.alert('No Subscriptions Found', 'No active subscription found to restore.');
    }
  };

  const isBusy = isLoading || purchaseState === 'verifying' || purchaseState === 'restoring';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <IconButton
          icon="close"
          size="sm"
          variant="surface"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close paywall"
        />
        <Button
          label="Restore Purchases"
          variant="ghost"
          size="sm"
          onPress={handleRestore}
          disabled={isBusy}
          accessibilityLabel="Restore existing subscription purchases"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.heroSection}>
          <Badge label="PREMIUM COMPANION ACCESS" variant="stage" size="sm" />
          <Text style={styles.heroTitle}>
            {featureParam ? `Unlock ${featureParam}` : 'Elevate Your Companion Experience'}
          </Text>
          <Text style={styles.heroSubtitle}>
            Full-duplex real-time voice calls, high-definition photo generation, infinite memory recall, and exclusive companions.
          </Text>
        </View>

        {/* Interval Selector */}
        <View style={styles.intervalToggleContainer}>
          <TouchableOpacity
            style={[
              styles.intervalButton,
              billingInterval === 'month' && styles.intervalButtonActive,
            ]}
            onPress={() => setBillingInterval('month')}
            accessibilityRole="tab"
            accessibilityLabel="Monthly billing"
          >
            <Text
              style={[
                styles.intervalButtonText,
                billingInterval === 'month' && styles.intervalButtonTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.intervalButton,
              billingInterval === 'year' && styles.intervalButtonActive,
            ]}
            onPress={() => setBillingInterval('year')}
            accessibilityRole="tab"
            accessibilityLabel="Annual billing with 17% savings"
          >
            <View style={styles.yearlyLabelRow}>
              <Text
                style={[
                  styles.intervalButtonText,
                  billingInterval === 'year' && styles.intervalButtonTextActive,
                ]}
              >
                Annual
              </Text>
              <Badge label="SAVE 17%" variant="success" size="sm" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan Cards */}
        {isLoading && paidPlans.length === 0 ? (
          <View style={styles.loaderContainer}>
            <Skeleton.Card height={120} />
            <Skeleton.Card height={120} />
          </View>
        ) : (
          <View style={styles.plansList}>
            {paidPlans.map((plan) => {
              const price = getPriceForPlan(plan);
              const isSelected = selectedPlanId === plan.id;

              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    plan.isPopular && styles.planCardFeaturedBorder,
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${plan.name}, ${formatPrice(price)} per ${billingInterval === 'year' ? 'year' : 'month'}`}
                >
                  {plan.isPopular && (
                    <View style={styles.featuredRibbon}>
                      <Text style={styles.featuredRibbonText}>MOST POPULAR</Text>
                    </View>
                  )}

                  <View style={styles.planCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planDesc}>{plan.description}</Text>
                    </View>
                    <View style={styles.priceColumn}>
                      <Text style={styles.priceAmount}>{formatPrice(price)}</Text>
                      <Text style={styles.priceInterval}>
                        {billingInterval === 'year' ? '/yr' : '/mo'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featuresList}>
                    {plan.entitlements.map((ent, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <Icon name="check" size={13} color={darkThemeColors.accent} />
                        <Text style={styles.featureText}>{ent.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Error banner if any */}
        {errorMessage && (
          <Banner
            type="error"
            message={errorMessage}
            onDismiss={() => resetPurchaseState()}
          />
        )}

        {/* Value Proposition Highlights */}
        <View style={styles.highlightsContainer}>
          <Text style={styles.highlightsTitle}>All Premium Plans Include:</Text>
          <View style={styles.highlightItem}>
            <View style={styles.highlightIconBox}>
              <Icon name="mic" size={18} color={darkThemeColors.accent} />
            </View>
            <View style={styles.highlightTextContainer}>
              <Text style={styles.highlightHeading}>Ultra Low-Latency Voice</Text>
              <Text style={styles.highlightSub}>Natural conversations with fluid speech and emotional tone.</Text>
            </View>
          </View>
          <View style={styles.highlightItem}>
            <View style={styles.highlightIconBox}>
              <Icon name="brain" size={18} color={darkThemeColors.accent} />
            </View>
            <View style={styles.highlightTextContainer}>
              <Text style={styles.highlightHeading}>Deep Episodic Memory</Text>
              <Text style={styles.highlightSub}>Companions remember your life events, goals, and shared stories.</Text>
            </View>
          </View>
          <View style={styles.highlightItem}>
            <View style={styles.highlightIconBox}>
              <Icon name="palette" size={18} color={darkThemeColors.accent} />
            </View>
            <View style={styles.highlightTextContainer}>
              <Text style={styles.highlightHeading}>Visual Moment Generation</Text>
              <Text style={styles.highlightSub}>Receive personalized photorealistic images and custom scenes.</Text>
            </View>
          </View>
        </View>

        {/* Trial & Cancellation Policy */}
        <View style={styles.termsBox}>
          <Text style={styles.termsText}>
            {selectedPlan?.trialDays
              ? `Includes a ${selectedPlan.trialDays}-day free trial. You will be billed ${formatPrice(
                  getPriceForPlan(selectedPlan),
                )} ${billingInterval === 'year' ? 'annually' : 'monthly'} after trial unless cancelled at least 24 hours before renewal.`
              : `Recurring billing. Cancel anytime from your App Store / Google Play account settings.`}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Fixed Action CTA */}
      <View style={styles.bottomBar}>
        <Button
          label={
            selectedPlan?.trialDays
              ? `Start ${selectedPlan.trialDays}-Day Free Trial`
              : 'Unlock Companion Access'
          }
          variant="gold"
          size="lg"
          fullWidth
          isLoading={isBusy}
          onPress={handleSubscribe}
          disabled={isBusy || !selectedPlan}
        />

        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={() => Alert.alert('Terms of Service', 'Standard platform terms of use apply.')}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>•</Text>
          <TouchableOpacity onPress={() => Alert.alert('Privacy Policy', 'Your private conversations and memories are encrypted.')}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 14,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  intervalToggleContainer: {
    flexDirection: 'row',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.xl,
    padding: 3,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  intervalButtonActive: {
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkThemeColors.textMuted,
  },
  intervalButtonTextActive: {
    color: darkThemeColors.textPrimary,
  },
  yearlyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loaderContainer: {
    paddingVertical: spacing.md,
  },
  plansList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: darkThemeColors.border,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: darkThemeColors.gold,
    backgroundColor: 'rgba(234, 179, 8, 0.05)',
  },
  planCardFeaturedBorder: {
    borderColor: 'rgba(234, 179, 8, 0.5)',
  },
  featuredRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: darkThemeColors.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
  },
  featuredRibbonText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingRight: 60,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  planDesc: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  priceInterval: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  featuresList: {
    marginTop: spacing.xs,
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    color: darkThemeColors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 13,
    color: darkThemeColors.textSecondary,
    textTransform: 'capitalize',
  },
  highlightsContainer: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  highlightsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: 4,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highlightIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${darkThemeColors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextContainer: {
    flex: 1,
  },
  highlightHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
  },
  highlightSub: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 1,
    lineHeight: 16,
  },
  termsBox: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  termsText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: darkThemeColors.surface,
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs + 2,
  },
  legalLink: {
    color: darkThemeColors.textMuted,
    fontSize: 11,
  },
  legalDot: {
    color: darkThemeColors.textMuted,
    fontSize: 11,
  },
});
