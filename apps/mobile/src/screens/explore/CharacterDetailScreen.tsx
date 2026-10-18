import { AGE_BLUR_RADIUS, AgeRestrictedBadge, ageRestricted, explainAgeRestricted } from '../../components/common/AgeRestricted.js';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Share,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { ModerationApi } from '../../services/api/moderationApi.js';
import { RelationshipApi } from '../../services/api/relationshipApi.js';
import { useDiscoveryStore } from '../../stores/discoveryStore.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  Avatar,
  Badge,
  IconButton,
  ModalDialog,
  ToastService,
  Skeleton,
  ErrorState,
  Icon,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { CharacterCatalogItem, ReportReasonCode } from '@ai-companion/types';
import { Analytics } from '../../services/analytics/AnalyticsSDK.js';
import { AppAlert } from '../../components/common/AppDialog.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type DetailRouteProp = RouteProp<RootStackParamList, 'CharacterDetail'>;

// How close you two are, in words a person would use (not "Lvl 1 · 22% Intimacy").
const getStageDetails = (stage?: string) => {
  switch (stage) {
    case 'ACQUAINTANCE':
      return { label: 'Getting comfortable', icon: '💬', description: 'The awkward part is over — you two talk easily now.' };
    case 'FRIEND':
      return { label: 'Friends', icon: '🌟', description: 'Real trust. You can tell each other almost anything.' };
    case 'CLOSE_FRIEND':
      return { label: 'Close', icon: '✨', description: 'They know your world, and you know theirs.' };
    case 'CONFIDANT':
      return { label: 'Your person', icon: '💫', description: 'The one you go to first — on good days and bad.' };
    case 'ROMANTIC_PARTNER':
      return { label: 'Together', icon: '💖', description: 'Something special between you two.' };
    default:
      return { label: 'Just getting started', icon: '🌱', description: 'You two are just getting to know each other.' };
  }
};

