import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import { privacyApi, type PrivacySettings, type BlockedItem } from '../../services/api/privacyApi.js';
import { Icon, IconButton, IconName } from '../../components/common/index.js';

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  description?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
  </View>
);

// ─── Toggle Row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  dangerMode?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  value,
  onToggle,
  disabled = false,
  dangerMode = false,
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleRowText}>
      <Text style={[styles.toggleLabel, dangerMode && styles.dangerText]}>{label}</Text>
      {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: darkThemeColors.border, true: dangerMode ? darkThemeColors.danger : darkThemeColors.accent }}
      thumbColor={darkThemeColors.textPrimary}
      ios_backgroundColor={darkThemeColors.border}
    />
  </View>
);

// ─── Action Row ───────────────────────────────────────────────────────────────

interface ActionRowProps {
  label: string;
  description?: string;
  onPress: () => void;
  loading?: boolean;
  dangerMode?: boolean;
  icon?: IconName;
}

const ActionRow: React.FC<ActionRowProps> = ({
  label,
  description,
  onPress,
  loading = false,
  dangerMode = false,
  icon = 'arrow-right',
}) => (
  <TouchableOpacity
    style={styles.actionRow}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.actionRowText}>
      <Text style={[styles.actionLabel, dangerMode && styles.dangerText]}>{label}</Text>
      {description ? <Text style={styles.actionDescription}>{description}</Text> : null}
    </View>
    {loading ? (
      <ActivityIndicator size="small" color={darkThemeColors.textMuted} />
    ) : (
      <Icon
        name={icon}
        size={16}
        color={dangerMode ? darkThemeColors.danger : darkThemeColors.textMuted}
      />
    )}
  </TouchableOpacity>
);

// ─── Blocked Item Row ─────────────────────────────────────────────────────────

interface BlockedRowProps {
  item: BlockedItem;
  onUnblock: (id: string) => void;
}

