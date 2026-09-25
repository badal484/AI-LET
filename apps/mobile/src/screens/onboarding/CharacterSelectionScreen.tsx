import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import { Icon } from '../../components/common/index.js';

export const CharacterSelectionScreen: React.FC = () => {
  const {
    starterCharacters,
    selectedCharacterId,
    selectCharacter,
    finishOnboarding,
    isLoading,
    isSubmitting,
    init,
  } = useOnboardingStore();

  const { bootstrap } = useAuthStore();

  useEffect(() => {
    if (starterCharacters.length === 0) {
      init();
    } else if (!selectedCharacterId && starterCharacters.length > 0) {
      selectCharacter(starterCharacters[0].id);
    }
  }, [starterCharacters, selectedCharacterId, init, selectCharacter]);

  const handleStartChat = async (charId?: string) => {
    const targetId = charId || selectedCharacterId || starterCharacters[0]?.id;
    if (targetId) {
      selectCharacter(targetId);
    }

    try {
      await finishOnboarding();
      // Refresh user bootstrap state so App.tsx transitions to RootNavigator
      await bootstrap();
    } catch {
      await bootstrap();
    }
  };

  if (isLoading && starterCharacters.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
        <Text style={styles.loadingText}>Curating your companions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 4 OF 4 • CHOOSE YOUR COMPANION</Text>
        <Text style={styles.title}>Who would you like to talk to?</Text>
        <Text style={styles.subtitle}>
          Select your starter companion. You can explore and add many more characters anytime.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.cardList} showsVerticalScrollIndicator={false}>
        {starterCharacters.map(char => {
          const isSelected = selectedCharacterId === char.id;
          return (
            <TouchableOpacity
              key={char.id}
              style={[styles.characterCard, isSelected && styles.characterCardSelected]}
              activeOpacity={0.85}
              onPress={() => selectCharacter(char.id)}
            >
              <View style={styles.cardTop}>
                {char.avatarUrl ? (
                  <Image source={{ uri: char.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>{char.name.charAt(0)}</Text>
                  </View>
                )}

                <View style={styles.characterInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.characterName}>{char.name}</Text>
                    <View style={styles.styleBadge}>
                      <Text style={styles.styleBadgeText}>{char.conversationStyleTag}</Text>
                    </View>
                  </View>
                  <Text style={styles.tagline}>{char.tagline || char.shortDescription}</Text>
                </View>
              </View>

              {char.starterPromptPill && (
                <View style={styles.promptPill}>
                  <Icon name="chat" size={12} color={darkThemeColors.accent} />
                  <Text style={styles.promptText}>"{char.starterPromptPill}"</Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.categoryLabel}>{char.categoryDisplayName}</Text>
                <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {isSelected && <Icon name="check" size={10} color="#000000" />}
                    <Text
                      style={[
                        styles.selectIndicatorText,
                        isSelected && styles.selectIndicatorTextActive,
                      ]}
                    >
                      {isSelected ? 'Selected' : 'Tap to Select'}
                    </Text>
                  </View>
                </View>
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
          onPress={() => handleStartChat()}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Start First Conversation →</Text>
          )}
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
  centerContainer: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textSecondary,
    marginTop: spacing.md,
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
  cardList: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  characterCard: {
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    borderRadius: 20,
    padding: spacing.lg,
  },
  characterCardSelected: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: spacing.md,
    backgroundColor: darkThemeColors.surfaceSubtle,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: darkThemeColors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarPlaceholderText: {
    ...typography.titleLarge,
    color: darkThemeColors.accent,
    fontWeight: '700',
  },
  characterInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  characterName: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
  },
  styleBadge: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  styleBadgeText: {
    ...typography.labelSmall,
    color: darkThemeColors.textSecondary,
    fontSize: 11,
  },
  tagline: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    lineHeight: 18,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  promptIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  promptText: {
    ...typography.bodySmall,
    color: darkThemeColors.accent,
    fontStyle: 'italic',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
    paddingTop: spacing.sm,
  },
  categoryLabel: {
    ...typography.labelSmall,
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: darkThemeColors.surfaceSubtle,
  },
  selectIndicatorActive: {
    backgroundColor: darkThemeColors.accent,
  },
  selectIndicatorText: {
    ...typography.labelSmall,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
  },
  selectIndicatorTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
