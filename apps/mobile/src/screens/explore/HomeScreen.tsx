import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { Skeleton, ErrorState } from '../../components/common/index.js';
import { activeSectionAt, chipLabelFor } from '../../utils/sectionSpy.js';
import type {
  CharacterCatalogItem,
  HomeFeedSection,
} from '@ai-companion/types';

const CARD_WIDTH = 148;
const CARD_HEIGHT = 210;
const SNAP_INTERVAL = CARD_WIDTH + 10;

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  // The chip for the section being read (null = "All"); follows the scroll, and a tap jumps there.
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const feedScrollRef = useRef<ScrollView>(null);
  const chipBarRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const chipX = useRef<Record<string, number>>({});
  // While a chip tap is scrolling the page, don't let the passing sections flicker the chips.
  const jumpingUntil = useRef(0);

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

  const handleOpenCategory = (categorySlug: string, categoryName?: string) => {
    navigation.navigate('CategoryBrowser', {
      categorySlug,
      categoryName: categoryName || categorySlug,
    });
  };

  const handleOpenWallet = () => {
    navigation.navigate('CreditWallet');
  };

  // Every category row, in order (the chips mirror these).
  const sections = useMemo(() => {
    if (!homeFeed?.sections) return [];
    return homeFeed.sections.filter(
      (section: HomeFeedSection) =>
        section.sectionKey !== 'CATEGORIES' && section.sectionKey !== 'CONTINUE' && (section.items?.length ?? 0) > 0,
    );
  }, [homeFeed]);

  const chips = useMemo(
    () => [{ id: null as string | null, label: 'All' }, ...sections.map((section: HomeFeedSection) => ({ id: section.id, label: chipLabelFor(section) }))],
    [sections],
  );

  // Keep the active chip visible in the chip bar.
  useEffect(() => {
    const x = chipX.current[activeSectionId ?? 'all'];
    if (x !== undefined) chipBarRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [activeSectionId]);

  const handleFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Date.now() < jumpingUntil.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    // Only the true end of the page counts as "the last row" (the short last row never reaches the top).
    const atEnd = y > 20 && y + layoutMeasurement.height >= contentSize.height - 48;
    const next = activeSectionAt(
      Object.entries(sectionY.current).map(([id, top]) => ({ id, y: top })),
      y,
      80,
      atEnd,
    );
    const resolved = y < 20 ? null : next;
    if (resolved !== activeSectionId) setActiveSectionId(resolved);
  };

  const handleChipPress = (id: string | null) => {
    setActiveSectionId(id);
    jumpingUntil.current = Date.now() + 700;
    const y = id ? Math.max(0, (sectionY.current[id] ?? 0) - 8) : 0;
    feedScrollRef.current?.scrollTo({ y, animated: true });
  };

  if (isLoading && !homeFeed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.logoText}>Lovira</Text>
          <View style={styles.walletPill}>
            <Text style={styles.coinText}>🪙 0</Text>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Skeleton.Card height={22} style={{ width: 140, borderRadius: 6, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton.Card height={CARD_HEIGHT} style={{ width: CARD_WIDTH, borderRadius: 16 }} />
              <Skeleton.Card height={CARD_HEIGHT} style={{ width: CARD_WIDTH, borderRadius: 16 }} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (isError && !homeFeed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <ErrorState
          type="network"
          title="Unable to load feed"
          message="Please check your connection."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Simple Clean Header */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Text style={styles.logoLo}>Lo</Text>
          <Text style={styles.logoVira}>vira</Text>
        </View>

        <TouchableOpacity
          style={styles.walletPill}
          activeOpacity={0.8}
          onPress={handleOpenWallet}
        >
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinBalance}>0</Text>
          <Text style={styles.coinPlus}>+</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Simple Clean Filter Chips */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          ref={chipBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {chips.map((chip) => {
            const isSelected = activeSectionId === chip.id;
            return (
              <TouchableOpacity
                key={chip.id ?? 'all'}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.75}
                onLayout={(e) => {
                  chipX.current[chip.id ?? 'all'] = e.nativeEvent.layout.x;
                }}
                onPress={() => handleChipPress(chip.id)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Feed with Clean Horizontal Rows */}
      <ScrollView
        ref={feedScrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleFeedScroll}
        // Re-check where the page came to rest: the last throttled scroll event can arrive just
        // before the very bottom, which left the previous row's chip highlighted.
        onMomentumScrollEnd={handleFeedScroll}
        onScrollEndDrag={handleFeedScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#E02494"
          />
        }
      >
        {sections.map((section: HomeFeedSection) => (
          <View
            key={section.id}
            onLayout={(e) => {
              sectionY.current[section.id] = e.nativeEvent.layout.y;
            }}
          >
            {renderSection(section, handleOpenCharacter, handleOpenCategory)}
          </View>
        ))}

        {sections.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No companions found</Text>
            <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Clean Minimalist Section Renderer
// ---------------------------------------------------------------------------

function renderSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onOpenCategory: (slug: string, name?: string) => void,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  const categorySlug = (section.id || '').replace('section_cat_', '');
  const title = section.title || 'Companions';

  return (
    <View key={section.id} style={styles.sectionContainer}>
      {/* Clean Header */}
      <TouchableOpacity
        style={styles.sectionHeaderRow}
        activeOpacity={0.75}
        onPress={() => onOpenCategory(categorySlug, section.title)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.seeAllText}>See all ›</Text>
      </TouchableOpacity>

      {/* Horizontal Clean Snappy Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        contentContainerStyle={styles.carouselScrollContent}
      >
        {items.map((char) => {
          const subtitle = char.archetype || char.occupation || 'Companion';

          return (
            <TouchableOpacity
              key={char.id}
              style={styles.cardContainer}
              activeOpacity={0.88}
              onPress={() => onOpen(char)}
            >
              {/* Full Bleed Image */}
              <Image
                source={{ uri: char.coverImageUrl || char.avatarUrl }}
                style={styles.cardImage}
                resizeMode="cover"
              />

              {/* Bottom Gradient Overlay with Name & Info */}
              <View style={styles.cardBottomOverlay}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {char.name}
                  </Text>
                  <View style={styles.onlineDot} />
                </View>

                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Clean, Minimalist Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0614',
  },
  // Top Header Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  logoLo: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FF6584',
    letterSpacing: -0.3,
  },
  logoVira: {
    fontSize: 24,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: -0.3,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#170E25',
    borderWidth: 1,
    borderColor: '#2D1A45',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  coinIcon: {
    fontSize: 14,
  },
  coinText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coinBalance: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  coinPlus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 1,
  },

  // Filter Chips
  filterBarContainer: {
    paddingVertical: 8,
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    height: 34,
    backgroundColor: '#160D26',
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#24143D',
  },
  filterChipActive: {
    backgroundColor: '#E02494',
    borderColor: '#E02494',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Section
  sectionContainer: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C084FC',
  },

  // Carousel Cards
  carouselScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#160E25',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 24,
    backgroundColor: 'rgba(10, 4, 18, 0.78)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#D1D5DB',
    marginTop: 2,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
