import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import { RelationshipApi } from '../../services/api/relationshipApi.js';
import type { UserRelationshipSettingsData } from '@ai-companion/types';
import { AppAlert } from '../../components/common/AppDialog.js';

export const PersonalizationSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [settings, setSettings] = useState<UserRelationshipSettingsData>({
    userId: '',
    personalizationEnabled: true,
    relationshipProgressionEnabled: true,
    updatedAt: '',
  });
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, relsData] = await Promise.all([
        RelationshipApi.getSettings(),
        RelationshipApi.listRelationships({ limit: 20 }),
      ]);
      setSettings(settingsData);
      setRelationships(relsData.items || []);
    } catch (err: any) {
      AppAlert.alert('Error', err.message || 'Failed to load personalization settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTogglePersonalization = async (val: boolean) => {
    setSavingSettings(true);
    try {
      const updated = await RelationshipApi.updateSettings({ personalizationEnabled: val });
      setSettings(updated);
    } catch (err: any) {
      AppAlert.alert('Error', err.message || 'Failed to update personalization setting');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleProgression = async (val: boolean) => {
    setSavingSettings(true);
    try {
      const updated = await RelationshipApi.updateSettings({ relationshipProgressionEnabled: val });
      setSettings(updated);
    } catch (err: any) {
      AppAlert.alert('Error', err.message || 'Failed to update progression setting');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetRelationship = (characterId: string, characterName: string) => {
    AppAlert.alert(
      'Reset Dynamic State',
      `Are you sure you want to reset your conversational rapport with ${characterName} back to the initial baseline? Conversation history and saved facts will be retained.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Connection',
          style: 'destructive',
          onPress: async () => {
            setResettingId(characterId);
            try {
              await RelationshipApi.resetRelationship(characterId);
              await loadData();
              AppAlert.alert('Reset Complete', `Your connection with ${characterName} was reset to baseline.`);
            } catch (err: any) {
              AppAlert.alert('Error', err.message || 'Failed to reset relationship state');
            } finally {
              setResettingId(null);
            }
          },
        },
      ],
    );
  };

  const renderStageBadge = (stage: string) => {
    const formatted = stage.replace('_', ' ').toLowerCase();
    const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{capitalized}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Personalization & Continuity</Text>
          <Text style={styles.subtitle}>
            Control how companions adapt their demeanor and conversational dynamics over time.
          </Text>
        </View>
      </View>

      <FlatList
        data={relationships}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <>
            {/* SETTINGS CARD */}
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Personalized Continuity</Text>
                  <Text style={styles.settingSubtitle}>
                    Allow companions to adapt conversational tone to your unique communication style.
                  </Text>
                </View>
                <Switch
                  value={settings.personalizationEnabled}
                  onValueChange={handleTogglePersonalization}
                  disabled={savingSettings}
                  trackColor={{ false: darkThemeColors.surfaceElevated, true: darkThemeColors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.settingRow, styles.borderTop]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Relationship Dynamics Progression</Text>
                  <Text style={styles.settingSubtitle}>
                    Enable characters to develop familiarity and comfort across long-term conversations.
                  </Text>
                </View>
                <Switch
                  value={settings.relationshipProgressionEnabled}
                  onValueChange={handleToggleProgression}
                  disabled={savingSettings}
                  trackColor={{ false: darkThemeColors.surfaceElevated, true: darkThemeColors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* ACTIVE CONNECTIONS */}
            <Text style={styles.sectionHeader}>Active Companions ({relationships.length})</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No companion interactions recorded yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.companionCard}>
            <View style={styles.companionInfo}>
              <Text style={styles.companionName}>{item.character?.name || 'Companion'}</Text>
              <View style={styles.stageRow}>
                {renderStageBadge(item.stage)}
                <Text style={styles.interactionsText}>
                  {item.totalInteractions} interactions
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => handleResetRelationship(item.characterId, item.character?.name || 'Companion')}
              disabled={resettingId === item.characterId}
            >
              <Text style={styles.resetButtonText}>
                {resettingId === item.characterId ? 'Resetting...' : 'Reset Rapport'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  headerInner: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    ...typography.bodyMedium,
    color: darkThemeColors.accent,
    fontWeight: '600',
  },
  title: {
    ...typography.displaySmall,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    lineHeight: 18,
  },
  listContent: {
    padding: spacing.lg,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  settingInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  settingSubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
    lineHeight: 16,
  },
  sectionHeader: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  companionCard: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  companionInfo: {
    flex: 1,
  },
  companionName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: 4,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
  },
  interactionsText: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },
  emptyCard: {
    padding: spacing.xl,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
  },
});
