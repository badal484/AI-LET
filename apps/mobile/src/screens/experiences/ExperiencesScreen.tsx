import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterExperienceItem, UserGoalItem } from '@ai-companion/types';
import { Badge, Button, Icon, IconName } from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { api } from '../../services/api/client.js';

const CATEGORY_ICONS: Record<string, IconName> = {
  education: 'book',
  career: 'sparkles',
  lifestyle: 'compass',
  technical: 'zap',
  engineering: 'zap',
};

export const ExperiencesScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Experiences'>>();
  const contextCharacterId = route.params?.characterId;

  const [experiences, setExperiences] = useState<CharacterExperienceItem[]>([]);
  const [activeGoal, setActiveGoal] = useState<UserGoalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingSlug, setStartingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, goalRes] = await Promise.all([
        api.get('/agents/experiences'),
        api.get('/agents/goals/active', { params: contextCharacterId ? { characterId: contextCharacterId } : undefined }),
      ]);
      setExperiences(expRes.data.data ?? []);
      setActiveGoal(goalRes.data.data ?? null);
    } catch (err: any) {
      setError(err?.message || 'Could not load experiences.');
    } finally {
      setLoading(false);
    }
  }, [contextCharacterId]);

  useEffect(() => {
    load();
  }, [load]);

  const launch = async (exp: CharacterExperienceItem) => {
    const characterId = exp.characterId || contextCharacterId;
    if (!characterId) {
      Alert.alert('Choose a companion', 'Open Guided Experiences from a companion\'s profile to start a session with them.');
      return;
    }
    setStartingSlug(exp.slug);
    try {
      const res = await api.post(`/agents/experiences/${exp.slug}/start`, { characterId });
      const result = res.data.data as { initialPrompt: string };
      navigation.navigate('Chat', { characterId, initialPrompt: result.initialPrompt });
    } catch (err: any) {
      Alert.alert('Could not start experience', err?.message || 'Please try again.');
    } finally {
      setStartingSlug(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Guided Experiences</Text>
        <Text style={styles.subtitle}>
          Structured, goal-oriented sessions with your companion
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeGoal && (
          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>CURRENT ACTIVE GOAL</Text>
              <Badge label={activeGoal.status} variant="success" size="sm" />
            </View>
            <Text style={styles.goalTitle}>{activeGoal.title}</Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.round(Math.min(1, Math.max(0, activeGoal.progress)) * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(Math.min(1, Math.max(0, activeGoal.progress)) * 100)}% completed • Maintained across messages
            </Text>
          </View>
        )}

        <Text style={styles.sectionHeader}>Available Experiences</Text>

        {loading && <ActivityIndicator color={darkThemeColors.accent} style={{ marginVertical: spacing.lg }} />}
        {!loading && error && (
          <View style={styles.card}>
            <Text style={styles.cardDesc}>{error}</Text>
            <Button label="Try again" variant="outline" size="sm" onPress={load} />
          </View>
        )}
        {!loading && !error && experiences.length === 0 && (
          <Text style={styles.cardDesc}>No guided experiences are available right now.</Text>
        )}

        {experiences.map((exp) => (
          <TouchableOpacity
            key={exp.slug}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => launch(exp)}
            disabled={startingSlug !== null}
            accessibilityRole="button"
            accessibilityLabel={`Start ${exp.name}`}
          >
            <View style={styles.cardTop}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${darkThemeColors.accent}15`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Icon name={CATEGORY_ICONS[exp.category.toLowerCase()] ?? 'sparkles'} size={18} color={darkThemeColors.accent} />
              </View>
              <View style={styles.cardMeta}>
                <View style={styles.badgeRow}>
                  <Badge label={exp.category} variant="category" size="sm" />
                </View>
                <Text style={styles.cardTitle}>{exp.name}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{exp.description}</Text>
            <Button
              label={startingSlug === exp.slug ? 'Starting…' : 'Launch Experience'}
              variant="outline"
              size="sm"
              onPress={() => launch(exp)}
              disabled={startingSlug !== null}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: darkThemeColors.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  goalCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.sm,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: darkThemeColors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
  },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardMeta: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  turnsText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
  },
  cardDesc: {
    fontSize: 13,
    color: darkThemeColors.textSecondary,
    lineHeight: 18,
  },
});
