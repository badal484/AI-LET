import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { ToastService } from '../../components/common/Toast.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';

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

/**
 * The one onboarding step (owner's decision, 18 Oct 2026), all answers required: their age (12+; romance characters
 * are 18+ and shown blurred to younger people), the language characters text in
 * (their first messages; then they follow how the person writes — any language later added here works the same
 * way) and how they address the person (Hinglish grammar: "thak gaye ho?" / "thak gayi ho?"). Then Home.
 */
export const LanguageSelectScreen: React.FC = () => {
  const { selectedLanguage, setLanguage, selectedGender, setGender, selectedAge, setAge, completeCurrentStep, isSubmitting } = useOnboardingStore();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const MIN_AGE = 12;
  const tooYoung = selectedAge !== null && selectedAge < MIN_AGE;
  const ready = Boolean(selectedLanguage) && Boolean(selectedGender) && selectedAge !== null && !tooYoung;
  const insets = useSafeAreaInsets();

  const handleContinue = async () => {
    if (!ready) return;
    try {
      await completeCurrentStep('LANGUAGE');
      await bootstrap(); // the profile is now onboarded → the app opens Home
    } catch (err) {
      ToastService.show({ message: (err as Error)?.message || "Couldn't save that — please try again.", type: 'error', duration: 3500 });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Before we start</Text>
        <Text style={styles.subtitle}>Three quick answers so your characters talk to you the right way.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Characters text you in</Text>
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

        <Text style={styles.sectionLabel}>Characters talk to you as</Text>
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

        <Text style={styles.sectionLabel}>Your age</Text>
        <TextInput
          style={[styles.ageInput, tooYoung && styles.ageInputError]}
          value={selectedAge === null ? '' : String(selectedAge)}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '').slice(0, 3);
            setAge(digits ? Number(digits) : null);
          }}
          placeholder="e.g. 21"
          placeholderTextColor={darkThemeColors.textMuted}
          keyboardType="number-pad"
          maxLength={3}
          accessibilityLabel="Your age"
        />
        {tooYoung && <Text style={styles.ageError}>Loveek is for ages {MIN_AGE} and up.</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, (!ready || isSubmitting) && styles.buttonDisabled]}
          activeOpacity={0.8}
          disabled={!ready || isSubmitting}
          onPress={handleContinue}
          accessibilityState={{ disabled: !ready || isSubmitting }}
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Saving…' : 'Start chatting'}</Text>
        </TouchableOpacity>
        {!ready && !tooYoung && <Text style={styles.hint}>Answer all three to continue</Text>}
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
    opacity: 0.45,
  },
  ageInput: {
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: darkThemeColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    width: 140,
  },
  ageInputError: { borderColor: '#F87171' },
  ageError: { ...typography.bodySmall, color: '#F87171', marginTop: spacing.xs },
  hint: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