const BlockedRow: React.FC<BlockedRowProps> = ({ item, onUnblock }) => {
  const typeLabel = item.blockType === 'USER' ? 'User' : item.blockType === 'CHARACTER' ? 'Character' : 'Creator';
  const typeIcon: IconName = item.blockType === 'USER' ? 'user' : item.blockType === 'CHARACTER' ? 'sparkles' : 'user';

  return (
    <View style={styles.blockedRow}>
      <View style={styles.blockedInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Icon name={typeIcon} size={14} color={darkThemeColors.textMuted} />
          <Text style={styles.blockedType}>{typeLabel}</Text>
        </View>
        <Text style={styles.blockedName}>{item.targetDisplayName || item.targetId}</Text>
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => onUnblock(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${item.targetDisplayName || item.targetId}`}
      >
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ActiveTab = 'privacy' | 'blocks';

export const SafetyPrivacyScreen: React.FC = () => {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<ActiveTab>('privacy');
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [blocks, setBlocks] = useState<BlockedItem[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);

  // ── Load privacy settings ──────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const data = await privacyApi.getSettings();
      setSettings(data);
    } catch {
      Alert.alert('Error', 'Could not load your privacy settings. Please try again.');
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  // ── Load block list ────────────────────────────────────────────────────────

  const loadBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const data = await privacyApi.getBlocks();
      setBlocks(data);
    } catch {
      // Non-fatal; show empty
    } finally {
      setLoadingBlocks(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === 'blocks') {
      loadBlocks();
    }
  }, [activeTab, loadBlocks]);

  // ── Toggle helper ──────────────────────────────────────────────────────────

  const handleToggle = async (key: keyof PrivacySettings, value: boolean) => {
    if (!settings) return;
    const prev = { ...settings };
    setSettings({ ...settings, [key]: value });
    setSavingKey(key);
    try {
      const updated = await privacyApi.updateSettings({ [key]: value });
      setSettings(updated);
    } catch {
      setSettings(prev);
      Alert.alert('Error', 'Could not save this setting. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  // ── Data export ────────────────────────────────────────────────────────────

  const handleRequestExport = async () => {
    Alert.alert(
      'Request Data Export',
      'We will prepare a full copy of your data (conversations, memories, profile) and notify you when it is ready. This may take up to 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Export',
          onPress: async () => {
            setExportLoading(true);
            try {
              await privacyApi.requestExport();
              Alert.alert('Request Submitted', 'Your data export has been queued. You will receive a notification when it is ready to download.');
            } catch {
              Alert.alert('Error', 'Could not submit your export request. Please try again later.');
            } finally {
              setExportLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Memory purge ───────────────────────────────────────────────────────────

  const handlePurgeMemories = async () => {
    Alert.alert(
      'Purge All Memories',
      'This will permanently delete all memories your AI companion has built about you. This cannot be undone. Your conversations will be retained.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Memories',
          style: 'destructive',
          onPress: async () => {
            setPurgeLoading(true);
            try {
              const result = await privacyApi.purgeMemories();
              Alert.alert('Done', `${result.deletedCount} memories have been permanently deleted.`);
            } catch {
              Alert.alert('Error', 'Could not purge memories. Please try again later.');
            } finally {
              setPurgeLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Account deletion ───────────────────────────────────────────────────────

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all conversations, memories, and personal data. A 14-day grace period applies during which you can cancel the request by signing back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await privacyApi.requestAccountDeletion('User-initiated from app');
              Alert.alert(
                'Deletion Scheduled',
                `Your account is scheduled for deletion on ${new Date(result.scheduledAt).toLocaleDateString()}. Sign in before then to cancel.`,
              );
            } catch {
              Alert.alert('Error', 'Could not process your request. Please contact support.');
            }
          },
        },
      ],
    );
  };

  // ── Unblock ────────────────────────────────────────────────────────────────

  const handleUnblock = (id: string) => {
    const item = blocks.find(b => b.id === id);
    Alert.alert(
      'Remove Block',
      `Unblock ${item?.targetDisplayName || 'this item'}? They will be able to appear in discovery and interactions again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await privacyApi.removeBlock(id);
              setBlocks(prev => prev.filter(b => b.id !== id));
            } catch {
              Alert.alert('Error', 'Could not remove this block. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Safety &amp; Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['privacy', 'blocks'] as ActiveTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab === 'privacy' ? 'Privacy tab' : 'Blocked list tab'}
            accessibilityState={{ selected: activeTab === tab }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon
                name={tab === 'privacy' ? 'lock' : 'ban'}
                size={14}
                color={activeTab === tab ? darkThemeColors.accent : darkThemeColors.textMuted}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'privacy' ? 'Privacy' : 'Blocked'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingSettings ? (
            <ActivityIndicator size="large" color={darkThemeColors.accent} style={styles.loader} />
          ) : settings ? (
            <>
              {/* Visibility */}
              <SectionHeader
                title="Visibility"
                description="Control what other people and systems can see about you."
              />
              <View style={styles.card}>
                <ToggleRow
                  label="Show Online Status"
                  description="Let creators see when you are active on the platform."
                  value={settings.showOnlineStatus}
                  onToggle={v => handleToggle('showOnlineStatus', v)}
                  disabled={savingKey === 'showOnlineStatus'}
                />
              </View>

              {/* Personalization & AI */}
              <SectionHeader
                title="AI &amp; Personalization"
                description="Manage how your data is used to improve your experience."
              />
              <View style={styles.card}>
                <ToggleRow
                  label="Allow Analytics"
                  description="Help improve the platform by sharing anonymous usage data."
                  value={settings.allowAnalytics}
                  onToggle={v => handleToggle('allowAnalytics', v)}
                  disabled={savingKey === 'allowAnalytics'}
                />
                <View style={styles.divider} />
                <ToggleRow
                  label="AI Personalization"
                  description="Use your interactions to tailor character responses and recommendations."
                  value={settings.allowPersonalization}
                  onToggle={v => handleToggle('allowPersonalization', v)}
                  disabled={savingKey === 'allowPersonalization'}
                />
                <View style={styles.divider} />
                <ToggleRow
                  label="Memory Retention"
                  description="Allow AI characters to build and recall memories of your conversations."
                  value={settings.allowMemoryRetention}
                  onToggle={v => handleToggle('allowMemoryRetention', v)}
                  disabled={savingKey === 'allowMemoryRetention'}
                />
                <View style={styles.divider} />
                <ToggleRow
                  label="Proactive Messages"
                  description="Let AI characters reach out to you between conversations."
                  value={settings.allowProactiveMessaging}
                  onToggle={v => handleToggle('allowProactiveMessaging', v)}
                  disabled={savingKey === 'allowProactiveMessaging'}
                />
              </View>

              {/* Communications */}
              <SectionHeader
                title="Communications"
                description="Control marketing and promotional communications."
              />
              <View style={styles.card}>
                <ToggleRow
                  label="Marketing Emails"
                  description="Receive updates, tips, and offers from the team."
                  value={settings.marketingEmailsEnabled}
                  onToggle={v => handleToggle('marketingEmailsEnabled', v)}
                  disabled={savingKey === 'marketingEmailsEnabled'}
                />
              </View>

              {/* Your Data */}
              <SectionHeader
                title="Your Data"
                description="Download or manage the data associated with your account."
              />
              <View style={styles.card}>
                <ActionRow
                  label="Request Data Export"
                  description="Download a full copy of your conversations, memories, and profile."
                  onPress={handleRequestExport}
                  loading={exportLoading}
                  icon="arrow-right"
                />
                <View style={styles.divider} />
                <ActionRow
                  label="Purge All Memories"
                  description="Permanently erase all AI memories about you. Cannot be undone."
                  onPress={handlePurgeMemories}
                  loading={purgeLoading}
                  dangerMode
                  icon="trash"
                />
              </View>

              {/* Danger Zone */}
              <SectionHeader
                title="Danger Zone"
                description="Irreversible account actions. Proceed with caution."
              />
              <View style={[styles.card, styles.dangerCard]}>
                <ActionRow
                  label="Delete Account"
                  description="Permanently delete your account and all associated data after a 14-day grace period."
                  onPress={handleDeleteAccount}
                  dangerMode
                  icon="warning"
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Your privacy matters. Data processed in accordance with our Privacy Policy.
                  For questions, contact privacy@lovira.ai
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Could not load settings.</Text>
          )}
        </ScrollView>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <View style={styles.flex}>
          {loadingBlocks ? (
            <ActivityIndicator size="large" color={darkThemeColors.accent} style={styles.loader} />
          ) : blocks.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${darkThemeColors.accent}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon name="ban" size={24} color={darkThemeColors.textMuted} />
              </View>
              <Text style={styles.emptyStateTitle}>No Blocked Items</Text>
              <Text style={styles.emptyStateDesc}>
                Characters, creators, or users you block will appear here. You can remove blocks at any time.
              </Text>
            </View>
          ) : (
            <FlatList
              data={blocks}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <BlockedRow item={item} onUnblock={handleUnblock} />
              )}
              contentContainerStyle={styles.blockList}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
            />
          )}
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.huge,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkThemeColors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 28,
    color: darkThemeColors.textPrimary,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.headingMedium,
    color: darkThemeColors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkThemeColors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: darkThemeColors.surface,
  },
  activeTab: {
    backgroundColor: darkThemeColors.accentMuted,
  },
  tabText: {
    ...typography.labelMedium,
    color: darkThemeColors.textMuted,
  },
  activeTabText: {
    color: darkThemeColors.accent,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },

  // Section
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: darkThemeColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xxs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkThemeColors.border,
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  toggleRowText: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  toggleDescription: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    lineHeight: 18,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionRowText: {
    flex: 1,
  },
  actionLabel: {
    ...typography.bodyMedium,
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  actionDescription: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 18,
    color: darkThemeColors.textMuted,
  },

  // Danger
  dangerText: {
    color: darkThemeColors.danger,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: darkThemeColors.border,
    marginLeft: spacing.lg,
  },

  // Blocked list
  blockList: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkThemeColors.border,
    marginVertical: spacing.xxs,
  },
  blockedInfo: {
    flex: 1,
    gap: 2,
  },
  blockedType: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
  },
  blockedName: {
    ...typography.bodyMedium,
    color: darkThemeColors.textPrimary,
  },
  unblockButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkThemeColors.danger,
  },
  unblockText: {
    ...typography.caption,
    color: darkThemeColors.danger,
  },

  // Empty / loader states
  loader: {
    marginTop: spacing.huge,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.headingMedium,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateDesc: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.huge,
  },

  // Footer
  footer: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkThemeColors.border,
  },
  footerText: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
