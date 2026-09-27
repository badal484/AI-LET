import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { Skeleton, ErrorState } from '../../components/common/index.js';
import type {
  CharacterCatalogItem,
  HomeFeedSection,
} from '@ai-companion/types';

const CAROUSEL_CARD_WIDTH = 160;
const SNAP_INTERVAL = CAROUSEL_CARD_WIDTH + 12; // Card width + gap

type NavigationProp = StackNavigationProp<RootStackParamList>;

const ENGAGEMENT_MAP: Record<string, string> = {
  'dr-ananya': '3.4L',
  'joel': '2.2L',
  'anjali': '12.8L',
  'tanu': '8.5L',
  'sakshi': '5.1L',
  'sangeeta': '3.2L',
  'aman': '5.2L',
  'raj': '3.8L',
  'neha': '3.6L',
  'nancy': '3.1L',
  'renu': '5.4L',
  'kavya': '4.2L',
  'gita-gpt': '2.9L',
  'krishna': '2.5L',
  'indira': '4.0L',
  'keerthana': '3.4L',
  'luna': '15.2L',
  'ritika-sharma': '9.8L',
  'natasha': '6.4L',
  'sandeep-chaudhary': '4.7L',
  'jiya-singhal': '7.1L',
  'simran-kaur': '5.9L',
};

const CATEGORY_THEME: Record<string, { badgeBg: string; border: string; icon: string }> = {
  love: { badgeBg: '#3D0A24', border: '#FF2E74', icon: '❤️' },
  friendship: { badgeBg: '#0F2338', border: '#38BDF8', icon: '🤝' },
  astrology: { badgeBg: '#260D38', border: '#C084FC', icon: '🔮' },
  health: { badgeBg: '#092C23', border: '#34D399', icon: '🧘' },
  coaching: { badgeBg: '#381C09', border: '#FB923C', icon: '🎯' },
  'learn-earn': { badgeBg: '#382E09', border: '#FACC15', icon: '🪙' },
  neighbours: { badgeBg: '#281335', border: '#E879F9', icon: '👥' },
  wisdom: { badgeBg: '#131B38', border: '#818CF8', icon: '🌌' },
};

interface FilterChipDef {
  slug: string | null;
  label: string;
  icon: string;
}

const FILTER_CHIPS: FilterChipDef[] = [
  { slug: null, label: 'All', icon: '✨' },
  { slug: 'love', label: 'Love', icon: '❤️' },
  { slug: 'friendship', label: 'Friends', icon: '🤝' },
  { slug: 'astrology', label: 'Astrology', icon: '🔮' },
  { slug: 'health', label: 'Health', icon: '🧘' },
  { slug: 'learn-earn', label: 'Learn & Earn', icon: '🪙' },
  { slug: 'coaching', label: 'Coaching', icon: '🎯' },
  { slug: 'neighbours', label: 'Neighbours', icon: '👥' },
];

