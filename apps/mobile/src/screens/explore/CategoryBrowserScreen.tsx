import { AGE_BLUR_RADIUS, AgeRestrictedBadge, ageRestricted, openIfAllowed } from '../../components/common/AgeRestricted.js';
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import type { CharacterCatalogItem } from '@ai-companion/types';
import { IconButton, Skeleton } from '../../components/common/index.js';
import { BottomFade } from '../../components/common/BottomFade.js';
import { PressableScale } from '../../components/common/PressableScale.js';
import { FallbackImage } from '../../components/common/FallbackImage.js';
import { thumb, prefetchImages } from '../../utils/thumb.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type CategoryRouteProp = RouteProp<RootStackParamList, 'CategoryBrowser'>;

const GUTTER = 16;
const GAP = 10;

/** "See all" for one category: the same photo cards as Home, two to a row, with tag filters on top. */
export const CategoryBrowserScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CategoryRouteProp>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 4 : width >= 640 ? 3 : 2;
  const cardWidth = Math.floor((width - GUTTER * 2 - GAP * (numColumns - 1)) / numColumns);
  const cardHeight = Math.round(cardWidth * 1.38);
  const slug = route.params.categorySlug;

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['discovery', 'category', slug],
    queryFn: () => DiscoveryApi.getCategoryBySlug(slug),
  });

  const handleOpenCharacter = (char: CharacterCatalogItem) => {
    navigation.navigate('CharacterDetail', { characterId: char.id, characterSlug: char.slug });
  };

  const category = data?.category;
  const allCharacters = data?.characters || [];
  React.useEffect(() => {
    if (allCharacters.length > 0) {
      const urls = allCharacters.map(c => c.coverImageUrl || c.avatarUrl).filter(Boolean) as string[];
      prefetchImages(urls.slice(0, 12), cardWidth);
    }
  }, [allCharacters, cardWidth]);
  const filteredCharacters = selectedTag ? allCharacters.filter((c) => c.tags.some((t) => t.slug === selectedTag)) : allCharacters;
  const title = category?.displayName || route.params.categoryName || 'Category';
  const count = allCharacters.length;

  const renderCard = ({ item }: { item: CharacterCatalogItem }) => (
    <PressableScale
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      onPress={() => openIfAllowed(item, handleOpenCharacter)}
      accessibilityRole="button"
      accessibilityLabel={ageRestricted(item) ? `${item.name}, 18+ only` : `Open ${item.name}`}
    >
      <FallbackImage
        uris={[thumb(item.coverImageUrl, cardWidth), thumb(item.avatarUrl, cardWidth)]}
        name={item.name}
        style={styles.cardImage}
        fadeDuration={150}
        blurRadius={ageRestricted(item) ? AGE_BLUR_RADIUS : 0}
      />
      {ageRestricted(item) && <AgeRestrictedBadge />}
      <BottomFade height={cardHeight * 0.55} />
      <View style={styles.cardBottom}>
        <View style={styles.nameRow}>
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {item.name}
          </Text>
          <View style={styles.onlineDot} />
        </View>
        {item.tagline ? (
          <Text style={styles.cardTagline} numberOfLines={2} maxFontSizeMultiplier={1.1}>
            {item.tagline}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {count > 0 && <Text style={styles.headerSubtitle}>{count === 1 ? '1 person to talk to' : `${count} people to talk to`}</Text>}
        </View>
      </View>

      {category?.tags && category.tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll} style={styles.tagsBar}>
          {[{ id: 'all', slug: null as string | null, displayName: 'All' }, ...category.tags].map((tag) => {
            const active = selectedTag === tag.slug;
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setSelectedTag(tag.slug === null || active ? null : tag.slug)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{tag.displayName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: numColumns * 2 }).map((_, i) => (
            <Skeleton key={i} width={cardWidth} height={cardHeight} borderRadius={16} />
          ))}
        </View>
      ) : (
        <FlatList
          key={`cat-grid-${numColumns}`}
          data={filteredCharacters}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          numColumns={numColumns}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={6}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{selectedTag ? 'No one with this tag yet' : 'No one here yet'}</Text>
              <Text style={styles.emptySubtitle}>New faces are on the way.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0614' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingBottom: 12 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  tagsBar: { flexGrow: 0, marginBottom: 6 },
  tagsScroll: { paddingHorizontal: GUTTER, gap: 8, paddingVertical: 4 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: { backgroundColor: 'rgba(168,85,247,0.22)', borderColor: '#A855F7' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#C9C2D9' },
  filterTextActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: GUTTER, paddingTop: 8, gap: GAP },
  row: { gap: GAP },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: GUTTER, paddingTop: 8 },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#160E25' },
  cardImage: { width: '100%', height: '100%' },
  cardBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  cardTagline: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.82)', marginTop: 3 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF' },
});
