import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator.js';
import { Icon } from '../../components/common/index.js';

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParamList>>();
  const { completeCurrentStep, skipAll, isSubmitting } = useOnboardingStore();

  const handleGetStarted = async () => {
    try {
      await completeCurrentStep('WELCOME');
      navigation.navigate('LanguageSelect');
    } catch {
      navigation.navigate('LanguageSelect');
    }
  };

  const handleSkip = async () => {
    try {
      await skipAll();
    } catch {
      // Handled in store
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Icon name="sparkles" size={12} color={darkThemeColors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.badgeText}>NEXT-GEN AI COMPANIONS</Text>
        </View>

        <Text style={styles.title}>Companions that remember, evolve, and connect.</Text>
        <Text style={styles.subtitle}>
          Discover unique personalities with persistent memory, authentic dialogue, and deep emotional context.
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Icon name="brain" size={20} color={darkThemeColors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Persistent Long-Term Memory</Text>
              <Text style={styles.featureSubtitle}>
                Remembers your stories, goals, and milestones over time.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Icon name="sparkles" size={20} color={darkThemeColors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Authentic Personalities</Text>
              <Text style={styles.featureSubtitle}>
                Each companion has distinct humor, quirks, knowledge, and tone.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Icon name="mic" size={20} color={darkThemeColors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Real-Time Voice &amp; Chat</Text>
              <Text style={styles.featureSubtitle}>
                Instant streaming text and ultra-low latency interactive voice.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          activeOpacity={0.8}
          disabled={isSubmitting}
          onPress={handleGetStarted}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <Icon name="arrow-right" size={14} color="#000000" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} activeOpacity={0.7} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip to Explore</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.lg,
  },
  badgeText: {
    ...typography.labelSmall,
    color: darkThemeColors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    ...typography.displaySmall,
    color: darkThemeColors.textPrimary,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: darkThemeColors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  featuresList: {
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    ...typography.titleSmall,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureSubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: darkThemeColors.accent,
    borderRadius: 14,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
  },
});
