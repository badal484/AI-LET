import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CreatorApi } from '../../services/api/creatorApi.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  CharacterCard,
  Skeleton,
  ErrorState,
  EmptyState,
  Icon,
} from '../../components/common/index.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type CreatorRouteProp = RouteProp<RootStackParamList, 'CreatorProfile'>;

export const CreatorProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreatorRouteProp>();
  const username = route.params?.username;
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['creator', 'profile', username],
    queryFn: () => CreatorApi.getPublicProfile(username),
    enabled: !!username,
  });

  const followMutation = useMutation({
    mutationFn: (follow: boolean) => CreatorApi.toggleFollow(username, follow),
    onSuccess: (result) => {
      queryClient.setQueryData(['creator', 'profile', username], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          isFollowing: result.isFollowing,
          totalFollowersCount: result.totalFollowers,
        };
      });
    },
  });

  const handleToggleFollow = () => {
    if (!profile) return;
    followMutation.mutate(!profile.isFollowing);
  };

  const handleOpenCharacter = (char: any) => {
    navigation.navigate('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton height={140} />
        <View style={{ padding: spacing.lg }}>
          <Skeleton.Avatar size={72} />
          <Skeleton.Line width="50%" height={22} style={{ marginTop: spacing.md }} />
          <Skeleton.Line width="30%" height={14} style={{ marginTop: 4 }} />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <ErrorState
          type="general"
          title="Creator Unavailable"
          message="This creator profile could not be found or is inactive."
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      {/* Banner */}
      <View style={styles.bannerContainer}>
        {profile.bannerUrl ? (
          <Image source={{ uri: profile.bannerUrl }} style={styles.bannerImage} />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        <IconButton
          icon="←"
          size="sm"
          variant="glass"
          onPress={navigation.goBack}
          accessibilityLabel="Back"
          style={styles.backButton}
        />
      </View>

      {/* Avatar & Follow Row */}
      <View style={styles.avatarRow}>
        <Avatar
          uri={profile.avatarUrl}
          name={profile.displayName}
          size="xl"
          style={styles.avatarBorder}
        />

        <Button
          label={profile.isFollowing ? 'Following' : '+ Follow'}
          variant={profile.isFollowing ? 'secondary' : 'primary'}
          size="sm"
          onPress={handleToggleFollow}
          isLoading={followMutation.isPending}
          accessibilityLabel={profile.isFollowing ? 'Unfollow creator' : 'Follow creator'}
        />
      </View>

      {/* Name, Handle, Badge */}
      <View style={styles.identitySection}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          {profile.verificationStatus === 'VERIFIED' && (
            <Badge
              label="Verified"
              icon={<Icon name="check" size={10} color="#000000" />}
              variant="verified"
              size="sm"
            />
          )}
          {profile.verificationStatus === 'PARTNER' && (
            <Badge
              label="Partner"
              icon={<Icon name="star" size={10} color="#000000" />}
              variant="partner"
              size="sm"
            />
          )}
        </View>
        <Text style={styles.username}>@{profile.username}</Text>

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile.publishedCharactersCount || profile.publishedCharacters?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Characters</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.totalFollowersCount || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Published Characters</Text>
    </View>
  );

  const renderCharacterCard = ({ item }: { item: any }) => (
    <CharacterCard
      character={item}
      variant="horizontal"
      onPress={handleOpenCharacter}
      style={styles.charCardSpacing}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={profile.publishedCharacters || []}
        keyExtractor={(item) => item.id}
        renderItem={renderCharacterCard}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="sparkles"
            title="No characters published"
            description="This creator has not published any public companions yet."
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  profileHeader: {
    marginBottom: spacing.md,
  },
  bannerContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: darkThemeColors.surfaceElevated,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xxl + spacing.xs,
    left: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginTop: -36,
  },
  avatarBorder: {
    borderWidth: 3,
    borderColor: darkThemeColors.background,
    borderRadius: 40,
  },
  identitySection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    color: darkThemeColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  username: {
    color: darkThemeColors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  bio: {
    color: darkThemeColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    color: darkThemeColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: darkThemeColors.borderSubtle,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: darkThemeColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  charCardSpacing: {
    marginHorizontal: spacing.lg,
  },
});
