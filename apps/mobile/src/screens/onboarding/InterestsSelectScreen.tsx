import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator.js';
import { Icon, IconName } from '../../components/common/index.js';

interface CategoryOption {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'roleplay', icon: 'sparkles', title: 'Roleplay & Lore', description: 'Immersive stories & worldbuilding' },
  { id: 'companion', icon: 'coffee', title: 'Chill & Banter', description: 'Daily companion & relaxed chats' },
  { id: 'deep', icon: 'moon', title: 'Deep Conversations', description: 'Late-night thoughts & philosophy' },
  { id: 'adventure', icon: 'compass', title: 'Adventure & Quests', description: 'Interactive journeys & mysteries' },
  { id: 'comedy', icon: 'zap', title: 'Humor & Playful', description: 'Witty teasing & fun banter' },
  { id: 'mentor', icon: 'brain', title: 'Mentor & Growth', description: 'Study, advice & thoughtful guidance' },
  { id: 'creative', icon: 'palette', title: 'Creative Sparks', description: 'Brainstorming, art & storytelling' },
];

export const InterestsSelectScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParamList>>();
  const { selectedCategories, toggleCategory, completeCurrentStep, isSubmitting } = useOnboardingStore();

  const handleContinue = async () => {
    try {
      await completeCurrentStep('INTERESTS');
      navigation.navigate('ConversationStyle');
    } catch {
      navigation.navigate('ConversationStyle');
    }
  };

  const handleSkip = async () => {
    try {
      await completeCurrentStep('INTERESTS', true);
      navigation.navigate('ConversationStyle');
    } catch {
      navigation.navigate('ConversationStyle');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 2 OF 4</Text>
        <Text style={styles.title}>What kind of characters interest you?</Text>
        <Text style={styles.subtitle}>
          Choose themes you'd like to explore. We’ll rank matching companions first.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map(cat => {
          const isSelected = selectedCategories.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
              activeOpacity={0.8}
              onPress={() => toggleCategory(cat.id)}
            >
              <View style={styles.cardHeader}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSelected ? `${darkThemeColors.accent}20` : darkThemeColors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={cat.icon} size={18} color={isSelected ? darkThemeColors.accent : darkThemeColors.textSecondary} />
                </View>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Icon name="check" size={10} color="#000000" />
                  </View>
                )}
              </View>
              <Text style={[styles.catTitle, isSelected && styles.catTitleSelected]}>
                {cat.title}
              </Text>
              <Text style={styles.catDescription}>{cat.description}</Text>
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

        <TouchableOpacity style={styles.skipButton} activeOpacity={0.7} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip this step</Text>
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
    marginBottom: spacing.lg,
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
  gridContainer: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  categoryCard: {
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    borderRadius: 16,
    padding: spacing.md + 2,
  },
  categoryCardSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.09)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  catIcon: {
    fontSize: 24,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: darkThemeColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  catTitle: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  catTitleSelected: {
    color: darkThemeColors.accent,
  },
  catDescription: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
  },
  footer: {
    gap: spacing.sm,
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  skipButtonText: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
  },
});
