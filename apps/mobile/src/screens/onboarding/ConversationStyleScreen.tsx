import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { ConversationStyle } from '@ai-companion/types';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator.js';
import { Icon, IconName } from '../../components/common/index.js';

interface StyleOption {
  key: ConversationStyle;
  icon: IconName;
  title: string;
  subtitle: string;
}

const STYLES: StyleOption[] = [
  { key: 'CASUAL', icon: 'coffee', title: 'Casual & Natural', subtitle: 'Relaxed, friendly, and easygoing daily chat' },
  { key: 'PLAYFUL', icon: 'sparkles', title: 'Playful & Witty', subtitle: 'Lighthearted banter, quick humor, and fun energy' },
  { key: 'DEEP', icon: 'moon', title: 'Deep & Thoughtful', subtitle: 'Reflective, insightful, and meaningful exploration' },
  { key: 'SUPPORTIVE', icon: 'heart', title: 'Warm & Supportive', subtitle: 'Empathetic, encouraging, and emotionally safe' },
  { key: 'DIRECT', icon: 'zap', title: 'Direct & Candid', subtitle: 'Concise, intellectually sharp, and no-nonsense' },
];

export const ConversationStyleScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParamList>>();
  const { selectedStyle, setStyle, completeCurrentStep, isSubmitting } = useOnboardingStore();

  const handleContinue = async () => {
    try {
      await completeCurrentStep('STYLE');
      navigation.navigate('CharacterSelection');
    } catch {
      navigation.navigate('CharacterSelection');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 3 OF 4</Text>
        <Text style={styles.title}>How do you like conversations to feel?</Text>
        <Text style={styles.subtitle}>
          Companions will subtly tune their energy to your preferred rhythm while keeping their unique lore intact.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {STYLES.map(opt => {
          const isSelected = selectedStyle === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.styleCard, isSelected && styles.styleCardSelected]}
              activeOpacity={0.8}
              onPress={() => setStyle(opt.key)}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSelected ? `${darkThemeColors.accent}20` : darkThemeColors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={opt.icon} size={18} color={isSelected ? darkThemeColors.accent : darkThemeColors.textSecondary} />
              </View>
              <View style={styles.styleTextGroup}>
                <Text style={[styles.styleTitle, isSelected && styles.textSelected]}>
                  {opt.title}
                </Text>
                <Text style={styles.styleSubtitle}>{opt.subtitle}</Text>
              </View>

              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          activeOpacity={0.8}
          disabled={isSubmitting}
          onPress={handleContinue}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Icon name="arrow-right" size={14} color="#000000" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  stepIndicator: {
    ...typography.labelSmall,
    color: darkThemeColors.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.headlineMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: darkThemeColors.textSecondary,
    lineHeight: 20,
  },
  listContainer: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    borderRadius: 16,
    padding: spacing.lg,
  },
  styleCardSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  styleIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  styleTextGroup: {
    flex: 1,
  },
  styleTitle: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  textSelected: {
    color: darkThemeColors.accent,
  },
  styleSubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: darkThemeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  radioCircleSelected: {
    borderColor: darkThemeColors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: darkThemeColors.accent,
  },
  footer: {
    paddingTop: spacing.md,
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
});
