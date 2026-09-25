import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import { NotificationApi } from '../../services/api/notificationApi.js';
import type { UserNotificationPreferenceData } from '@ai-companion/types';
import { Icon, IconButton } from '../../components/common/index.js';

const QUIET_HOURS_PRESETS = [
  { label: '10:30 PM – 8:00 AM (Default)', start: '22:30', end: '08:00' },
  { label: '11:00 PM – 7:00 AM', start: '23:00', end: '07:00' },
  { label: '10:00 PM – 9:00 AM (Extended)', start: '22:00', end: '09:00' },
  { label: 'Midnight – 8:00 AM', start: '00:00', end: '08:00' },
];

const DAILY_LIMIT_OPTIONS = [1, 2, 3, 5];

export const NotificationPreferencesScreen: React.FC = () => {
  const navigation = useNavigation();

  const [preferences, setPreferences] = useState<UserNotificationPreferenceData>({
    userId: '',
    pushEnabled: true,
    proactivityEnabled: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:30',
    quietHoursEnd: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    maxDailyNotifications: 2,
    maxWeeklyNotifications: 10,
    showPreview: true,
    characterMessageCategoryEnabled: true,
    userReminderCategoryEnabled: true,
    marketingCategoryEnabled: false,
    updatedAt: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await NotificationApi.getPreferences();
      setPreferences(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleUpdate = async (patch: Partial<UserNotificationPreferenceData>) => {
    setSaving(true);
    // Optimistic local update
    const previous = { ...preferences };
    setPreferences((prev) => ({ ...prev, ...patch }));

    try {
      const updated = await NotificationApi.updatePreferences(patch);
      setPreferences(updated);
    } catch (err: any) {
      setPreferences(previous);
      Alert.alert('Error', err.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
        <Text style={styles.loadingText}>Loading notification preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          style={{ alignSelf: 'flex-start', marginBottom: 6 }}
        />
        <Text style={styles.title}>Notification Settings</Text>
        <Text style={styles.subtitle}>
          Control when and how AI companions can reach out to you.
        </Text>
      </View>

      {/* Ethical AI Notice Banner */}
      <View style={styles.banner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Icon name="shield" size={16} color={darkThemeColors.accent} />
          <Text style={styles.bannerTitle}>Intelligent &amp; Ethical Outreach</Text>
        </View>
        <Text style={styles.bannerBody}>
          Companions will only reach out when genuinely relevant, never using guilt or fake urgency.
          Quiet hours and limits are strictly enforced.
        </Text>
      </View>

      {/* Master Toggles Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>General Controls</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingSubtitle}>
              Allow this app to deliver notifications to your device
            </Text>
          </View>
          <Switch
            value={preferences.pushEnabled}
            onValueChange={(val) => handleUpdate({ pushEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>AI Proactive Messages</Text>
            <Text style={styles.settingSubtitle}>
              Allow companions to initiate thoughtful check-ins and follow-ups
            </Text>
          </View>
          <Switch
            value={preferences.proactivityEnabled}
            onValueChange={(val) => handleUpdate({ proactivityEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving || !preferences.pushEnabled}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Message Previews</Text>
            <Text style={styles.settingSubtitle}>
              Show message snippet on lock screen. Disable to protect privacy.
            </Text>
          </View>
          <Switch
            value={preferences.showPreview}
            onValueChange={(val) => handleUpdate({ showPreview: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving || !preferences.pushEnabled}
          />
        </View>
      </View>

      {/* Quiet Hours Card */}
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.cardSectionHeader}>Quiet Hours</Text>
            <Text style={styles.settingSubtitle}>
              Silence all non-urgent AI outreach while you sleep
            </Text>
          </View>
          <Switch
            value={preferences.quietHoursEnabled}
            onValueChange={(val) => handleUpdate({ quietHoursEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        {preferences.quietHoursEnabled && (
          <View style={styles.borderTop}>
            <Text style={styles.subHeaderLabel}>Current Window:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
              <Icon name="moon" size={14} color={darkThemeColors.accent} />
              <Text style={styles.timeDisplay}>
                {preferences.quietHoursStart} – {preferences.quietHoursEnd} ({preferences.timezone})
              </Text>
            </View>

            <Text style={[styles.subHeaderLabel, { marginTop: spacing.md }]}>Quick Presets:</Text>
            <View style={styles.presetsGrid}>
              {QUIET_HOURS_PRESETS.map((preset) => {
                const isSelected =
                  preferences.quietHoursStart === preset.start &&
                  preferences.quietHoursEnd === preset.end;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.presetButton, isSelected && styles.presetButtonActive]}
                    onPress={() =>
                      handleUpdate({
                        quietHoursStart: preset.start,
                        quietHoursEnd: preset.end,
                      })
                    }
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        isSelected && styles.presetButtonTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Outreach Frequency Limits */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>Outreach Frequency</Text>
        <Text style={styles.settingSubtitle}>
          Cap how many proactive messages you can receive per day
        </Text>

        <View style={styles.optionsRow}>
          {DAILY_LIMIT_OPTIONS.map((limit) => {
            const isSelected = preferences.maxDailyNotifications === limit;
            return (
              <TouchableOpacity
                key={limit}
                style={[styles.limitChip, isSelected && styles.limitChipActive]}
                onPress={() => handleUpdate({ maxDailyNotifications: limit })}
                disabled={saving}
              >
                <Text
                  style={[styles.limitChipText, isSelected && styles.limitChipTextActive]}
                >
                  {limit} / day
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Granular Categories */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>Notification Categories</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Companion Initiated Chats</Text>
            <Text style={styles.settingSubtitle}>
              Follow-ups on topics you discussed earlier and thoughtful check-ins
            </Text>
          </View>
          <Switch
            value={preferences.characterMessageCategoryEnabled}
            onValueChange={(val) =>
              handleUpdate({ characterMessageCategoryEnabled: val })
            }
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Scheduled Reminders</Text>
            <Text style={styles.settingSubtitle}>
              Reminders you explicitly ask your companion to set
            </Text>
          </View>
          <Switch
            value={preferences.userReminderCategoryEnabled}
            onValueChange={(val) =>
              handleUpdate({ userReminderCategoryEnabled: val })
            }
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Curated Recommendations</Text>
            <Text style={styles.settingSubtitle}>
              New companion discoveries matched to your mood and topics
            </Text>
          </View>
          <Switch
            value={preferences.recommendationsCategoryEnabled ?? true}
            onValueChange={(val) => handleUpdate({ recommendationsCategoryEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Subscription & Usage Alerts</Text>
            <Text style={styles.settingSubtitle}>
              Renewal reminders, credit balance updates, and invoice receipts
            </Text>
          </View>
          <Switch
            value={preferences.billingCategoryEnabled ?? true}
            onValueChange={(val) => handleUpdate({ billingCategoryEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Product & Platform Updates</Text>
            <Text style={styles.settingSubtitle}>
              New features, new companion voices, and community announcements
            </Text>
          </View>
          <Switch
            value={preferences.marketingCategoryEnabled}
            onValueChange={(val) => handleUpdate({ marketingCategoryEnabled: val })}
            trackColor={{ false: darkThemeColors.borderSubtle, true: darkThemeColors.accent }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>
      </View>

      {/* Lock Screen Privacy Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>Lock-Screen Privacy</Text>
        <Text style={styles.settingSubtitle}>
          Choose how much notification content appears on your device lock screen
        </Text>

        <View style={{ gap: 8, marginTop: 12 }}>
          {[
            { key: 'FULL_PREVIEW' as const, label: 'Full Preview', desc: 'Show character name and message snippet' },
            { key: 'LIMITED_PREVIEW' as const, label: 'Limited Preview', desc: 'Show character name only' },
            { key: 'HIDE_CONTENT' as const, label: 'Hide Content', desc: 'Show generic "New message waiting"' },
          ].map(opt => {
            const isSelected = (preferences.lockScreenPrivacy || 'FULL_PREVIEW') === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.privacyOption, isSelected && styles.privacyOptionActive]}
                onPress={() => handleUpdate({ lockScreenPrivacy: opt.key })}
                disabled={saving}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyOptionTitle, isSelected && styles.privacyOptionTitleActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.privacyOptionDesc}>{opt.desc}</Text>
                </View>
                {isSelected && <Icon name="check" size={14} color={darkThemeColors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkThemeColors.background,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
    marginTop: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.sm,
    paddingVertical: 4,
  },
  backButtonText: {
    ...typography.bodyMedium,
    color: darkThemeColors.accent,
    fontWeight: '600',
  },
  title: {
    ...typography.headlineLarge,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: darkThemeColors.textSecondary,
  },
  banner: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: spacing.lg,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
    marginBottom: 4,
  },
  bannerBody: {
    fontSize: 12,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
  },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.lg,
  },
  cardSectionHeader: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    marginBottom: 6,
  },
  subHeaderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeDisplay: {
    fontSize: 15,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginTop: 4,
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
  presetsGrid: {
    gap: 8,
    marginTop: spacing.sm,
  },
  presetButton: {
    backgroundColor: darkThemeColors.background,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  presetButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: darkThemeColors.accent,
  },
  presetButtonText: {
    fontSize: 13,
    color: darkThemeColors.textSecondary,
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  limitChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: darkThemeColors.background,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  limitChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: darkThemeColors.accent,
  },
  limitChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textSecondary,
  },
  limitChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: darkThemeColors.background,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  privacyOptionActive: {
    borderColor: darkThemeColors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  privacyOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  privacyOptionTitleActive: {
    color: '#818cf8',
  },
  privacyOptionDesc: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
  },
});
