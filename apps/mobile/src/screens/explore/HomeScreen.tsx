import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  IconButton,
  Avatar,
  Badge,
  SectionHeader,
  CharacterCard,
  Skeleton,
  ErrorState,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type {
  CharacterCatalogItem,
  ContinueConversationItem,
  CuratedCollectionSummary,
  CharacterCategorySummary,
  HomeFeedSection,
} from '@ai-companion/types';

import { useNotificationStore } from '../../stores/notificationStore.js';
import { useDiscoveryStore } from '../../stores/discoveryStore.js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const { favoriteIds, toggleFavoriteOptimistic } = useDiscoveryStore();

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const { data: homeFeed, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['discovery', 'home'],
    queryFn: () => DiscoveryApi.getHomeFeed(false),
  });

  const handleOpenCharacter = (char: CharacterCatalogItem) => {
    navigation.navigate('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  const handleContinueChat = (item: ContinueConversationItem) => {
    navigation.navigate('Chat', {
      characterId: item.characterId,
      conversationId: item.conversationId,
    });
  };

  const handleOpenCategory = (cat: CharacterCategorySummary) => {
    navigation.navigate('CategoryBrowser', {
      categorySlug: cat.slug,
      categoryName: cat.displayName,
    });
  };

  const handleOpenCollection = (col: CuratedCollectionSummary) => {
    navigation.navigate('CollectionDetail', {
      collectionSlug: col.slug,
      title: col.title,
    });
  };

  const handleOpenSearch = () => {
    navigation.navigate('Search');
  };

  const handleToggleFav = (char: CharacterCatalogItem) => {
    toggleFavoriteOptimistic(char.id);
  };

  if (isLoading && !homeFeed) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Skeleton.Line width={180} height={24} style={{ marginBottom: 6 }} />
            <Skeleton.Line width={240} height={14} />
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Skeleton.Card height={140} />
          <Skeleton.Card height={220} />
          <Skeleton.Card height={160} />
        </ScrollView>
      </View>
    );
  }

  if (isError && !homeFeed) {
    return (
      <View style={styles.container}>
        <ErrorState
          type="network"
          title="Unable to load discovery feed"
          message="Please check your connection and reload."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const greeting = homeFeed?.greeting || {
    title: 'Discover Companions',
    subtitle: 'Personalities with depth, warmth, and memory',
    isReturningUser: false,
  };

  return (
    <View style={styles.container}>
      {/* Editorial Header */}
      <View style={styles.header}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>{greeting.title}</Text>
          <Text style={styles.greetingSubtitle}>{greeting.subtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="bell"
            size="md"
            variant="surface"
            badgeCount={unreadCount}
            onPress={() => navigation.navigate('NotificationCenter')}
            accessibilityLabel="Notifications"
          />
          <IconButton
            icon="search"
            size="md"
            variant="surface"
            onPress={handleOpenSearch}
            accessibilityLabel="Search companions"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={darkThemeColors.accent}
          />
        }
      >
        {/* Sections */}
        {(homeFeed?.sections || []).map((section: HomeFeedSection) => {
          switch (section.sectionKey) {
            case 'CONTINUE':
              return renderContinueSection(section, handleContinueChat);

            case 'RECOMMENDED':
              return renderRecommendedSection(
                section,
                handleOpenCharacter,
                handleToggleFav,
                favoriteIds,
              );

            case 'FEATURED':
              return renderFeaturedSection(
                section,
                handleOpenCharacter,
                handleToggleFav,
                favoriteIds,
              );

            case 'COLLECTIONS':
              return renderCollectionsSection(section, handleOpenCollection);

            case 'CATEGORIES':
              return renderCategoriesSection(section, handleOpenCategory);

            case 'TRENDING':
            case 'NEW':
              return renderCharacterListSection(
                section,
                handleOpenCharacter,
                handleToggleFav,
                favoriteIds,
              );

            default:
              return null;
          }
        })}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Section Renderers
// ---------------------------------------------------------------------------

function renderContinueSection(
  section: HomeFeedSection,
  onContinue: (item: ContinueConversationItem) => void,
) {
  const items: ContinueConversationItem[] = section.items || [];
  if (items.length === 0) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.conversationId}
            style={styles.continueCard}
            activeOpacity={0.85}
            onPress={() => onContinue(item)}
            accessibilityRole="button"
            accessibilityLabel={`Continue conversation with ${item.characterName}`}
          >
            <Avatar uri={item.characterAvatarUrl} name={item.characterName} size="md" />
            <View style={styles.continueInfo}>
              <View style={styles.continueNameRow}>
                <Text style={styles.continueName} numberOfLines={1}>
                  {item.characterName}
                </Text>
                {item.relationshipStage && (
                  <Badge label={item.relationshipStage} variant="stage" size="sm" />
                )}
              </View>
              <Text style={styles.continueSnippet} numberOfLines={2}>
                {item.lastMessageSnippet || 'Conversation open'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function renderRecommendedSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onFav: (char: CharacterCatalogItem) => void,
  favoriteIds: Set<string>,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {items.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            variant="grid"
            onPress={onOpen}
            onFavoriteToggle={onFav}
            isFavorited={favoriteIds.has(char.id) || char.isFavorite}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function renderFeaturedSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onFav: (char: CharacterCatalogItem) => void,
  favoriteIds: Set<string>,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;
  const hero = items[0];
  if (!hero) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <CharacterCard
        character={hero}
        variant="featured"
        onPress={onOpen}
        onFavoriteToggle={onFav}
        isFavorited={favoriteIds.has(hero.id) || hero.isFavorite}
      />
    </View>
  );
}

function renderCollectionsSection(
  section: HomeFeedSection,
  onOpenCollection: (col: CuratedCollectionSummary) => void,
) {
  const collections: CuratedCollectionSummary[] = section.items || [];
  if (collections.length === 0) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {collections.map((col) => (
          <TouchableOpacity
            key={col.id}
            style={styles.collectionCard}
            activeOpacity={0.85}
            onPress={() => onOpenCollection(col)}
            accessibilityRole="button"
            accessibilityLabel={`${col.title} collection`}
          >
            {col.heroImageUrl ? (
              <Image source={{ uri: col.heroImageUrl }} style={styles.collectionImage} />
            ) : (
              <View style={[styles.collectionImage, styles.collectionPlaceholder]} />
            )}
            <View style={styles.collectionOverlay}>
              {col.badgeText && (
                <View style={styles.collectionBadge}>
                  <Text style={styles.collectionBadgeText}>{col.badgeText}</Text>
                </View>
              )}
              <Text style={styles.collectionTitle}>{col.title}</Text>
              <Text style={styles.collectionSubtitle} numberOfLines={2}>
                {col.subtitle || `${col.itemCount} Companions`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function renderCategoriesSection(
  section: HomeFeedSection,
  onOpenCategory: (cat: CharacterCategorySummary) => void,
) {
  const categories: CharacterCategorySummary[] = section.items || [];
  if (categories.length === 0) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <View style={styles.categoriesGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryGridItem}
            activeOpacity={0.8}
            onPress={() => onOpenCategory(cat)}
            accessibilityRole="button"
            accessibilityLabel={`Category ${cat.displayName}`}
          >
            <Text style={styles.categoryItemTitle}>{cat.displayName}</Text>
            <Text style={styles.categoryItemCount}>
              {cat.characterCount !== undefined ? `${cat.characterCount} companions` : 'Explore'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function renderCharacterListSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onFav: (char: CharacterCatalogItem) => void,
  favoriteIds: Set<string>,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      <SectionHeader title={section.title} subtitle={section.subtitle} style={styles.sectionHeaderPadding} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {items.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            variant="compact"
            onPress={onOpen}
            onFavoriteToggle={onFav}
            isFavorited={favoriteIds.has(char.id) || char.isFavorite}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.background,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },
  sectionContainer: {
    marginTop: spacing.xl,
  },
  sectionHeaderPadding: {
    paddingHorizontal: spacing.lg,
  },
  horizontalScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  // Continue Card
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.72,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  continueInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  continueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.xs,
  },
  continueName: {
    fontSize: 14,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    flex: 1,
  },
  continueSnippet: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    lineHeight: 16,
  },
  // Collections Card
  collectionCard: {
    width: SCREEN_WIDTH * 0.65,
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  collectionImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  collectionPlaceholder: {
    backgroundColor: darkThemeColors.surfaceHover,
  },
  collectionOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    backgroundColor: 'rgba(11, 13, 19, 0.75)',
  },
  collectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: darkThemeColors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  collectionBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: darkThemeColors.accentText,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  collectionSubtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryGridItem: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  categoryItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
  },
  categoryItemCount: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
});