export const CharacterDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const queryClient = useQueryClient();

  const identifier = route.params.characterSlug || route.params.characterId;
  const { favoriteIds, toggleFavoriteOptimistic } = useDiscoveryStore();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['discovery', 'character', identifier],
    queryFn: () => DiscoveryApi.getCharacterProfile(identifier),
  });

  const { data: relationshipData } = useQuery({
    queryKey: ['relationship', profile?.id],
    queryFn: () => (profile?.id ? RelationshipApi.getRelationship(profile.id) : null),
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  });
  const closeness = relationshipData
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (relationshipData.familiarity + relationshipData.trust + relationshipData.comfort + relationshipData.affection + relationshipData.engagement) / 5,
          ),
        ),
      )
    : 0;

  // One view per character page open (feeds creator analytics).
  const viewedCharacterId = profile?.id;
  useEffect(() => {
    if (viewedCharacterId) Analytics.trackCharacterViewed(viewedCharacterId);
  }, [viewedCharacterId]);

  const isFavorited = profile?.id
    ? favoriteIds.has(profile.id) || profile.isFavorite
    : false;

  const favoriteMutation = useMutation({
    mutationFn: ({ charId, fav }: { charId: string; fav: boolean }) =>
      DiscoveryApi.toggleFavorite(charId, fav),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery', 'favorites'] });
    },
  });

  const handleToggleFavorite = () => {
    if (!profile?.id) return;
    const nextState = toggleFavoriteOptimistic(profile.id);
    favoriteMutation.mutate({ charId: profile.id, fav: nextState });
    ToastService.show({
      message: nextState ? 'Added to favorites' : 'Removed from favorites',
      type: 'info',
      duration: 1500,
    });
  };

  const handleShare = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: `Chat with ${profile.name}`,
        message: `Meet ${profile.name} on Loveek: ${profile.tagline}\ncompanion://character/${profile.slug}`,
      });
    } catch {
      // Ignore share cancel
    }
  };

  const handleStartChat = async (initialPrompt?: string) => {
    if (!profile) return;
    // Romance character and they're under 18: no chat (the server refuses it too).
    if (ageRestricted(profile)) {
      explainAgeRestricted(profile.name);
      return;
    }

    if (profile.isLockedForUser) {
      navigation.navigate('Paywall', { feature: 'premium_characters' });
      return;
    }

    try {
      if (profile.existingConversationId) {
        navigation.navigate('Chat', {
          characterId: profile.id,
          conversationId: profile.existingConversationId,
          initialPrompt,
          characterName: profile.name,
          characterAvatarUrl: profile.avatarUrl,
          characterSlug: profile.slug,
        });
        return;
      }

      const conversation = await ConversationApi.createConversation(profile.id);
      navigation.navigate('Chat', {
        characterId: profile.id,
        conversationId: conversation.id,
        initialPrompt,
        characterName: profile.name,
        characterAvatarUrl: profile.avatarUrl,
        characterSlug: profile.slug,
      });
    } catch {
      navigation.navigate('Chat', {
        characterId: profile.id,
        initialPrompt,
        characterName: profile.name,
        characterAvatarUrl: profile.avatarUrl,
        characterSlug: profile.slug,
      });
    }
  };

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>('UNSAFE');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleSubmitReport = async () => {
    if (!profile) return;
    if (reportDetails.trim().length < 10) {
      AppAlert.alert('A little more detail', 'Please write at least 10 characters about what happened.');
      return;
    }

    try {
      setReportSubmitting(true);
      await ModerationApi.submitReport({
        characterId: profile.id,
        reasonCode: reportReason,
        details: reportDetails,
      });
      setReportModalVisible(false);
      setReportDetails('');
      ToastService.show({
        message: 'Thanks — our team will look into it.',
        type: 'success',
      });
    } catch (err: any) {
      AppAlert.alert('Couldn’t send the report', err.message || 'Please try again in a moment.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleOpenSimilar = (char: CharacterCatalogItem) => {
    navigation.push('CharacterDetail', {
      characterId: char.id,
      characterSlug: char.slug,
    });
  };

  if (isLoading || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.heroContainer}>
          <Skeleton height={280} />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Skeleton.Line width="60%" height={26} style={{ marginBottom: spacing.sm }} />
          <Skeleton.Line width="90%" height={16} style={{ marginBottom: spacing.md }} />
          <Skeleton.Card height={120} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <ErrorState
          type="general"
          title="Character not found"
          message="This character may have been updated or removed."
          onRetry={() => navigation.goBack()}
          retryLabel="Go back"
        />
      </View>
    );
  }

  const stage = getStageDetails(relationshipData?.stage);
  const aboutRaw = (profile.longDescription || profile.shortDescription || '').trim();
  const about = aboutRaw && aboutRaw !== profile.tagline?.trim() ? aboutRaw : '';
  const starters = profile.conversationStarters.slice(0, 2);
  const tags = profile.tags.slice(0, 4);
  const galleryImages: unknown = (profile as any)?.discoveryConfig?.localizedProfiles?.galleryImages;
  const gallery = Array.isArray(galleryImages)
    ? galleryImages.filter((u): u is string => typeof u === 'string' && u.startsWith('http')).slice(0, 6)
    : [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Hero Header */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: profile.coverImageUrl || profile.avatarUrl }}
            style={styles.coverImage}
            blurRadius={ageRestricted(profile) ? AGE_BLUR_RADIUS : 0}
          />
          <View style={styles.heroGradientOverlay} />
          {ageRestricted(profile) && <AgeRestrictedBadge />}

          {/* Navigation Bar Actions */}
          <View style={styles.topActionsRow}>
            <IconButton
              icon="arrow-left"
              size="md"
              variant="glass"
              onPress={navigation.goBack}
              accessibilityLabel="Back"
            />
            <View style={styles.topRightActions}>
              <IconButton
                icon="flag"
                size="md"
                variant="glass"
                onPress={() => setReportModalVisible(true)}
                accessibilityLabel="Report character"
              />
              <IconButton
                icon="share"
                size="md"
                variant="glass"
                onPress={handleShare}
                accessibilityLabel="Share character"
              />
              <IconButton
                icon={isFavorited ? 'heart-filled' : 'heart'}
                size="md"
                variant="glass"
                onPress={handleToggleFavorite}
                accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                style={isFavorited ? styles.favoritedBtn : undefined}
              />
            </View>
          </View>

          {/* Avatar and Identity */}
          <View style={styles.avatarSection}>
            <Avatar
              uri={profile.avatarUrl}
              name={profile.name}
              size="huge"
              style={styles.avatarBorder}
            />
            <View style={styles.identityBadges}>
              <Badge label={profile.categoryDisplayName || profile.category} variant="category" size="md" />
            </View>
          </View>
        </View>

        {/* Content Body: who they are, how to start, their photos — nothing else. */}
        <View style={styles.bodyContent}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.tagline ? <Text style={styles.tagline}>{profile.tagline}</Text> : null}

          {/* How close you two are: a small chip, only once you've talked. */}
          {relationshipData && profile.existingConversationId ? (
            <View style={styles.connectionChip} accessibilityLabel={`${stage.label}, closeness ${closeness} out of 100`}>
              <Text style={styles.connectionChipText}>
                {stage.icon} {stage.label}
              </Text>
              <View style={styles.closenessTrack}>
                <View style={[styles.closenessFill, { width: `${Math.max(6, closeness)}%` }]} />
              </View>
            </View>
          ) : null}

          {/* Creator Attribution */}
          {profile.creator ? (
            <TouchableOpacity
              style={styles.creatorRow}
              onPress={() =>
                navigation.navigate('CreatorProfile', { username: profile.creator!.username })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.creatorLabel}>Created by</Text>
              <Text style={styles.creatorName}>@{profile.creator.username}</Text>
              {profile.creator.isVerified && (
                <Badge
                  label="Verified"
                  icon={<Icon name="check" size={10} color="#000000" />}
                  variant="verified"
                  size="sm"
                />
              )}
            </TouchableOpacity>
          ) : null}

          {/* About: three lines, the rest on tap. */}
          {about ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>About</Text>
              <Text style={styles.descriptionText} numberOfLines={aboutOpen ? undefined : 3}>
                {about}
              </Text>
              {about.length > 140 ? (
                <TouchableOpacity onPress={() => setAboutOpen((o) => !o)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.moreText}>{aboutOpen ? 'Less' : 'More'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Two ways to say hi. */}
          {starters.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Say hi</Text>
              <View style={styles.startersWrap}>
                {starters.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.starterPill}
                    activeOpacity={0.8}
                    onPress={() => handleStartChat(prompt)}
                  >
                    <Text style={styles.starterPromptText} numberOfLines={2}>{prompt}</Text>
                    <Icon name="arrow-right" size={16} color={darkThemeColors.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Their own photos only — never stock fillers. */}
          {gallery.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                {gallery.map((imgUrl, idx) => (
                  <View key={idx} style={styles.galleryCard}>
                    <Image
                      source={{ uri: imgUrl }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                      blurRadius={ageRestricted(profile) ? AGE_BLUR_RADIUS : 0}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag.displayName}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Similar Companions */}
          {profile.similarCharacters.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>You might also like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarScroll}
              >
                {profile.similarCharacters.map((sim) => (
                  <TouchableOpacity
                    key={sim.id}
                    style={styles.similarCard}
                    activeOpacity={0.8}
                    onPress={() => handleOpenSimilar(sim)}
                  >
                    <Avatar
                      uri={sim.avatarUrl}
                      name={sim.name}
                      size="lg"
                      blurRadius={ageRestricted(sim) ? AGE_BLUR_RADIUS : 0}
                    />
                    <Text style={styles.similarName} numberOfLines={1}>
                      {sim.name}
                    </Text>
                    <Text style={styles.similarCategory} numberOfLines={1}>
                      {sim.categoryDisplayName || sim.category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Report Modal Dialog */}
      <ModalDialog
        visible={reportModalVisible}
        title="Report character"
        description="Pick a reason and tell us what happened."
        primaryLabel="Send report"
        primaryVariant="danger"
        isPrimaryLoading={reportSubmitting}
        onPrimaryAction={handleSubmitReport}
        onClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reasonPicker}>
          {(
            ['UNSAFE', 'HARASSMENT', 'IMPERSONATION', 'COPYRIGHT', 'SEXUAL_CONTENT', 'SPAM', 'OTHER'] as ReportReasonCode[]
          ).map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.reasonChip, reportReason === reason && styles.reasonChipActive]}
              onPress={() => setReportReason(reason)}
            >
              <Text style={[styles.reasonChipText, reportReason === reason && styles.reasonChipTextActive]}>
                {reason.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.modalTextInput}
          placeholder="What went wrong? (at least 10 characters)"
          placeholderTextColor={darkThemeColors.textMuted}
          multiline
          numberOfLines={4}
          value={reportDetails}
          onChangeText={setReportDetails}
        />
      </ModalDialog>

      {/* Primary Sticky Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.startChattingBtn}
          onPress={() => handleStartChat()}
          activeOpacity={0.88}
        >
          <Text style={styles.startChattingBtnText}>
            {ageRestricted(profile)
              ? '18+ only'
              : profile.isLockedForUser
              ? 'Unlock with Premium'
              : profile.existingConversationId
              ? 'Continue chat'
              : 'Start chat'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 280,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 13, 19, 0.45)',
  },
  topActionsRow: {
    position: 'absolute',
    top: spacing.xxl + spacing.xs,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  favoritedBtn: {
    borderColor: '#EF4444',
  },
  avatarSection: {
    position: 'absolute',
    bottom: -40,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  avatarBorder: {
    borderWidth: 3,
    borderColor: darkThemeColors.background,
    borderRadius: 52,
  },
  identityBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  bodyContent: {
    marginTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 21,
    color: darkThemeColors.textMuted,
    marginTop: spacing.xs,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 6,
  },
  creatorLabel: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
  },
  creatorName: {
    fontSize: 12,
    color: darkThemeColors.accent,
    fontWeight: '700',
  },
  sectionBlock: {
    marginTop: spacing.xl,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.sm,
  },
  startersWrap: {
    gap: spacing.sm,
  },
  starterPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  starterPromptText: {
    fontSize: 13,
    lineHeight: 18,
    color: darkThemeColors.textSecondary,
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 21,
    color: darkThemeColors.textSecondary,
  },
  moreText: { marginTop: 6, fontSize: 13, fontWeight: '700', color: darkThemeColors.accent },
  connectionChip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.32)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectionChipText: { fontSize: 12, fontWeight: '700', color: '#E9D5FF' },
  closenessTrack: { width: 56, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  closenessFill: { height: 4, borderRadius: 2, backgroundColor: '#C084FC' },
  galleryRow: { gap: 10 },
  tagsContainer: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    backgroundColor: darkThemeColors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  tagChipText: {
    fontSize: 11,
    color: darkThemeColors.textMuted,
  },
  similarScroll: {
    gap: spacing.md,
  },
  similarCard: {
    width: 80,
    alignItems: 'center',
  },
  similarName: {
    fontSize: 12,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  similarCategory: {
    fontSize: 10,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
  },
  reasonPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: darkThemeColors.surface,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  reasonChipActive: {
    backgroundColor: darkThemeColors.accentMuted,
    borderColor: darkThemeColors.accent,
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkThemeColors.textSecondary,
  },
  reasonChipTextActive: {
    color: darkThemeColors.accent,
  },
  modalTextInput: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: darkThemeColors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B0713',
    borderTopWidth: 1,
    borderTopColor: '#1F142E',
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 28,
  },
  startChattingBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startChattingBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  galleryCard: {
    width: 130,
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#160E26',
    borderWidth: 1,
    borderColor: '#26173E',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
});
