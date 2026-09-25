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
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Button,
  ModalDialog,
  ToastService,
  Skeleton,
  ErrorState,
  Icon,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { CharacterCatalogItem, ReportReasonCode } from '@ai-companion/types';
import { CharacterSocialBar } from '../../features/social/components/CharacterSocialBar.js';
import { Analytics } from '../../services/analytics/AnalyticsSDK.js';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type DetailRouteProp = RouteProp<RootStackParamList, 'CharacterDetail'>;

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
        message: `Meet ${profile.name} on AI Companion: ${profile.tagline}\ncompanion://character/${profile.slug}`,
      });
    } catch {
      // Ignore share cancel
    }
  };

  const handleStartChat = async (initialPrompt?: string) => {
    if (!profile) return;

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
        });
        return;
      }

      const conversation = await ConversationApi.createConversation(profile.id);
      navigation.navigate('Chat', {
        characterId: profile.id,
        conversationId: conversation.id,
        initialPrompt,
      });
    } catch {
      navigation.navigate('Chat', {
        characterId: profile.id,
        initialPrompt,
      });
    }
  };

  const handleStartVoice = () => {
    if (!profile) return;
    navigation.navigate('VoiceCall', {
      characterId: profile.id,
      characterName: profile.name,
      characterAvatarUrl: profile.avatarUrl,
    });
  };

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>('UNSAFE');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const handleSubmitReport = async () => {
    if (!profile) return;
    if (reportDetails.trim().length < 10) {
      Alert.alert('Details Required', 'Please provide at least 10 characters explaining your report.');
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
        message: 'Report submitted. Our team will review this character.',
        type: 'success',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit report.');
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
          title="Companion Not Found"
          message="This companion may have been updated or retired."
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Hero Header */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: profile.coverImageUrl || profile.avatarUrl }}
            style={styles.coverImage}
          />
          <View style={styles.heroGradientOverlay} />

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
              {profile.voiceAvailable && (
                <TouchableOpacity onPress={handleStartVoice} activeOpacity={0.8}>
                  <Badge
                    label="Voice Call"
                    icon={<Icon name="voice" size={12} color="#000000" />}
                    variant="voice"
                    size="md"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.bodyContent}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.tagline}>{profile.tagline}</Text>

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
          ) : (
            <View style={styles.creatorRow}>
              <Badge
                label="Official Platform Character"
                icon={<Icon name="sparkles" size={10} color={darkThemeColors.accent} />}
                variant="stage"
                size="sm"
              />
            </View>
          )}

          {/* Social: follow (distinct from favorite) + public posts; hidden if social is unavailable */}
          <CharacterSocialBar slug={profile.slug} />

          {/* Quick Info Bar */}
          <View style={styles.quickInfoBar}>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>VIBE</Text>
              <Text style={styles.quickInfoValue}>{profile.traits.humorStyle || 'Witty'}</Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>PACE</Text>
              <Text style={styles.quickInfoValue}>{profile.communication.pacing}</Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>LANGUAGE</Text>
              <Text style={styles.quickInfoValue}>
                {profile.communication.primaryLanguage.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Conversation Starters */}
          {profile.conversationStarters.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Try Starting With</Text>
              <View style={styles.startersWrap}>
                {profile.conversationStarters.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.starterPill}
                    activeOpacity={0.8}
                    onPress={() => handleStartChat(prompt)}
                  >
                    <Text style={styles.starterPromptText}>"{prompt}"</Text>
                    <Text style={styles.starterArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Personality Breakdown */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Personality & Traits</Text>
            <View style={styles.traitsCard}>
              <View style={styles.traitRow}>
                <Text style={styles.traitName}>Warmth</Text>
                <View style={styles.traitMeter}>
                  <View style={[styles.traitFill, { width: `${profile.traits.warmth}%` }]} />
                </View>
                <Text style={styles.traitValue}>{profile.traits.warmth}%</Text>
              </View>
              <View style={styles.traitRow}>
                <Text style={styles.traitName}>Playfulness</Text>
                <View style={styles.traitMeter}>
                  <View style={[styles.traitFill, { width: `${profile.traits.playfulness}%` }]} />
                </View>
                <Text style={styles.traitValue}>{profile.traits.playfulness}%</Text>
              </View>
              <View style={styles.traitRow}>
                <Text style={styles.traitName}>Curiosity</Text>
                <View style={styles.traitMeter}>
                  <View style={[styles.traitFill, { width: `${profile.traits.curiosity}%` }]} />
                </View>
                <Text style={styles.traitValue}>{profile.traits.curiosity}%</Text>
              </View>
            </View>
          </View>

          {/* About / Lore */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>About {profile.name.split(' ')[0]}</Text>
            <Text style={styles.descriptionText}>
              {profile.longDescription || profile.shortDescription}
            </Text>
          </View>

          {/* Tags */}
          {profile.tags.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.tagsContainer}>
                {profile.tags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{tag.displayName}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Similar Companions */}
          {profile.similarCharacters.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Similar Companions</Text>
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
                    <Avatar uri={sim.avatarUrl} name={sim.name} size="lg" />
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
        title="Report Character"
        description="Help keep our community safe. Select a reason and explain what happened:"
        primaryLabel="Submit Report"
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
          placeholder="Describe what went wrong (min 10 characters)..."
          placeholderTextColor={darkThemeColors.textMuted}
          multiline
          numberOfLines={4}
          value={reportDetails}
          onChangeText={setReportDetails}
        />
      </ModalDialog>

      {/* Primary Sticky Bottom CTA */}
      <View style={styles.bottomBar}>
        <Button
          label={
            profile.isLockedForUser
              ? 'Unlock Companion with PRO'
              : profile.existingConversationId
              ? `Continue Chat with ${profile.name.split(' ')[0]}`
              : `Start Conversation with ${profile.name.split(' ')[0]}`
          }
          variant={profile.isLockedForUser ? 'gold' : 'primary'}
          size="lg"
          fullWidth
          onPress={() => handleStartChat()}
        />
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
    ...StyleSheet.absoluteFillObject,
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
    fontSize: 14,
    lineHeight: 20,
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
  quickInfoBar: {
    flexDirection: 'row',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    alignItems: 'center',
  },
  quickInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickInfoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: darkThemeColors.textMuted,
    letterSpacing: 0.5,
  },
  quickInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  quickInfoDivider: {
    width: 1,
    height: 24,
    backgroundColor: darkThemeColors.borderSubtle,
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
    fontStyle: 'italic',
  },
  starterArrow: {
    color: darkThemeColors.accent,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  traitsCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    gap: spacing.md,
  },
  traitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  traitName: {
    fontSize: 12,
    color: darkThemeColors.textSecondary,
    width: 80,
    fontWeight: '500',
  },
  traitMeter: {
    flex: 1,
    height: 6,
    backgroundColor: darkThemeColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
  },
  traitFill: {
    height: '100%',
    backgroundColor: darkThemeColors.accent,
    borderRadius: 3,
  },
  traitValue: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    width: 35,
    textAlign: 'right',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: darkThemeColors.textSecondary,
  },
  tagsContainer: {
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
    backgroundColor: darkThemeColors.surface,
    borderTopWidth: 1,
    borderTopColor: darkThemeColors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
