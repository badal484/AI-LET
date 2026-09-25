import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CharacterApi } from '../../services/api/characterApi.js';
import type { CharacterSummary } from '@ai-companion/types';
import type { RootStackParamList } from '../../navigation/types.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const ExploreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['characters', 'explore', search],
    queryFn: () => CharacterApi.listCharacters({ search: search.trim() || undefined }),
  });

  const handleStartChat = (character: CharacterSummary) => {
    navigation.navigate('Chat', { characterId: character.id });
  };

  const renderCharacterCard = ({ item }: { item: CharacterSummary }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handleStartChat(item)}
      >
        <View style={styles.cardHeader}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.characterName}>{item.name}</Text>
              {item.isFeatured && (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredText}>FEATURED</Text>
                </View>
              )}
            </View>
            <Text style={styles.categoryText}>{item.category || 'Companion'}</Text>
          </View>
        </View>

        <Text style={styles.tagline} numberOfLines={2}>
          {item.tagline || 'Ready to chat with you.'}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.traitsRow}>
            <View style={styles.traitBadge}>
              <Text style={styles.traitText}>{item.category || 'Companion'}</Text>
            </View>
            <View style={styles.traitBadge}>
              <Text style={styles.traitText}>v{item.currentVersionNumber || 1}.0</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleStartChat(item)}
          >
            <Text style={styles.chatButtonText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Companions</Text>
        <Text style={styles.subtitle}>Discover AI personalities with depth, memory, and warmth</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search characters, traits, worlds..."
            placeholderTextColor={darkThemeColors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={darkThemeColors.accent} />
          <Text style={styles.loadingText}>Loading companions...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load companions</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderCharacterCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={darkThemeColors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Companions Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search criteria</Text>
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
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
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
    marginBottom: spacing.md,
  },
  searchContainer: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    height: 42,
    color: darkThemeColors.textPrimary,
    ...typography.bodyMedium,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: darkThemeColors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: darkThemeColors.accent,
    ...typography.titleMedium,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  characterName: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    fontWeight: '700',
  },
  featuredBadge: {
    backgroundColor: darkThemeColors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredText: {
    color: darkThemeColors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryText: {
    ...typography.labelSmall,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  tagline: {
    ...typography.bodyMedium,
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  traitBadge: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  traitText: {
    color: darkThemeColors.textSecondary,
    fontSize: 11,
  },
  chatButton: {
    backgroundColor: darkThemeColors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: 10,
  },
  chatButtonText: {
    color: '#000000',
    fontWeight: '700',
    ...typography.labelMedium,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: darkThemeColors.textMuted,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: darkThemeColors.danger,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: darkThemeColors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: darkThemeColors.textPrimary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
  },
});