const getSafeFirstName = (name?: string): string => {
  if (!name || typeof name !== 'string') return 'AI';
  const parts = name.trim().split(' ');
  return parts[0] || 'AI';
};

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const handleSelectChip = (slug: string | null) => {
    setSelectedCategory(slug);
  };

  // Filter sections by selected category chip
  const sections = useMemo(() => {
    if (!homeFeed?.sections) return [];
    return homeFeed.sections.filter((section: HomeFeedSection) => {
      if (section.sectionKey === 'CATEGORIES' || section.sectionKey === 'CONTINUE') return false;
      if (!selectedCategory) return true;
      const secId = section.id || '';
      const secKey = section.sectionKey || '';
      return (
        secId.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        secKey.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    });
  }, [homeFeed, selectedCategory]);

  // Extract top characters across sections for Top "Online Now" avatars and Featured Spotlight
  const allCharacters = useMemo(() => {
    if (!homeFeed?.sections) return [];
    const list: CharacterCatalogItem[] = [];
    const seen = new Set<string>();
    for (const sec of homeFeed.sections) {
      if (sec.sectionKey === 'CATEGORIES' || sec.sectionKey === 'CONTINUE') continue;
      if (sec.items && Array.isArray(sec.items)) {
        for (const it of sec.items) {
          if (it && it.id && it.name && !seen.has(it.id)) {
            seen.add(it.id);
            list.push(it as CharacterCatalogItem);
          }
        }
      }
    }
    return list;
  }, [homeFeed]);

  // Featured Spotlight companion (Top romantic/popular pick or first character)
  const featuredHero = useMemo(() => {
    if (allCharacters.length === 0) return null;
    return (
      allCharacters.find((c) => c.slug === 'ritika-sharma' || c.slug === 'anjali' || c.slug === 'sakshi') ||
      allCharacters[0]
    );
  }, [allCharacters]);

  // Online Avatars (first 9 unique companions)
  const onlineAvatars = useMemo(() => {
    return allCharacters.slice(0, 9);
  }, [allCharacters]);

  if (isLoading && !homeFeed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={styles.heartBadgeContainer}>
              <Text style={styles.heartIcon}>💖</Text>
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI</Text>
              </View>
            </View>
            <View style={styles.wordmarkRow}>
              <Text style={styles.logoLo}>Lo</Text>
              <Text style={styles.logoVira}>vira</Text>
            </View>
          </View>
          <View style={styles.walletPill}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinBalance}>0</Text>
            <View style={styles.coinPlusBtn}>
              <Text style={styles.coinPlusText}>+</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Skeleton Hero Spotlight */}
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <Skeleton.Card height={200} style={{ borderRadius: 22 }} />
          </View>
          {/* Skeleton Carousel Rows */}
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Skeleton.Card height={24} style={{ width: 160, borderRadius: 8, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton.Card height={260} style={{ width: 160, borderRadius: 18 }} />
              <Skeleton.Card height={260} style={{ width: 160, borderRadius: 18 }} />
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
          title="Unable to load Lovira feed"
          message="Please check your connection and reload."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Top Header Bar: Logo & Wallet */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          {/* Glowing Heart AI Icon */}
          <View style={styles.heartBadgeContainer}>
            <Text style={styles.heartIcon}>💖</Text>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>AI</Text>
            </View>
          </View>

          {/* Lovira Wordmark */}
          <View style={styles.wordmarkRow}>
            <Text style={styles.logoLo}>Lo</Text>
            <Text style={styles.logoVira}>vira</Text>
          </View>
        </View>

        {/* Right Wallet Pill */}
        <TouchableOpacity
          style={styles.walletPill}
          activeOpacity={0.8}
          onPress={handleOpenWallet}
          accessibilityRole="button"
          accessibilityLabel="Wallet, 0 coins"
        >
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinBalance}>0</Text>
          <View style={styles.coinPlusBtn}>
            <Text style={styles.coinPlusText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Horizontal Category Filter Chips Bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {FILTER_CHIPS.map((chip, index) => {
            const isSelected = selectedCategory === chip.slug;
            return (
              <TouchableOpacity
                key={chip.slug || `all-${index}`}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.75}
                onPress={() => handleSelectChip(chip.slug)}
              >
                <Text style={styles.chipEmoji}>{chip.icon}</Text>
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Main Feed ScrollView */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#E02494"
          />
        }
      >
        {/* 3A. Online Live Companions Quick Row (Stories Style) */}
        {onlineAvatars.length > 0 && (
          <View style={styles.onlineSectionWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.onlineScrollContent}
            >
              {onlineAvatars.map((item) => (
                <TouchableOpacity
                  key={`online-${item.id}`}
                  style={styles.onlineAvatarItem}
                  activeOpacity={0.8}
                  onPress={() => handleOpenCharacter(item)}
                >
                  <View style={styles.avatarRingGradient}>
                    <Image
                      source={{ uri: item.avatarUrl || item.coverImageUrl }}
                      style={styles.onlineAvatarImg}
                    />
                    <View style={styles.pulseLiveDot} />
                  </View>
                  <Text style={styles.onlineAvatarName} numberOfLines={1}>
                    {getSafeFirstName(item.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 3B. Top Hero Spotlight Showcase Banner */}
        {featuredHero && !selectedCategory && (
          <View style={styles.heroSectionWrap}>
            <TouchableOpacity
              style={styles.heroSpotlightCard}
              activeOpacity={0.9}
              onPress={() => handleOpenCharacter(featuredHero)}
            >
              {/* Left Details Info */}
              <View style={styles.heroLeftContent}>
                <View style={styles.heroHeaderPillRow}>
                  <View style={styles.heroBadgePill}>
                    <Text style={styles.heroBadgeFlame}>🔥</Text>
                    <Text style={styles.heroBadgeText}>TOP MATCH</Text>
                  </View>
                  <View style={styles.heroLiveStatusPill}>
                    <View style={styles.heroLiveGreenDot} />
                    <Text style={styles.heroLiveStatusText}>Online</Text>
                  </View>
                </View>

                <Text style={styles.heroName} numberOfLines={1}>
                  {featuredHero.name || 'Featured Companion'}
                </Text>

                <Text style={styles.heroTagline} numberOfLines={2}>
                  {featuredHero.tagline || featuredHero.shortDescription || 'Your caring companion'}
                </Text>

                {/* Direct Action CTA Button */}
                <View style={styles.heroCtaRow}>
                  <View style={styles.heroCtaBtn}>
                    <Text style={styles.heroCtaIcon}>💬</Text>
                    <Text style={styles.heroCtaText}>Chat Now</Text>
                  </View>
                  <Text style={styles.heroFreePill}>✨ Instant Reply</Text>
                </View>
              </View>

              {/* Right Hero Image Portrait */}
              <View style={styles.heroImageFrame}>
                <Image
                  source={{ uri: featuredHero.coverImageUrl || featuredHero.avatarUrl }}
                  style={styles.heroPortraitImage}
                  resizeMode="cover"
                />
                <View style={styles.heroImageGradientScrim} />
                <View style={styles.heroChatCountTag}>
                  <Text style={styles.heroChatCountText}>
                    💬 {ENGAGEMENT_MAP[featuredHero.slug] || '12L'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 3C. Horizontal Right-Scrolling Category Carousels */}
        {sections.map((section: HomeFeedSection) => {
          return renderCategoryCarouselSection(section, handleOpenCharacter, handleOpenCategory);
        })}

        {sections.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>No Companions Found</Text>
            <Text style={styles.emptySubtitle}>Try selecting 'All' or pull down to refresh</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Section Renderers: Horizontal Carousel with Snappy Physics & Rich Visuals
// ---------------------------------------------------------------------------

function renderCategoryCarouselSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onOpenCategory: (slug: string, name?: string) => void,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  const categorySlug = (section.id || '').replace('section_cat_', '');
  const theme = CATEGORY_THEME[categorySlug] || {
    badgeBg: '#221133',
    border: '#A855F7',
    icon: '✨',
  };

  // Clean title & icon safely
  const rawTitle = section.title || 'Category';
  const titleParts = rawTitle.split(' ');
  const rawIcon = titleParts[0];
  const titleText = titleParts.slice(1).join(' ') || rawTitle;
  const icon = theme.icon || rawIcon || '✨';

  return (
    <View key={section.id} style={styles.sectionContainer}>
      {/* Section Header Bar */}
      <TouchableOpacity
        style={styles.sectionHeaderRow}
        activeOpacity={0.75}
        onPress={() => onOpenCategory(categorySlug, section.title)}
      >
        <View style={styles.sectionTitleLeft}>
          <View style={[styles.categoryCircleBadge, { backgroundColor: theme.badgeBg, borderColor: theme.border }]}>
            <Text style={styles.categoryCircleIcon}>{icon}</Text>
          </View>
          <View>
            <Text style={styles.sectionTitle}>{titleText}</Text>
            <Text style={styles.sectionSubCount}>{items.length} companions available</Text>
          </View>
        </View>

        {/* See All Interactive Glass Pill */}
        <View style={styles.seeAllPill}>
          <Text style={styles.seeAllText}>Explore</Text>
          <Text style={styles.seeAllArrow}>➔</Text>
        </View>
      </TouchableOpacity>

      {/* Horizontal Right-Scrolling Carousel with Snappy Swiping */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        contentContainerStyle={styles.carouselScrollContent}
      >
        {items.map((char) => {
          const engagement = (char.slug && ENGAGEMENT_MAP[char.slug]) || `${((char.age || 21) * 0.18).toFixed(1)}L`;
          const isNew = char.highlightBadges?.includes('New') || char.slug === 'sakshi';
          const isHot = char.slug === 'ritika-sharma' || char.slug === 'anjali' || char.slug === 'tanu';
          const tags = (char.tags || []).map((t) => (typeof t === 'string' ? t : t.displayName || t.name));
          const archetypeSubtitle = char.archetype || char.occupation || 'AI Companion';

          return (
            <TouchableOpacity
              key={char.id}
              style={styles.cardContainer}
              activeOpacity={0.88}
              onPress={() => onOpen(char)}
            >
              {/* Top Portrait Image Frame */}
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: char.coverImageUrl || char.avatarUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />

                {/* Bottom Shadow Gradient Scrim */}
                <View style={styles.cardImageScrim} />

                {/* Top-Left Smart Badge */}
                {isHot ? (
                  <View style={styles.hotBadge}>
                    <Text style={styles.hotBadgeText}>🔥 HOT</Text>
                  </View>
                ) : isNew ? (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>✨ NEW</Text>
                  </View>
                ) : (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>💖 LOVE</Text>
                  </View>
                )}

                {/* Top-Right Live Pulse Status */}
                <View style={styles.cardLivePill}>
                  <View style={styles.cardLiveDot} />
                  <Text style={styles.cardLiveText}>Online</Text>
                </View>

                {/* Bottom-Left Engagement Pill */}
                <View style={styles.engagementPill}>
                  <Text style={styles.engagementChatIcon}>💬</Text>
                  <Text style={styles.engagementCountText}>{engagement}</Text>
                </View>
              </View>

              {/* Character Details Box */}
              <View style={styles.detailsContainer}>
                <Text style={styles.characterName} numberOfLines={1}>
                  {char.name}
                </Text>

                {/* Character Archetype Subtitle */}
                <Text style={styles.archetypeText} numberOfLines={1}>
                  {archetypeSubtitle}
                </Text>

                {/* Trait Tags Row */}
                {tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {tags.slice(0, 2).map((tagName, idx) => (
                      <View key={idx} style={styles.tagChip}>
                        <Text style={styles.tagChipText} numberOfLines={1}>
                          {tagName}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet: Ultra-Modern Obsidian Dark Aesthetics
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090510', // Deep obsidian background
  },
  // Top Header Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#090510',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 7,
  },
  heartIcon: {
    fontSize: 22,
  },
  aiTag: {
    backgroundColor: '#E02494',
    borderRadius: 6,
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    marginLeft: -7,
    marginTop: -10,
    borderWidth: 1,
    borderColor: '#FFA6D6',
  },
  aiTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoLo: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FF5E8E',
    letterSpacing: -0.4,
  },
  logoVira: {
    fontSize: 25,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: -0.4,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#170E25',
    borderWidth: 1.2,
    borderColor: '#301C4E',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  coinIcon: {
    fontSize: 15,
  },
  coinBalance: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  coinPlusBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  coinPlusText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: -1,
  },

  // Filter Chips Bar
  filterBarContainer: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#170D26',
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    backgroundColor: '#130C1E',
    borderWidth: 1.2,
    borderColor: '#26163A',
    borderRadius: 19,
    paddingHorizontal: 13,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#280B2D',
    borderColor: '#E02494',
    borderWidth: 1.6,
    shadowColor: '#E02494',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  chipEmoji: {
    fontSize: 13.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A79CB7',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Main ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // 3A. Online Stories Row
  onlineSectionWrap: {
    marginTop: 12,
    marginBottom: 4,
  },
  onlineScrollContent: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'center',
  },
  onlineAvatarItem: {
    alignItems: 'center',
    width: 62,
  },
  avatarRingGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2.2,
    backgroundColor: '#E02494',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#FF70BA',
  },
  onlineAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  pulseLiveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#090510',
  },
  onlineAvatarName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D1D5DB',
    marginTop: 5,
    textAlign: 'center',
  },

  // 3B. Hero Spotlight Card
  heroSectionWrap: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  heroSpotlightCard: {
    flexDirection: 'row',
    backgroundColor: '#170E28',
    borderRadius: 22,
    borderWidth: 1.4,
    borderColor: '#391D5C',
    overflow: 'hidden',
    height: 180,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  heroLeftContent: {
    flex: 1.2,
    padding: 14,
    justifyContent: 'space-between',
  },
  heroHeaderPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E02494',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  heroBadgeFlame: {
    fontSize: 10,
  },
  heroBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroLiveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  heroLiveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  heroLiveStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#34D399',
  },
  heroName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  heroTagline: {
    fontSize: 12,
    lineHeight: 16,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  heroCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E02494',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    shadowColor: '#E02494',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  heroCtaIcon: {
    fontSize: 12,
  },
  heroCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroFreePill: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  heroImageFrame: {
    flex: 0.95,
    position: 'relative',
    height: '100%',
    backgroundColor: '#201035',
  },
  heroPortraitImage: {
    width: '100%',
    height: '100%',
  },
  heroImageGradientScrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 25,
    backgroundColor: '#170E28',
    opacity: 0.65,
  },
  heroChatCountTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroChatCountText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // 3C. Section Styling
  sectionContainer: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryCircleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCircleIcon: {
    fontSize: 17,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubCount: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#8B7C9E',
    marginTop: 1,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0E2B',
    borderWidth: 1,
    borderColor: '#361E58',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C084FC',
  },
  seeAllArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C084FC',
  },

  // Carousel Cards
  carouselScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardContainer: {
    width: CAROUSEL_CARD_WIDTH,
    backgroundColor: '#120A1E',
    borderRadius: 18,
    borderWidth: 1.3,
    borderColor: '#26153E',
    overflow: 'hidden',
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A0F2B',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(9, 5, 16, 0.65)',
  },
  hotBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  hotBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E02494',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cardLivePill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  cardLiveText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  engagementPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    gap: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  engagementChatIcon: {
    fontSize: 10,
  },
  engagementCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailsContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  characterName: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  archetypeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#C4B5FD',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  tagChip: {
    backgroundColor: '#1C102E',
    borderWidth: 1,
    borderColor: '#2E1A4A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  tagChipText: {
    fontSize: 10.5,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
