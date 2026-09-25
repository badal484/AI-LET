import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { CharacterCatalogItem } from '@ai-companion/types';
import { Icon, IconButton } from '../../components/common/index.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type CategoryRouteProp = RouteProp<RootStackParamList, 'CategoryBrowser'>;

export const CategoryBrowserScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CategoryRouteProp>();
  const slug = route.params.categorySlug;

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['discovery', 'category', slug],
    queryFn: () => DiscoveryApi.getCategoryBySlug(slug),
  });

  const handleOpenCharacter = (char: CharacterCatalogItem) => {
    navigation.navigate('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  const category = data?.category;
  const allCharacters = data?.characters || [];

  const filteredCharacters = selectedTag
    ? allCharacters.filter(c => c.tags.some(t => t.slug === selectedTag))
    : allCharacters;

  const renderCharacterCard = ({ item }: { item: CharacterCatalogItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => handleOpenCharacter(item)}
    >
      <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.accessType !== 'free' && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.tagline} numberOfLines={2}>
          {item.tagline}
        </Text>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 2).map(tag => (
            <View key={tag.id} style={styles.tagPill}>
              <Text style={styles.tagPillText}>#{tag.displayName}</Text>
            </View>
          ))}
          {item.voiceAvailable && (
            <View style={styles.voicePill}>
              <Icon name="voice" size={11} color={darkThemeColors.accent} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{category?.displayName || route.params.categoryName || 'Category'}</Text>
          <Text style={styles.headerSubtitle}>{category?.description || 'Browse companions'}</Text>
        </View>
      </View>

      {/* Tag Filters */}
      {category?.tags && category.tags.length > 0 && (
        <View style={styles.tagsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
            <TouchableOpacity
              style={[styles.tagFilterPill, selectedTag === null && styles.tagFilterActive]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[styles.tagFilterText, selectedTag === null && styles.tagFilterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {category.tags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.tagFilterPill, selectedTag === tag.slug && styles.tagFilterActive]}
                onPress={() => setSelectedTag(selectedTag === tag.slug ? null : tag.slug)}
              >
                <Text style={[styles.tagFilterText, selectedTag === tag.slug && styles.tagFilterTextActive]}>
                  {tag.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={darkThemeColors.accent} />
          <Text style={styles.loadingText}>Loading category...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCharacters}
          keyExtractor={item => item.id}
          renderItem={renderCharacterCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No companions in this category</Text>
              <Text style={styles.emptySubtitle}>Check back soon for new arrivals.</Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: darkThemeColors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backButtonText: {
    color: darkThemeColors.textPrimary,
    fontSize: 22,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  tagsBar: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  tagsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tagFilterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  tagFilterActive: {
    backgroundColor: darkThemeColors.accent,
    borderColor: darkThemeColors.accent,
  },
  tagFilterText: {
    ...typography.caption,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
  },
  tagFilterTextActive: {
    color: darkThemeColors.accentText,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: darkThemeColors.surface,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.subtitle1,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  proBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EAB308',
  },
  tagline: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  tagPill: {
    backgroundColor: darkThemeColors.surfaceHover,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagPillText: {
    fontSize: 10,
    color: darkThemeColors.textMuted,
  },
  voicePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  voicePillText: {
    fontSize: 10,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h3,
    color: darkThemeColors.textPrimary,
  },
  emptySubtitle: {
    ...typography.body2,
    color: darkThemeColors.textMuted,
    marginTop: 4,
  },
});
