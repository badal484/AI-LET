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
  useWindowDimensions,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DiscoveryApi } from '../../services/api/discoveryApi.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { ModerationApi } from '../../services/api/moderationApi.js';
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
import { GradientFill } from '../../components/common/GradientFill.js';
import { FallbackImage } from '../../components/common/FallbackImage.js';
import { thumb } from '../../utils/thumb.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const GALLERY_GAP = 8;

const REPORT_REASON_LABEL: Record<ReportReasonCode, string> = {
  UNSAFE: 'Unsafe',
  HARASSMENT: 'Harassment',
  IMPERSONATION: 'Pretends to be someone',
  COPYRIGHT: 'Copyright',
  SEXUAL_CONTENT: 'Sexual content',
  SPAM: 'Spam',
  OTHER: 'Something else',
} as Record<ReportReasonCode, string>;
type DetailRouteProp = RouteProp<RootStackParamList, 'CharacterDetail'>;

export const CharacterDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Three across inside the page's side padding.
  const galleryTile = Math.floor((screenWidth - spacing.lg * 2 - GALLERY_GAP * 2) / 3);

  const identifier = route.params.characterSlug || route.params.characterId;
  const { favoriteIds, toggleFavoriteOptimistic } = useDiscoveryStore();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['discovery', 'character', identifier],
    queryFn: () => DiscoveryApi.getCharacterProfile(identifier),
  });

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
        title: `${profile.name} on Loveek`,
        message: `Meet ${profile.name} on Loveek — ${profile.tagline}\nhttps://play.google.com/store/apps/details?id=com.aicompanionmobile`,
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
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([]);

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
          title="Profile not found"
          message="This profile may have been updated or removed."
          onRetry={() => navigation.goBack()}
          retryLabel="Go back"
        />
      </View>
    );
  }

  const aboutRaw = (profile.longDescription || profile.shortDescription || '').trim();
  const about = aboutRaw && aboutRaw !== profile.tagline?.trim() ? aboutRaw : '';
  const starters = profile.conversationStarters.slice(0, 2);
  const tags = profile.tags.slice(0, 4);
  const galleryImages: unknown = profile.galleryImages;
  const gallery = Array.isArray(galleryImages)
    ? galleryImages.filter((u): u is string => typeof u === 'string' && u.startsWith('http') && !brokenPhotos.includes(u)).slice(0, 12)
    : [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Hero Header */}
        <View style={styles.heroContainer}>
          <FallbackImage
            uris={[thumb(profile.coverImageUrl, 420), thumb(profile.avatarUrl, 420)]}
            name={profile.name}
            style={styles.coverImage}
            blurRadius={ageRestricted(profile) ? AGE_BLUR_RADIUS : 0}
            initialSize={72}
          />
          <View style={styles.heroGradientOverlay} />
          {ageRestricted(profile) && <AgeRestrictedBadge />}

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
              {/* Three tall photos per row, like a profile grid. Just to look at — no tap. */}
              <View style={styles.galleryGrid}>
                {gallery.map((imgUrl, idx) => (
                  <View key={imgUrl} style={[styles.galleryCard, { width: galleryTile, height: Math.round(galleryTile * 1.6) }]}>
                    <Image
                      source={{ uri: thumb(imgUrl, galleryTile) }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                      blurRadius={ageRestricted(profile) ? AGE_BLUR_RADIUS : 0}
                      onError={() => setBrokenPhotos((b) => [...b, imgUrl])}
                      accessibilityLabel={`Photo ${idx + 1} of ${profile.name}`}
                    />
                  </View>
                ))}
              </View>
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

      {/* Back / report / share / like: pinned below the status bar, above the scrolling page (inside the
          scroll view they sat under the status bar on tall-status-bar phones and taps never reached them). */}
      {/* A soft dark fade behind the buttons, so page text scrolling under them stays out of the way. */}
      <View style={[styles.topScrim, { height: insets.top + 72 }]} pointerEvents="none">
        <GradientFill vertical colors={[['#0B0D13', 1], ['#0B0D13', 0.94], ['#0B0D13', 0]]} />
      </View>
      <View style={[styles.topActionsRow, { top: insets.top + 8 }]} pointerEvents="box-none">
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
            accessibilityLabel={`Report ${profile.name}`}
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

      {/* Report Modal Dialog */}
      <ModalDialog
        visible={reportModalVisible}
        title={`Report ${profile.name}`}
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
                {REPORT_REASON_LABEL[reason]}
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
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9, elevation: 9 },
  topActionsRow: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
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
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP },
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
    borderRadius: 14,
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
