import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import { useDiscoveryStore } from '../../stores/discoveryStore.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  SearchInput,
  CharacterCard,
  Badge,
  Skeleton,
  EmptyState,
  IconButton,
  Icon,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { CharacterCatalogItem } from '@ai-companion/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type SearchRouteProp = RouteProp<RootStackParamList, 'Search'>;

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SearchRouteProp>();

  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    route.params?.category,
  );

  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useDiscoveryStore();

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
      if (query.trim().length > 1) {
        addRecentSearch(query.trim());
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, addRecentSearch]);

  const { data: categories } = useQuery({
    queryKey: ['discovery', 'categories'],
    queryFn: () => DiscoveryApi.getCategories(),
  });

  const { data: searchResult, isLoading } = useQuery({
    queryKey: ['discovery', 'search', debouncedQuery, selectedCategory],
    queryFn: () =>
      DiscoveryApi.searchCharacters({
        q: debouncedQuery || undefined,
        category: selectedCategory,
        limit: 30,
      }),
  });

  const handleOpenCharacter = (char: CharacterCatalogItem) => {
    navigation.navigate('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
  };

  const handleToggleCategory = (slug: string) => {
    if (selectedCategory === slug) {
      setSelectedCategory(undefined);
    } else {
      setSelectedCategory(slug);
    }
  };

  const renderCharacterItem = ({ item }: { item: CharacterCatalogItem }) => (
    <CharacterCard
      character={item}
      variant="horizontal"
      onPress={handleOpenCharacter}
    />
  );

  return (
    <View style={styles.container}>
      {/* Top Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchHeaderRow}>
          {navigation.canGoBack() && (
            <IconButton
              icon="←"
              size="sm"
              variant="ghost"
              onPress={navigation.goBack}
              accessibilityLabel="Back"
              style={{ marginRight: spacing.xs }}
            />
          )}
          <View style={{ flex: 1 }}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              autoFocus={!route.params?.initialQuery}
            />
          </View>
        </View>
      </View>

      {/* Category Pills Bar */}
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === undefined && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Filter by all genres"
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === undefined && styles.categoryPillTextActive,
              ]}
            >
              All Genres
            </Text>
          </TouchableOpacity>
          {(categories || []).map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPill,
                selectedCategory === cat.slug && styles.categoryPillActive,
              ]}
              onPress={() => handleToggleCategory(cat.slug)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by genre ${cat.displayName}`}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat.slug && styles.categoryPillTextActive,
                ]}
              >
                {cat.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent Searches */}
      {!debouncedQuery && recentSearches.length > 0 && (
        <View style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearRecentSearches} accessibilityLabel="Clear all recent searches">
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentChipsWrap}>
            {recentSearches.map((term, idx) => (
              <View key={idx} style={styles.recentChip}>
                <TouchableOpacity onPress={() => handleSelectRecent(term)} accessibilityRole="button">
                  <Text style={styles.recentChipText}>{term}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeRecentSearch(term)}
                  style={styles.removeChipButton}
                  accessibilityLabel={`Remove ${term} from recent searches`}
                >
                  <Icon name="close" size={10} color={darkThemeColors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Results / Loading / Empty */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
          <Skeleton.Card height={90} />
        </View>
      ) : (
        <FlatList
          data={searchResult?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderCharacterItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingVertical: spacing.xl }}>
              <EmptyState
                icon="search"
                title="No companions found"
                description={
                  debouncedQuery
                    ? `We couldn't find any companions matching "${debouncedQuery}".`
                    : 'Try searching by character name, category, or personality trait.'
                }
              />

              {/* Spell Correction / Did you mean suggestion */}
              {searchResult?.suggestedQueries && searchResult.suggestedQueries.length > 0 && (
                <View style={styles.suggestionsBlock}>
                  <Text style={styles.suggestionTitle}>Did you mean:</Text>
                  <View style={styles.suggestionsRow}>
                    {searchResult.suggestedQueries.map((suggested, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setQuery(suggested);
                          setDebouncedQuery(suggested);
                        }}
                        style={styles.suggestionPill}
                      >
                        <Text style={styles.suggestionPillText}>"{suggested}"</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Fallback Categories on Zero Results */}
              {searchResult?.suggestedCategories && searchResult.suggestedCategories.length > 0 && (
                <View style={styles.genresFallbackBlock}>
                  <Text style={styles.suggestionTitle}>Explore popular genres:</Text>
                  <View style={styles.genresRow}>
                    {searchResult.suggestedCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => {
                          setQuery('');
                          setDebouncedQuery('');
                          setSelectedCategory(cat.slug);
                        }}
                        style={styles.genrePill}
                      >
                        <Badge label={cat.displayName} variant="category" size="md" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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
  searchBarContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: darkThemeColors.background,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesBar: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xl,
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  categoryPillActive: {
    backgroundColor: darkThemeColors.accent,
    borderColor: darkThemeColors.accent,
  },
  categoryPillText: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: darkThemeColors.accentText,
  },
  recentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textMuted,
  },
  clearAllText: {
    fontSize: 12,
    color: darkThemeColors.accent,
    fontWeight: '600',
  },
  recentChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.xs,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  recentChipText: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
  },
  removeChipButton: {
    padding: 4,
    marginLeft: 2,
  },
  removeChipText: {
    fontSize: 10,
    color: darkThemeColors.textMuted,
  },
  listContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  suggestionsBlock: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  suggestionTitle: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  suggestionPill: {
    backgroundColor: darkThemeColors.accentMuted,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkThemeColors.accent,
  },
  suggestionPillText: {
    color: darkThemeColors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  genresFallbackBlock: {
    marginTop: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  genrePill: {
    marginVertical: 2,
  },
});
