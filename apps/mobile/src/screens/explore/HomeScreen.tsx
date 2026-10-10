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
import { getCategoryOrbImage } from '../../utils/categoryIcons.js';
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
    const list = homeFeed.sections.filter(
      (section: HomeFeedSection) =>
        section.sectionKey !== 'CATEGORIES' && section.sectionKey !== 'CONTINUE' && (section.items?.length ?? 0) > 0,
    );
    const ORDER: Record<string, number> = {
      love: 1,
      astrology: 2,
      'learn-earn': 3,
      friendship: 4,
      health: 5,
      coaching: 6,
      wisdom: 7,
      professionals: 8,
      neighbours: 9,
    };
    return list.sort((a, b) => {
      const slugA = (a.id || '').replace('section_cat_', '').toLowerCase();
      const slugB = (b.id || '').replace('section_cat_', '').toLowerCase();
      const orderA = ORDER[slugA] ?? 99;
      const orderB = ORDER[slugB] ?? 99;
      return orderA - orderB;
    });
  }, [homeFeed]);

  const chips = useMemo(
    () => [{ id: null as string | null, label: 'All' }, ...sections.map((section: HomeFeedSection) => ({ id: section.id, label: chipLabelFor(section) }))],
    [sections],
  );

  // Keep the active chip visible in the chip bar.
  useEffect(() => {
    const key = activeSectionId ?? 'all';
    const x = chipX.current[key];
    if (x !== undefined) {
      const isLast = key === chips[chips.length - 1]?.id;
      if (isLast) {
        chipBarRef.current?.scrollToEnd({ animated: true });
      } else {
        chipBarRef.current?.scrollTo({ x: Math.max(0, x - 30), animated: true });
      }
    }
  }, [activeSectionId, chips]);

  const handleFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Date.now() < jumpingUntil.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    // Only the true end of the page counts as "the last row" (a loose margin lit up Neighbours while
    // Professionals was still being read, and switching back and forth made the chips flicker).
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
            const orbImage = getCategoryOrbImage(chip.id);
            return (
              <TouchableOpacity
                key={chip.id ?? 'all'}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.8}
                onLayout={(e) => {
                  chipX.current[chip.id ?? 'all'] = e.nativeEvent.layout.x;
                }}
                onPress={() => handleChipPress(chip.id)}
              >
                <View style={[styles.orbImageContainer, isSelected && styles.orbImageContainerActive]}>
                  <Image source={orbImage} style={styles.orbImage} resizeMode="cover" />
                </View>
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

