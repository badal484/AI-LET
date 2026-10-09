import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator.js';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  subtitle: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'hinglish', name: 'Hinglish', nativeName: 'Hinglish', subtitle: 'kya scene hai? — Hindi & English, the way we text' },
  { code: 'en', name: 'English', nativeName: 'English', subtitle: 'Simple, friendly English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', subtitle: 'आसान, अपनी सी हिंदी' },
];

// So characters say "thak gaye ho?" or "thak gayi ho?" the right way — never guessed from a name.
const GENDERS = [
  { code: 'male', label: 'Man' },
  { code: 'female', label: 'Woman' },
  { code: 'unspecified', label: 'Prefer not to say' },
] as const;

export const LanguageSelectScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParamList>>();
  const { selectedLanguage, setLanguage, selectedGender, setGender, completeCurrentStep, isSubmitting } = useOnboardingStore();

  const handleContinue = async () => {
    try {
      await completeCurrentStep('LANGUAGE');
      navigation.navigate('InterestsSelect');
    } catch {
      navigation.navigate('InterestsSelect');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 1 OF 4</Text>
        <Text style={styles.title}>How should we talk?</Text>
        <Text style={styles.subtitle}>
          Pick the language your characters text you in. You can change this anytime in settings.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map(lang => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageCard, isSelected && styles.languageCardSelected]}
              activeOpacity={0.8}
              onPress={() => setLanguage(lang.code)}
            >
              <View style={styles.languageTextGroup}>
                <View style={styles.languageNameRow}>
                  <Text style={[styles.languageName, isSelected && styles.textSelected]}>
                    {lang.name}
                  </Text>
                  <Text style={styles.nativeName}>• {lang.nativeName}</Text>
                </View>
                <Text style={styles.languageSubtitle}>{lang.subtitle}</Text>
              </View>

              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.sectionLabel}>Talk to me as (optional)</Text>
        <View style={styles.genderRow}>
          {GENDERS.map(g => {
            const isSelected = selectedGender === g.code;
            return (
              <TouchableOpacity
                key={g.code}
                style={[styles.genderChip, isSelected && styles.languageCardSelected]}
                activeOpacity={0.8}
                onPress={() => setGender(g.code)}
              >
                <Text style={[styles.genderText, isSelected && styles.textSelected]}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          activeOpacity={0.8}
          disabled={isSubmitting}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Continue →</Text>
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
  sectionLabel: {
    ...typography.labelSmall,
    color: darkThemeColors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genderChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    backgroundColor: darkThemeColors.surface,
  },
  genderText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textPrimary,
  },
  listContainer: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    borderRadius: 16,
    padding: spacing.lg,
  },
  languageCardSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  languageTextGroup: {
    flex: 1,
  },
  languageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  languageName: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
  },
  nativeName: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
    marginLeft: 6,
  },
  textSelected: {
    color: darkThemeColors.accent,
  },
  languageSubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: darkThemeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
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
