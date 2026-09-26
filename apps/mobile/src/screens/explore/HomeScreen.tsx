import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 1.36;

type NavigationProp = StackNavigationProp<RootStackParamList>;

const ENGAGEMENT_MAP: Record<string, string> = {
  'dr-ananya': '3L',
  'joel': '2.2L',
  'anjali': '12L',
  'tanu': '8L',
  'sakshi': '4.1L',
  'sangeeta': '3L',
  'aman': '5.2L',
  'raj': '3.8L',
  'neha': '3.3L',
  'nancy': '3.1L',
  'renu': '5.4L',
  'kavya': '4.2L',
  'gita-gpt': '2.9L',
  'krishna': '2.5L',
  'indira': '4L',
  'keerthana': '3.4L',
  'luna': '15L',
};

interface FilterChipDef {
  slug: string;
  label: string;
  icon: string;
}

const FILTER_CHIPS: FilterChipDef[] = [
  { slug: 'health', label: 'Health', icon: '🧘' },
  { slug: 'love', label: 'Love', icon: '❤️' },
  { slug: 'astrology', label: 'Astrology', icon: '🔮' },
  { slug: 'learn-earn', label: 'Learn & Earn', icon: '🪙' },
  { slug: 'professionals', label: 'Professionals', icon: '💼' },
  { slug: 'neighbours', label: 'Neighbours', icon: '👥' },
  { slug: 'wisdom', label: 'Wisdom', icon: '🌌' },
  { slug: 'friendship', label: 'Friends', icon: '🫂' },
];

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

  const handleSelectChip = (slug: string) => {
    if (selectedCategory === slug) {
      setSelectedCategory(null); // toggle off to show all
    } else {
      setSelectedCategory(slug);
    }
  };

  // Filter sections by selected category chip
  const sections = useMemo(() => {
    if (!homeFeed?.sections) return [];
    return homeFeed.sections.filter((section: HomeFeedSection) => {
      if (section.sectionKey === 'CATEGORIES' || section.sectionKey === 'CONTINUE') return false;
      if (!selectedCategory) return true;
      return (
        section.id.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        section.sectionKey.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    });
  }, [homeFeed, selectedCategory]);

  if (isLoading && !homeFeed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={styles.heartAiBadge}>
              <Text style={styles.heartAiText}>Ai</Text>
            </View>
            <Text style={styles.logoLovira}>Lovira</Text>
          </View>
          <View style={styles.walletPill}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinBalance}>0</Text>
            <Text style={styles.coinPlus}>+</Text>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 18 }}>
            <Skeleton.Card height={280} style={{ flex: 1, borderRadius: 18 }} />
            <Skeleton.Card height={280} style={{ flex: 1, borderRadius: 18 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 18 }}>
            <Skeleton.Card height={280} style={{ flex: 1, borderRadius: 18 }} />
            <Skeleton.Card height={280} style={{ flex: 1, borderRadius: 18 }} />
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
          {/* Glowing Heart Ai Icon */}
          <View style={styles.heartBadgeContainer}>
            <Text style={styles.heartIcon}>💖</Text>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>Ai</Text>
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
          <Text style={styles.coinPlus}>+</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Horizontal Category Filter Chips Bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {FILTER_CHIPS.map((chip) => {
            const isSelected = selectedCategory === chip.slug;
            return (
              <TouchableOpacity
                key={chip.slug}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.8}
                onPress={() => handleSelectChip(chip.slug)}
              >
                <View style={styles.chipIconBadge}>
                  <Text style={styles.chipIconText}>{chip.icon}</Text>
                </View>
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Feed ScrollView */}
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
        {/* Render 2-Column Category Grid Sections */}
        {sections.map((section: HomeFeedSection) => {
          return renderCategoryGridSection(section, handleOpenCharacter, handleOpenCategory);
        })}

        {sections.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>No Companions Available</Text>
            <Text style={styles.emptySubtitle}>Explore back soon or pull down to refresh</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Section Renderers
// ---------------------------------------------------------------------------

function renderCategoryGridSection(
  section: HomeFeedSection,
  onOpen: (char: CharacterCatalogItem) => void,
  onOpenCategory: (slug: string, name?: string) => void,
) {
  const items: CharacterCatalogItem[] = section.items || [];
  if (items.length === 0) return null;

  const categorySlug = section.id.replace('section_cat_', '');

  // Extract icon and title cleanly
  const titleParts = section.title.split(' ');
  const icon = titleParts[0];
  const titleText = titleParts.slice(1).join(' ') || section.title;

  return (
    <View key={section.id} style={styles.sectionContainer}>
      {/* Category Section Header */}
      <TouchableOpacity
        style={styles.sectionHeaderRow}
        activeOpacity={0.75}
        onPress={() => onOpenCategory(categorySlug, section.title)}
      >
        <View style={styles.sectionTitleLeft}>
          <View style={styles.categoryCircleBadge}>
            <Text style={styles.categoryCircleIcon}>{icon}</Text>
          </View>
          <Text style={styles.sectionTitle}>{titleText}</Text>
        </View>
        <Text style={styles.sectionArrow}>→</Text>
      </TouchableOpacity>

      {/* 2-Column Grid */}
      <View style={styles.gridContainer}>
        {items.map((char) => {
          const engagement = ENGAGEMENT_MAP[char.slug] || `${(char.age * 0.15).toFixed(1)}L`;
          const isNew = char.highlightBadges?.includes('New') || char.slug === 'sakshi';
          const tags = (char.tags || []).map((t) => (typeof t === 'string' ? t : t.displayName || t.name));

          return (
            <TouchableOpacity
              key={char.id}
              style={styles.cardContainer}
              activeOpacity={0.88}
              onPress={() => onOpen(char)}
            >
              {/* Card Portrait Image */}
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: char.coverImageUrl || char.avatarUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />

                {/* Top-left "New" Badge */}
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}

                {/* Bottom-left Engagement Pill */}
                <View style={styles.engagementPill}>
                  <Text style={styles.engagementChatIcon}>💬</Text>
                  <Text style={styles.engagementCountText}>{engagement}</Text>
                </View>
              </View>

              {/* Character Details Inside Card */}
              <View style={styles.detailsContainer}>
                <Text style={styles.characterName} numberOfLines={1}>
                  {char.name}
                </Text>

                {/* Tags Row */}
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
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0612',
  },
  // Top Header Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0A0612',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  heartIcon: {
    fontSize: 22,
  },
  aiTag: {
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: -6,
    marginTop: -8,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heartAiBadge: {
    backgroundColor: '#F43F5E',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  heartAiText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoLo: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FF6584', // Coral / Pink
    letterSpacing: -0.4,
  },
  logoVira: {
    fontSize: 25,
    fontWeight: '900',
    color: '#C084FC', // Violet / Purple
    letterSpacing: -0.4,
  },
  logoLovira: {
    fontSize: 25,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: -0.4,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#160E22',
    borderWidth: 1.2,
    borderColor: '#2B1C3D',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  coinIcon: {
    fontSize: 15,
  },
  coinBalance: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  coinPlus: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 2,
  },
  // Filter Bar
  filterBarContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#160D24',
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#12091D',
    borderWidth: 1.2,
    borderColor: '#231733',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: '#1C0B29',
    borderColor: '#E02494',
    borderWidth: 1.8,
    shadowColor: '#E02494',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  chipIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F1330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipIconText: {
    fontSize: 13,
  },
  filterChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#9E96AD',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Section
  sectionContainer: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryCircleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A0E2B',
    borderWidth: 1.2,
    borderColor: '#2D1B48',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryCircleIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionArrow: {
    fontSize: 19,
    fontWeight: '700',
    color: '#B392F0',
  },
  // 2-Column Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: '#120C1E',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#221535',
    overflow: 'hidden',
    paddingBottom: 12,
    marginBottom: 6,
  },
  imageContainer: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1128',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  newBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  engagementPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    gap: 4,
  },
  engagementChatIcon: {
    fontSize: 10,
  },
  engagementCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  characterName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F9FAFB',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#1A1129',
    borderWidth: 1,
    borderColor: '#2C1C44',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11.5,
    color: '#9CA3AF',
    fontWeight: '600',
  },
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
