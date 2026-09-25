import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { memoryApi } from '../../services/api/memoryApi.js';
import {
  IconButton,
  Button,
  Badge,
  SearchInput,
  ModalDialog,
  Skeleton,
  EmptyState,
  ToastService,
  Icon,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { MemoryDetail, UserMemorySettingsData } from '@ai-companion/types';

export const MemorySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<UserMemorySettingsData | null>(null);
  const [memories, setMemories] = useState<MemoryDetail[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [editingMemory, setEditingMemory] = useState<MemoryDetail | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [wipeModalVisible, setWipeModalVisible] = useState<boolean>(false);
  const [isWiping, setIsWiping] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, memoriesRes] = await Promise.all([
        memoryApi.getSettings(),
        memoryApi.listMemories({ limit: 100 }),
      ]);
      setSettings(settingsRes);
      setMemories(memoriesRes.items);
    } catch {
      Alert.alert('Error', 'Failed to load memory settings. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleToggleMemory = async (value: boolean) => {
    if (!settings) return;
    const prev = settings.memoryEnabled;
    setSettings({ ...settings, memoryEnabled: value });

    try {
      const updated = await memoryApi.updateSettings({ memoryEnabled: value });
      setSettings(updated);
      ToastService.show({
        message: value ? 'Companion memory enabled' : 'Companion memory paused',
        type: 'info',
        duration: 2000,
      });
    } catch {
      setSettings({ ...settings, memoryEnabled: prev });
      Alert.alert('Error', 'Failed to update memory preference.');
    }
  };

  const handleDeleteSingle = (memory: MemoryDetail) => {
    Alert.alert(
      'Forget this fact?',
      `Are you sure you want to remove "${memory.content}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            try {
              await memoryApi.deleteMemory(memory.id);
              setMemories((prev) => prev.filter((m) => m.id !== memory.id));
              ToastService.show({ message: 'Fact forgotten', type: 'info', duration: 1500 });
            } catch {
              Alert.alert('Error', 'Failed to delete memory.');
            }
          },
        },
      ],
    );
  };

  const handleConfirmWipe = async () => {
    setIsWiping(true);
    try {
      const res = await memoryApi.forgetAllMemories();
      setMemories([]);
      setWipeModalVisible(false);
      ToastService.show({
        message: `Cleared ${res.deletedCount} remembered items`,
        type: 'success',
      });
    } catch {
      Alert.alert('Error', 'Failed to wipe memories.');
    } finally {
      setIsWiping(false);
    }
  };

  const handleOpenEdit = (memory: MemoryDetail) => {
    setEditingMemory(memory);
    setEditContent(memory.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMemory || !editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const updated = await memoryApi.updateMemory(editingMemory.id, {
        content: editContent.trim(),
      });
      setMemories((prev) =>
        prev.map((m) => (m.id === editingMemory.id ? { ...m, content: updated.content } : m)),
      );
      setEditingMemory(null);
      ToastService.show({ message: 'Memory updated', type: 'success', duration: 1500 });
    } catch {
      Alert.alert('Error', 'Failed to update memory.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filter memories based on search query and category
  const filteredMemories = memories.filter((m) => {
    const matchesSearch =
      !searchFilter.trim() ||
      m.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (m.characterName && m.characterName.toLowerCase().includes(searchFilter.toLowerCase()));

    const matchesCat = !selectedCategory || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(memories.map((m) => m.category)));

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="←" size="sm" variant="ghost" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
          <Text style={styles.title}>Memory & Privacy</Text>
        </View>
        <View style={{ padding: spacing.lg }}>
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="←"
          size="sm"
          variant="ghost"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        />
        <View style={{ flex: 1, marginLeft: spacing.xs }}>
          <Text style={styles.title}>Memory & Privacy</Text>
          <Text style={styles.subtitle}>Control what companions remember about you</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={darkThemeColors.accent}
          />
        }
      >
        {/* Master Toggle Card */}
        <View style={styles.settingCard}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Companion Memory</Text>
            <Text style={styles.settingDescription}>
              Allow companions to remember facts, preferences, and conversations to create natural, personalized continuity.
            </Text>
          </View>
          <Switch
            value={settings?.memoryEnabled ?? true}
            onValueChange={handleToggleMemory}
            trackColor={{ false: darkThemeColors.surfaceSubtle, true: darkThemeColors.accent }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Toggle companion memory"
          />
        </View>

        {/* Informational Guidance */}
        <View style={styles.infoBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="lock" size={15} color={darkThemeColors.accent} />
            <Text style={styles.infoTitle}>Private &amp; Editable</Text>
          </View>
          <Text style={styles.infoDescription}>
            Companions learn preferences naturally (e.g. goals, hobbies, or life events). Memory is encrypted, private to you, and never shared across users.
          </Text>
        </View>

        {/* Search & Category Filter */}
        {memories.length > 0 && (
          <View style={styles.filterSection}>
            <SearchInput
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Search remembered facts..."
            />

            {categories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChips}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedCategory === null && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedCategory === null && styles.filterChipTextActive,
                    ]}
                  >
                    All ({memories.length})
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterChip,
                      selectedCategory === cat && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedCategory === cat && styles.filterChipTextActive,
                      ]}
                    >
                      {cat.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Remembered Facts Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Remembered Facts ({filteredMemories.length})</Text>
          {memories.length > 0 && (
            <TouchableOpacity onPress={() => setWipeModalVisible(true)} accessibilityLabel="Wipe all memories">
              <Text style={styles.forgetAllText}>Wipe All</Text>
            </TouchableOpacity>
          )}
        </View>

        {filteredMemories.length === 0 ? (
          <EmptyState
            icon="brain"
            title={memories.length === 0 ? 'No Memories Stored' : 'No Matching Facts'}
            description={
              memories.length === 0
                ? 'As you chat with your companions, they will naturally remember your preferences and stories.'
                : `No remembered facts match "${searchFilter}".`
            }
          />
        ) : (
          filteredMemories.map((item) => (
            <View key={item.id} style={styles.memoryCard}>
              <View style={styles.memoryHeader}>
                <Badge label={item.category.replace(/_/g, ' ')} variant="stage" size="sm" />
                <Text style={styles.characterScopeText}>
                  {item.characterName ? `with ${item.characterName}` : 'Universal'}
                </Text>
              </View>

              <Text style={styles.memoryContent}>{item.content}</Text>

              <View style={styles.memoryActions}>
                <Button
                  label="Edit"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleOpenEdit(item)}
                />
                <Button
                  label="Forget"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleDeleteSingle(item)}
                  style={styles.forgetBtn}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Memory Modal */}
      <ModalDialog
        visible={!!editingMemory}
        title="Edit Remembered Fact"
        description="Correct or update what your companion remembers:"
        primaryLabel="Save Changes"
        isPrimaryLoading={isSavingEdit}
        onPrimaryAction={handleSaveEdit}
        onClose={() => setEditingMemory(null)}
      >
        <TextInput
          style={styles.modalInput}
          value={editContent}
          onChangeText={setEditContent}
          multiline
          numberOfLines={4}
          placeholder="Enter corrected fact..."
          placeholderTextColor={darkThemeColors.textMuted}
          selectionColor={darkThemeColors.accent}
        />
      </ModalDialog>

      {/* Wipe All Memories Double-Confirmation Modal */}
      <ModalDialog
        visible={wipeModalVisible}
        title="Wipe All Memories?"
        description="This will permanently delete all facts, preferences, and personal notes your companions have learned about you across all conversations. This action is irreversible."
        primaryLabel="Permanently Wipe"
        primaryVariant="danger"
        isPrimaryLoading={isWiping}
        onPrimaryAction={handleConfirmWipe}
        onClose={() => setWipeModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: darkThemeColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
  },
  infoBox: {
    backgroundColor: darkThemeColors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: darkThemeColors.accent,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  categoryChips: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.xl,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: darkThemeColors.accent,
    borderColor: darkThemeColors.accent,
  },
  filterChipText: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: darkThemeColors.accentText,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  forgetAllText: {
    fontSize: 13,
    color: darkThemeColors.danger,
    fontWeight: '600',
  },
  memoryCard: {
    backgroundColor: darkThemeColors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.md,
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  characterScopeText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  memoryContent: {
    fontSize: 14,
    lineHeight: 20,
    color: darkThemeColors.textPrimary,
    marginVertical: spacing.xs,
  },
  memoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  forgetBtn: {
    borderColor: 'transparent',
  },
  modalInput: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    color: darkThemeColors.textPrimary,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
