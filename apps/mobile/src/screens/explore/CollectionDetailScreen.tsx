import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { typography } from '../../theme/typography.js';
import type { CollectionCharacterItem, CharacterCatalogItem } from '@ai-companion/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type CollectionRouteProp = RouteProp<RootStackParamList, 'CollectionDetail'>;

export const CollectionDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CollectionRouteProp>();
  const slug = route.params.collectionSlug;

  const { data: collection, isLoading, isError } = useQuery({
    queryKey: ['discovery', 'collection', slug],
    queryFn: () => DiscoveryApi.getCollectionBySlug(slug),
  });

  const handleOpenCharacter = (char: CharacterCatalogItem) => {
    navigation.navigate('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  const renderItem = ({ item }: { item: CollectionCharacterItem }) => {
    const char = item.character;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => handleOpenCharacter(char)}
      >
        <Image source={{ uri: char.avatarUrl }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {char.name}
            </Text>
            {item.customBadge && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>{item.customBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tagline} numberOfLines={2}>
            {item.highlightNote || char.tagline}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {char.categoryDisplayName || char.category}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading || !collection) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
        <Text style={styles.loadingText}>Loading collection...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Collection Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <View style={styles.heroContainer}>
        {collection.heroImageUrl && (
          <Image source={{ uri: collection.heroImageUrl }} style={styles.heroImage} />
        )}
        <View style={styles.heroOverlay}>
          <TouchableOpacity style={styles.backCircle} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            {collection.badgeText && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{collection.badgeText}</Text>
              </View>
            )}
            <Text style={styles.title}>{collection.title}</Text>
            <Text style={styles.subtitle}>{collection.subtitle || collection.description}</Text>
          </View>
        </View>
      </View>

      {/* Items List */}
      <FlatList
        data={collection.items || []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: spacing.sm,
  },
  errorTitle: {
    ...typography.h3,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: darkThemeColors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  backButtonText: {
    ...typography.button,
    color: darkThemeColors.textPrimary,
  },
  heroContainer: {
    height: 220,
    backgroundColor: darkThemeColors.surfaceElevated,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 13, 19, 0.75)',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: darkThemeColors.textPrimary,
    fontSize: 22,
  },
  headerInfo: {
    marginTop: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: darkThemeColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: darkThemeColors.accentText,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h2,
    color: darkThemeColors.textPrimary,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: 2,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: darkThemeColors.surface,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
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
  customBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: darkThemeColors.accent,
  },
  tagline: {
    ...typography.caption,
    color: darkThemeColors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
  },
  categoryBadge: {
    backgroundColor: darkThemeColors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: darkThemeColors.textSecondary,
    fontWeight: '500',
  },
});
