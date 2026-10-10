import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { onboardingApi } from '../../services/api/onboardingApi.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { UserPreferenceProfile } from '@ai-companion/types';
import { IconButton } from '../../components/common/index.js';

export const PreferencesSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const data = await onboardingApi.getPreferences();
      setProfile(data);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = async (fields: Partial<UserPreferenceProfile>) => {
    if (!profile) return;
    const optimistic = { ...profile, ...fields };
    setProfile(optimistic);
    setIsSaving(true);
    try {
      const updated = await onboardingApi.updatePreferences(fields as any);
      setProfile(updated);
    } catch {
      setProfile(profile);
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          style={{ alignSelf: 'flex-start', marginBottom: 6 }}
        />
        <Text style={styles.title}>Chat preferences</Text>
        <Text style={styles.subtitle}>Language and how characters talk to you</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 2: Preferred Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Language</Text>
          <Text style={styles.sectionDescription}>
            Language used for companion greetings and default responses.
          </Text>

          <View style={styles.languageRow}>
            {['hinglish', 'en', 'hi'].map(lang => {
              const isSelected = profile?.preferredLanguage === lang;
              const labels: Record<string, string> = {
                hinglish: 'Hinglish',
                en: 'English',
                hi: 'हिंदी',
              };
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, isSelected && styles.langChipSelected]}
                  onPress={() => updateField({ preferredLanguage: lang })}
                >
                  <Text style={[styles.langText, isSelected && styles.langTextSelected]}>
                    {labels[lang]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2b: How characters address them (Hindi verb forms) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Talk to me as</Text>
          <Text style={styles.sectionDescription}>
            So characters say "kaise ho, thak gaye?" or "thak gayi?" the right way. Only used for how they talk to you.
          </Text>

          <View style={styles.languageRow}>
            {(['male', 'female', 'unspecified'] as const).map(g => {
              const isSelected = profile?.userGender === g;
              const labels = { male: 'Man', female: 'Woman', unspecified: 'Prefer not to say' };
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.langChip, isSelected && styles.langChipSelected]}
                  onPress={() => updateField({ userGender: g })}
                >
                  <Text style={[styles.langText, isSelected && styles.langTextSelected]}>{labels[g]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={darkThemeColors.accent} />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  backButton: {
    marginBottom: spacing.xs,
  },
  backText: {
    ...typography.bodyMedium,
    color: darkThemeColors.accent,
    fontWeight: '600',
  },
  title: {
    ...typography.headlineMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  styleGrid: {
    gap: spacing.sm,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceSubtle,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  styleChipSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  chipIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  chipLabel: {
    ...typography.bodyMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: darkThemeColors.accent,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  langChip: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  langChipSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  langText: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
  },
  langTextSelected: {
    color: darkThemeColors.accent,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  switchTextGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchTitle: {
    ...typography.titleSmall,
    color: darkThemeColors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchSubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    fontSize: 12,
  },
  resetSection: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  resetButton: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  resetButtonText: {
    ...typography.labelLarge,
    color: darkThemeColors.danger,
    fontWeight: '600',
  },
  resetNote: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  savingText: {
    ...typography.bodySmall,
    color: darkThemeColors.accent,
  },
});
