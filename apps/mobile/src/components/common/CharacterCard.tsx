import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { Badge } from './Badge.js';
import { Avatar } from './Avatar.js';
import { Icon } from './Icon.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { CharacterCatalogItem } from '@ai-companion/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface CharacterCardProps {
  character: CharacterCatalogItem;
  variant?: 'grid' | 'horizontal' | 'compact' | 'featured';
  onPress: (character: CharacterCatalogItem) => void;
  onFavoriteToggle?: (character: CharacterCatalogItem) => void;
  isFavorited?: boolean;
  style?: ViewStyle;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  variant = 'grid',
  onPress,
  onFavoriteToggle,
  isFavorited = false,
  style,
}) => {
  const isPro = character.accessType !== 'free';

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, style]}
        activeOpacity={0.8}
        onPress={() => onPress(character)}
        accessibilityRole="button"
        accessibilityLabel={`${character.name}, ${character.categoryDisplayName || character.category}`}
      >
        <Avatar
          uri={character.avatarUrl}
          name={character.name}
          size="lg"
          presence={character.voiceAvailable ? 'online' : undefined}
        />
        <Text style={styles.compactName} numberOfLines={1}>
          {character.name}
        </Text>
        <Text style={styles.compactCategory} numberOfLines={1}>
          {character.categoryDisplayName || character.category}
        </Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={[styles.horizontalContainer, style]}
        activeOpacity={0.85}
        onPress={() => onPress(character)}
        accessibilityRole="button"
        accessibilityLabel={`${character.name}: ${character.tagline}`}
      >
        <Avatar uri={character.avatarUrl} name={character.name} size="md" />
        <View style={styles.horizontalInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.horizontalName} numberOfLines={1}>
              {character.name}
            </Text>
            {isPro && <Badge label="PRO" variant="pro" size="sm" />}
          </View>
          <Text style={styles.horizontalTagline} numberOfLines={2}>
            {character.tagline}
          </Text>
          <View style={styles.tagRow}>
            <Badge
              label={character.categoryDisplayName || character.category}
              variant="category"
              size="sm"
            />
            {character.voiceAvailable && (
              <Badge
                label="Voice"
                variant="voice"
                size="sm"
                icon={<Icon name="voice" size={10} color={darkThemeColors.voiceActive} />}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'featured') {
    return (
      <TouchableOpacity
        style={[styles.featuredContainer, style]}
        activeOpacity={0.9}
        onPress={() => onPress(character)}
        accessibilityRole="button"
        accessibilityLabel={`Featured companion ${character.name}: ${character.tagline}`}
      >
        <Image
          source={{ uri: character.coverImageUrl || character.avatarUrl }}
          style={styles.featuredImage}
        />
        <View style={styles.featuredOverlay}>
          <View style={styles.featuredHeaderRow}>
            <Badge label="FEATURED COMPANION" variant="stage" size="sm" />
            {onFavoriteToggle && (
              <TouchableOpacity
                onPress={() => onFavoriteToggle(character)}
                style={styles.favoriteButton}
                accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Icon
                  name={isFavorited ? 'heart-filled' : 'heart'}
                  size={18}
                  color={isFavorited ? '#ef4444' : '#ffffff'}
                />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.featuredName}>{character.name}</Text>
          <Text style={styles.featuredTagline} numberOfLines={2}>
            {character.tagline}
          </Text>

          <View style={styles.featuredFooter}>
            <Text style={styles.featuredCategory}>
              {character.categoryDisplayName || character.category}
            </Text>
            <View style={styles.connectButton}>
              <Text style={styles.connectButtonText}>
                Meet {character.name.split(' ')[0]} →
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Default: Grid Card
  return (
    <TouchableOpacity
      style={[styles.gridContainer, style]}
      activeOpacity={0.85}
      onPress={() => onPress(character)}
      accessibilityRole="button"
      accessibilityLabel={`${character.name}, ${character.tagline}`}
    >
      <Image
        source={{ uri: character.coverImageUrl || character.avatarUrl }}
        style={styles.gridImage}
      />

      {character.recommendationReason && (
        <View style={styles.reasonBadge}>
          <Text style={styles.reasonBadgeText} numberOfLines={1}>
            {character.recommendationReason}
          </Text>
        </View>
      )}

      {onFavoriteToggle && (
        <TouchableOpacity
          onPress={() => onFavoriteToggle(character)}
          style={styles.gridFavoriteButton}
          accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Icon
            name={isFavorited ? 'heart-filled' : 'heart'}
            size={18}
            color={isFavorited ? '#ef4444' : '#ffffff'}
          />
        </TouchableOpacity>
      )}

      <View style={styles.gridOverlay}>
        <View style={styles.nameRow}>
          <Text style={styles.gridName} numberOfLines={1}>
            {character.name}
          </Text>
          {isPro && <Badge label="PRO" variant="pro" size="sm" />}
        </View>

        <Text style={styles.gridTagline} numberOfLines={2}>
          {character.tagline}
        </Text>

        <View style={styles.tagRow}>
          <Badge
            label={character.categoryDisplayName || character.category}
            variant="category"
            size="sm"
          />
          {character.voiceAvailable && (
            <Badge
              label="Voice"
              variant="voice"
              size="sm"
              icon={<Icon name="voice" size={10} color={darkThemeColors.voiceActive} />}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Compact
  compactContainer: {
    alignItems: 'center',
    width: 80,
    marginRight: spacing.md,
  },
  compactName: {
    fontSize: 12,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  compactCategory: {
    fontSize: 10,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
  },

  // Horizontal
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.md,
  },
  horizontalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  horizontalName: {
    fontSize: 15,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    flex: 1,
  },
  horizontalTagline: {
    fontSize: 12,
    lineHeight: 16,
    color: darkThemeColors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },

  // Grid
  gridContainer: {
    width: SCREEN_WIDTH * 0.56,
    height: 270,
    borderRadius: radius.lg + 2,
    overflow: 'hidden',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  reasonBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: 48,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  reasonBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: darkThemeColors.accent,
  },
  gridFavoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(11, 13, 19, 0.92)',
  },
  gridName: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    flex: 1,
  },
  gridTagline: {
    fontSize: 12,
    lineHeight: 16,
    color: darkThemeColors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },

  // Featured
  featuredContainer: {
    marginHorizontal: spacing.lg,
    height: 250,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(11, 13, 19, 0.8)',
  },
  featuredHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featuredName: {
    fontSize: 22,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
  },
  featuredTagline: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: darkThemeColors.textMuted,
    textTransform: 'uppercase',
  },
  connectButton: {
    backgroundColor: darkThemeColors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  connectButtonText: {
    color: darkThemeColors.accentText,
    fontSize: 12,
    fontWeight: '700',
  },

  // Common
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    color: darkThemeColors.textPrimary,
    fontSize: 18,
  },
  favoritedIcon: {
    color: '#EF4444',
  },
});
