import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { StoreBilling } from '../../services/storeBilling.js';
import { UsageMeterItem } from '@ai-companion/types';
import { Icon, IconButton, IconName } from '../../components/common/index.js';

export const SubscriptionManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    subscription,
    plans,
    usageMeters,
    creditWallet,
    isLoading,
    loadBillingState,
    cancelSubscription,
    resumeSubscription,
    restorePurchases,
  } = useBillingStore();

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadBillingState();
  }, []);

  const activePlan = plans.find(p => p.id === subscription?.planId) || plans.find(p => p.code === 'FREE');

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? You will keep your benefits until the end of the current billing cycle.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            const success = await cancelSubscription(false, 'User requested from mobile app');
            setIsProcessing(false);
            if (success) {
              Alert.alert('Subscription Cancelled', 'Your subscription will not renew after this period.');
            }
          },
        },
      ],
    );
  };

  const handleResume = async () => {
    setIsProcessing(true);
    const success = await resumeSubscription();
    setIsProcessing(false);
    if (success) {
      Alert.alert('Subscription Resumed', 'Your subscription has been renewed and will continue normally.');
    }
  };

  const formatPeriodDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMeter = (meter: UsageMeterItem) => {
    const percentage =
      meter.limitAmount > 0
        ? Math.min(100, Math.round((meter.consumedAmount / meter.limitAmount) * 100))
        : 0;
    const isHigh = percentage >= 80;
    const isMaxed = percentage >= 100;

    let title = meter.meterUnit;
    let iconName: IconName = 'sparkles';
    let consumedFormatted = meter.consumedAmount.toLocaleString();
    let limitFormatted = meter.limitAmount.toLocaleString();

    if (meter.meterUnit === 'voice_seconds') {
      title = 'Voice Conversation';
      iconName = 'mic';
      consumedFormatted = `${Math.round(meter.consumedAmount / 60)} min`;
      limitFormatted = `${Math.round(meter.limitAmount / 60)} min`;
    } else if (meter.meterUnit === 'image_generations') {
      title = 'Photo Generations';
      iconName = 'palette';
      consumedFormatted = `${meter.consumedAmount}`;
      limitFormatted = `${meter.limitAmount} photos`;
    } else if (meter.meterUnit === 'ai_text_tokens') {
      title = 'Chat Message Budget';
      iconName = 'chat';
      consumedFormatted = `${Math.round(meter.consumedAmount / 1000)}k`;
      limitFormatted = `${Math.round(meter.limitAmount / 1000)}k tokens`;
    }

    return (
      <View key={meter.id} style={styles.meterCard}>
        <View style={styles.meterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={iconName} size={16} color={darkThemeColors.accent} />
            <Text style={styles.meterTitle}>{title}</Text>
          </View>
          <Text style={[styles.meterValue, isMaxed && styles.meterValueMaxed]}>
            {consumedFormatted} / {limitFormatted}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${percentage}%` },
              isHigh && { backgroundColor: darkThemeColors.warning },
              isMaxed && { backgroundColor: darkThemeColors.danger },
            ]}
          />
        </View>

        <View style={styles.meterFooter}>
          <Text style={styles.meterRemainingText}>
            {meter.remainingAmount > 0
              ? `${meter.meterUnit === 'voice_seconds' ? Math.round(meter.remainingAmount / 60) + ' min' : meter.remainingAmount} remaining`
              : 'Limit reached'}
          </Text>
          <Text style={styles.meterPercentageText}>{percentage}%</Text>
        </View>
      </View>
    );
  };

  const isFreeOrExpired = !subscription || subscription.status === 'expired' || activePlan?.code === 'FREE';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Subscription & Usage</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Plan Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardHeader}>
            <View>
              <Text style={styles.planBadge}>{activePlan?.code || 'FREE'} PLAN</Text>
              <Text style={styles.planTitle}>{activePlan?.name || 'Free Starter'}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                subscription?.status === 'active' && styles.statusBadgeActive,
                subscription?.status === 'trialing' && styles.statusBadgeTrial,
                subscription?.status === 'past_due' && styles.statusBadgePastDue,
                subscription?.status === 'cancelled' && styles.statusBadgeCancelled,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {subscription?.status ? subscription.status.toUpperCase() : 'FREE'}
              </Text>
            </View>
          </View>

          <Text style={styles.planDescription}>{activePlan?.description}</Text>

          <View style={styles.divider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                {subscription?.cancelAtPeriodEnd ? 'Expires On' : 'Next Renewal'}
              </Text>
              <Text style={styles.detailValue}>
                {formatPeriodDate(subscription?.currentPeriodEnd)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Billing Provider</Text>
              <Text style={styles.detailValue}>
                {subscription?.provider ? subscription.provider.toUpperCase() : 'Free'}
              </Text>
            </View>
          </View>

          {/* Cancellation Notice Banner */}
          {subscription?.cancelAtPeriodEnd && (
            <View style={styles.cancelledBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon name="warning" size={16} color={darkThemeColors.warning} />
                <Text style={styles.cancelledBannerText}>
                  Your subscription is scheduled to cancel on {formatPeriodDate(subscription.currentPeriodEnd)}.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={handleResume}
                disabled={isProcessing}
              >
                <Text style={styles.resumeButtonText}>Resume Subscription</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions */}
          {isFreeOrExpired ? (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          ) : (
            !subscription?.cancelAtPeriodEnd && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.changePlanButton}
                  onPress={() => navigation.navigate('Paywall')}
                >
                  <Text style={styles.changePlanButtonText}>Change Tier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelLinkButton}
                  onPress={handleCancel}
                  disabled={isProcessing}
                >
                  <Text style={styles.cancelLinkButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Usage Quotas Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Usage & Quotas</Text>
          <Text style={styles.sectionSub}>Resets at each billing cycle start.</Text>
        </View>

        {isLoading && usageMeters.length === 0 ? (
          <ActivityIndicator color={darkThemeColors.accent} style={{ marginVertical: spacing.md }} />
        ) : usageMeters.length > 0 ? (
          <View style={styles.metersList}>
            {usageMeters.map(meter => renderMeter(meter))}
          </View>
        ) : (
          <View style={styles.emptyMetersBox}>
            <Text style={styles.emptyMetersText}>No usage recorded in the current period.</Text>
          </View>
        )}

        {/* AI Credits Wallet Card */}
        <View style={styles.creditsCard}>
          <View style={styles.creditsCardHeader}>
            <View>
              <Text style={styles.creditsLabel}>AI Credits Wallet</Text>
              <Text style={styles.creditsBalance}>
                {creditWallet?.availableBalance.toLocaleString() || 0} Credits
              </Text>
            </View>
            <TouchableOpacity
              style={styles.creditsManageButton}
              onPress={() => navigation.navigate('CreditWallet')}
            >
              <Text style={styles.creditsManageButtonText}>Manage & Buy →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.creditsSub}>
            Pay-as-you-go credits used when monthly plan limits are exceeded.
          </Text>
        </View>

        {/* Restore Purchases & Help */}
        <View style={styles.bottomLinks}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={async () => {
              await restorePurchases();
              if (!StoreBilling.isAvailable) Alert.alert('Restore unavailable', StoreBilling.unavailableMessage);
            }}
          >
            <Text style={styles.linkButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
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
  statusCard: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.accent,
    letterSpacing: 0.8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: darkThemeColors.surfaceElevated,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusBadgeTrial: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  statusBadgePastDue: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusBadgeCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  planDescription: {
    fontSize: 13,
    color: darkThemeColors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: darkThemeColors.border,
    marginVertical: spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginTop: 2,
  },
  cancelledBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  cancelledBannerText: {
    color: darkThemeColors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  resumeButton: {
    backgroundColor: darkThemeColors.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  resumeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: darkThemeColors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changePlanButton: {
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePlanButtonText: {
    color: darkThemeColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  cancelLinkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelLinkButtonText: {
    color: darkThemeColors.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 1,
  },
  metersList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  meterCard: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    padding: spacing.md,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  meterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
  },
  meterValue: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textSecondary,
  },
  meterValueMaxed: {
    color: darkThemeColors.danger,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: darkThemeColors.accent,
    borderRadius: 4,
  },
  meterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterRemainingText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  meterPercentageText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkThemeColors.textMuted,
  },
  emptyMetersBox: {
    backgroundColor: darkThemeColors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  emptyMetersText: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
  },
  creditsCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  creditsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditsLabel: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
  },
  creditsBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginTop: 2,
  },
  creditsManageButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
  },
  creditsManageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: darkThemeColors.accent,
  },
  creditsSub: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  bottomLinks: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkButton: {
    padding: spacing.xs,
  },
  linkButtonText: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