function getCharacterHashtags(char: CharacterCatalogItem): string[] {
  const name = (char.name || '').toLowerCase();
  const cat = (char.category || '').toLowerCase();
  const tagline = (char.tagline || '').toLowerCase();
  const archetype = (char.archetype || '').toLowerCase();
  const occupation = (char.occupation || '').toLowerCase();

  // Explicit companion mappings
  if (name.includes('simran')) return ['#dating', '#coach'];
  if (name.includes('aarav')) return ['#boyfriend', '#love'];
  if (name.includes('ritika')) return ['#possessive', '#romance'];
  if (name.includes('maya')) return ['#psychology', '#empathy'];
  if (name.includes('ananya')) return ['#wellness', '#guidance'];
  if (name.includes('priya')) return ['#friendship', '#romance'];
  if (name.includes('muskan')) return ['#companion', '#love'];
  if (name.includes('meera')) return ['#mentor', '#wisdom'];
  if (name.includes('joel')) return ['#fitness', '#coach'];
  if (name.includes('natasha')) return ['#gym', '#partner'];
  if (name.includes('shreya')) return ['#instagram', '#reels'];
  if (name.includes('sakshi')) return ['#astrology', '#tarot'];
  if (name.includes('rohan')) return ['#freelancing', '#upwork'];
  if (name.includes('arjun')) return ['#career', '#resume'];
  if (name.includes('dev')) return ['#coding', '#AI'];
  if (name.includes('jiya')) return ['#english', '#fluency'];
  if (name.includes('aditya')) return ['#business', '#startup'];
  if (name.includes('raj')) return ['#wealth', '#trading'];
  if (name.includes('sandeep')) return ['#life', '#wisdom'];

  if (char.tags && char.tags.length > 0) {
    const list = char.tags
      .slice(0, 2)
      .map((t) => {
        let raw = (t.displayName || t.slug || t.name).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (raw.length > 9) raw = raw.substring(0, 9);
        return `#${raw}`;
      })
      .filter(Boolean);
    if (list.length > 0) return list;
  }

  if (cat.includes('love') || tagline.includes('boyfriend') || tagline.includes('girlfriend') || tagline.includes('partner') || archetype.includes('romantic')) {
    if (tagline.includes('boyfriend') || archetype.includes('boyfriend')) return ['#boyfriend', '#love'];
    if (tagline.includes('girlfriend') || archetype.includes('girlfriend')) return ['#girlfriend', '#love'];
    return ['#love', '#romance'];
  }

  if (cat.includes('astro') || tagline.includes('astro') || tagline.includes('tarot') || tagline.includes('vedic')) {
    return ['#astrology', '#tarot'];
  }

  if (cat.includes('learn') || cat.includes('earn') || cat.includes('coaching') || cat.includes('business')) {
    if (tagline.includes('dating') || tagline.includes('attraction')) return ['#dating', '#coach'];
    if (tagline.includes('code') || tagline.includes('developer') || occupation.includes('engineer')) return ['#coding', '#AI'];
    if (tagline.includes('design') || tagline.includes('freelance')) return ['#freelancing', '#design'];
    if (tagline.includes('business') || tagline.includes('startup')) return ['#business', '#startup'];
    return ['#learning', '#growth'];
  }

  if (cat.includes('friend')) return ['#friendship', '#chat'];
  if (cat.includes('health') || cat.includes('wellness')) return ['#fitness', '#health'];
  if (cat.includes('wisdom') || cat.includes('mentor')) return ['#mentor', '#guidance'];

  const words = `${archetype} ${occupation} ${tagline}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && w !== 'companion' && w !== 'partner' && w !== 'from');

  if (words.length >= 2) {
    return [`#${words[0].substring(0, 9)}`, `#${words[1].substring(0, 9)}`];
  } else if (words.length === 1) {
    return [`#${words[0].substring(0, 9)}`, '#ai'];
  }

  return ['#love', '#ai'];
}

function renderSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onOpenCategory: (slug: string, name?: string) => void,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  const categorySlug = (section.id || '').replace('section_cat_', '');
  const orbImage = getCategoryOrbImage(categorySlug);
  const rawTitle = section.title || 'Companions';
  const cleanTitle = rawTitle
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Emoji_Component}|\p{Emoji}/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .trim();

  return (
    <View key={section.id} style={styles.sectionContainer}>
      {/* Clean Header with 3D Orb Icon */}
      <TouchableOpacity
        style={styles.sectionHeaderRow}
        activeOpacity={0.75}
        onPress={() => onOpenCategory(categorySlug, section.title)}
      >
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionOrbContainer}>
            <Image source={orbImage} style={styles.sectionOrbImage} resizeMode="cover" />
          </View>
          <Text style={styles.sectionTitle}>{cleanTitle}</Text>
        </View>
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
          const hashtags = getCharacterHashtags(char);

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

              {/* Bottom Gradient Overlay with Name & Hashtag Pills */}
              <View style={styles.cardBottomOverlay}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {char.name}
                  </Text>
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.tagRow}>
                  {hashtags.map((tag, idx) => (
                    <View key={idx} style={styles.hashtagPill}>
                      <Text style={styles.cardHashtag} numberOfLines={1} ellipsizeMode="tail">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
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
    paddingVertical: 6,
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    height: 42,
    backgroundColor: '#0F0918',
    borderRadius: 14,
    paddingLeft: 7,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#292136',
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: '#180B26',
    borderColor: '#E639B5',
    borderWidth: 2,
  },
  orbImageContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  orbImageContainerActive: {
    borderWidth: 0,
  },
  orbImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }],
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionOrbContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  sectionOrbImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }],
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
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
    marginTop: 4,
  },
  hashtagPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    maxWidth: 62,
    flexShrink: 1,
  },
  cardHashtag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F3E8FF',
    letterSpacing: -0.1,
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
