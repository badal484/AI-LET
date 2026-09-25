import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput as RNTextInput, View, type ViewToken } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialCommentView, SocialFeedTab, SocialSharePreview } from '@ai-companion/types';
import type { RootStackParamList } from '../../../navigation/types.js';
import { ConversationApi } from '../../../services/api/conversationApi.js';
import { Banner, Button, EmptyState, ErrorState, Icon, IconButton, ScreenContainer, Skeleton } from '../../../components/common/index.js';
import { darkThemeColors as c, MAX_FONT_SIZE_MULTIPLIER, radius, spacing, typography } from '../../../theme/index.js';
import { SocialApi } from '../api/socialApi.js';
import { useSocialT } from '../i18n/strings.js';
import { socialKeys, useComments, useSharedContent, useSocialFeed } from '../hooks/useSocial.js';
import { SocialDraftStorage, useSocialUiStore } from '../state/socialClientState.js';
import { AttributionLabel, ContentCard, ReportSheet, UserRow, socialStyles } from '../components/SocialComponents.js';

type Nav = StackNavigationProp<RootStackParamList>;

// ═══════════════════════════════════════════════════════════════════════════
// Feed — finite, paginated, diversity-ranked; "Following" is chronological.
// ═══════════════════════════════════════════════════════════════════════════

export const SocialFeedScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<SocialFeedTab>('FOLLOWING');
  const feed = useSocialFeed(tab);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const degraded = feed.data?.pages.some((p) => p.degraded) ?? false;
  const seen = useRef(new Set<string>());

  // Impressions feed fatigue (never a permanent preference).
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const fresh = viewableItems
      .map((v) => ({ id: (v.item as (typeof items)[number]).content.publicId, position: v.index ?? 0 }))
      .filter((v) => !seen.current.has(v.id));
    fresh.forEach((v) => seen.current.add(v.id));
    if (fresh.length) SocialApi.impressions(fresh.map((f) => ({ contentId: f.id, position: f.position })));
  }).current;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['FOLLOWING', 'FOR_YOU'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>
              {k === 'FOLLOWING' ? t('social.feed.following') : t('social.feed.forYou')}
            </Text>
          </Pressable>
        ))}
      </View>
      {degraded ? <Banner type="info" message={t('social.feed.degraded')} /> : null}
      {feed.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={120} />)}
        </View>
      ) : feed.isError ? (
        <ErrorState message={t('social.error.generic')} onRetry={() => feed.refetch()} retryLabel={t('social.retry')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.content.publicId}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 800 }}
          renderItem={({ item }) => (
            <ContentCard
              item={item.content}
              reason={tab === 'FOR_YOU' ? item.reason : undefined}
              onOpen={() => nav.navigate('SocialContent', { publicId: item.content.publicId })}
              onOpenAuthor={() => item.content.author && nav.navigate('SocialProfile', { handle: item.content.author.username ?? item.content.author.publicId })}
              onFeedFeedback={() => qc.invalidateQueries({ queryKey: socialKeys.feed(tab) })}
            />
          )}
          ListEmptyComponent={<EmptyState title={t('social.feed.empty')} />}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshing={feed.isRefetching}
          onRefresh={() => feed.refetch()}
        />
      )}
    </ScreenContainer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Shared content / post detail (deep-link target: /share/:id and /p/:id)
// ═══════════════════════════════════════════════════════════════════════════

const CommentItem: React.FC<{ comment: SocialCommentView; onReply: () => void; onDelete: () => void; onReport: () => void }> = ({ comment, onReply, onDelete, onReport }) => {
  const t = useSocialT();
  return (
    <View style={[styles.comment, comment.parentId && styles.reply]}>
      {comment.author ? <UserRow user={comment.author} /> : comment.character ? <Text style={styles.body}>{comment.character.name}</Text> : null}
      {comment.attribution === 'AI_GENERATED' ? <AttributionLabel attribution="AI_GENERATED" /> : null}
      <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{comment.body ?? t('social.unavailable')}</Text>
      {comment.status === 'PENDING_MODERATION' ? <Text style={socialStyles.muted}>{t('social.comment.pending')}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
        {!comment.parentId ? <Pressable onPress={onReply} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>{t('social.comment.reply')}</Text></Pressable> : null}
        {comment.isOwner ? (
          <Pressable onPress={onDelete} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>{t('social.comment.delete')}</Text></Pressable>
        ) : (
          <Pressable onPress={onReport} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>{t('social.report')}</Text></Pressable>
        )}
      </View>
    </View>
  );
};

export const SocialContentScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const { publicId } = useRoute<RouteProp<RootStackParamList, 'SocialContent'>>().params;
  const content = useSharedContent(publicId);
  const comments = useComments(publicId);
  const { replyTo, setReplyTo } = useSocialUiStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const draftId = `comment:${publicId}`;

  useEffect(() => {
    SocialDraftStorage.load(draftId).then((d) => d && setText(d));
  }, [draftId]);
  useEffect(() => {
    const h = setTimeout(() => SocialDraftStorage.save(draftId, text), 400);
    return () => clearTimeout(h);
  }, [draftId, text]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await SocialApi.comment(publicId, text.trim(), replyTo?.commentId);
      setText('');
      setReplyTo(null);
      await SocialDraftStorage.clear(draftId);
      qc.invalidateQueries({ queryKey: socialKeys.comments(publicId) });
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      Alert.alert(t('social.comments'), msg ?? t('social.error.generic'));
    } finally {
      setSending(false);
    }
  };

  // Graceful fallback for deleted / revoked / expired / blocked content.
  if (content.isError) {
    return (
      <ScreenContainer>
        <EmptyState title={t('social.unavailable')} actionLabel={t('social.feed.following')} onAction={() => nav.goBack()} />
      </ScreenContainer>
    );
  }
  if (!content.data) return <ScreenContainer><Skeleton height={200} /></ScreenContainer>;
  const item = content.data;
  const allComments = comments.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        {item.isOwner && item.kind !== 'CREATOR_POST' ? (
          <Button
            label={t('social.share.revoke')}
            variant="outline"
            size="sm"
            onPress={() =>
              Alert.alert(t('social.share.revoke'), t('social.share.external'), [
                { text: t('social.cancel'), style: 'cancel' },
                { text: t('social.confirm'), style: 'destructive', onPress: async () => { await SocialApi.revoke(publicId); nav.goBack(); } },
              ])
            }
          />
        ) : null}
      </View>
      <FlatList
        data={allComments}
        keyExtractor={(cm) => cm.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <>
            <ContentCard item={item} onOpen={() => undefined} onOpenAuthor={() => item.author && nav.navigate('SocialProfile', { handle: item.author.username ?? item.author.publicId })} />
            {item.character ? (
              <Button label={`${t('social.startChat')} · ${item.character.name}`} fullWidth onPress={() => nav.navigate('CharacterDetail', { characterId: item.character!.slug, characterSlug: item.character!.slug })} />
            ) : null}
            <Text style={[socialStyles.sectionTitle, { marginTop: spacing.lg }]}>{t('social.comments')}</Text>
          </>
        }
        renderItem={({ item: cm }) => (
          <CommentItem
            comment={cm}
            onReply={() => setReplyTo({ commentId: cm.id, authorName: cm.author?.displayName ?? '' })}
            onDelete={async () => { await SocialApi.deleteComment(cm.id); qc.invalidateQueries({ queryKey: socialKeys.comments(publicId) }); }}
            onReport={() => setReportId(cm.id)}
          />
        )}
        onEndReached={() => comments.hasNextPage && comments.fetchNextPage()}
      />
      <View style={styles.composer}>
        {replyTo ? (
          <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
            <Icon name="arrow-right" size={11} color={c.textMuted} />
            <Text style={socialStyles.muted}>{t('social.comment.reply')} {replyTo.authorName}</Text>
            <Icon name="close" size={11} color={c.textMuted} />
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <RNTextInput
            value={text}
            onChangeText={setText}
            placeholder={t('social.comment.placeholder')}
            placeholderTextColor={c.textMuted}
            style={styles.input}
            multiline
            maxLength={1000}
            accessibilityLabel={t('social.comment.placeholder')}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          />
          <Button label={t('social.messages.send')} size="sm" onPress={send} isLoading={sending} disabled={!text.trim()} />
        </View>
      </View>
      <ReportSheet visible={!!reportId} onClose={() => setReportId(null)} targetType="COMMENT" target={reportId ?? ''} />
    </ScreenContainer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Share a conversation: choose → preview exactly what becomes public → confirm
// ═══════════════════════════════════════════════════════════════════════════

export const ShareConversationScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const { conversationId } = useRoute<RouteProp<RootStackParamList, 'ShareConversation'>>().params;
  const { shareSelection, toggleShareMessage, resetShareSelection } = useSocialUiStore();
  const [preview, setPreview] = useState<SocialSharePreview | null>(null);
  const [visibility, setVisibility] = useState<'UNLISTED' | 'FOLLOWERS' | 'PUBLIC'>('UNLISTED');
  const [busy, setBusy] = useState(false);

  useEffect(() => resetShareSelection, [resetShareSelection]);
  const messages = useQuery({ queryKey: ['social', 'shareSource', conversationId], queryFn: () => ConversationApi.getMessages(conversationId, { limit: 50, direction: 'before' }) });

  const requestPreview = useCallback(async () => {
    setBusy(true);
    try {
      setPreview(await SocialApi.previewShare({ kind: 'CONVERSATION_EXCERPT', conversationId, messageIds: shareSelection, includeAttachments: false }));
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      Alert.alert(t('social.share.title'), msg ?? t('social.error.generic'));
    } finally {
      setBusy(false);
    }
  }, [conversationId, shareSelection, t]);

  const confirmShare = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const created = await SocialApi.createShare({
        source: { kind: 'CONVERSATION_EXCERPT', conversationId, messageIds: shareSelection, includeAttachments: false },
        visibility,
        confirmationToken: preview.confirmationToken ?? undefined,
      });
      resetShareSelection();
      nav.replace('SocialContent', { publicId: created.publicId });
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      Alert.alert(t('social.share.title'), msg ?? t('social.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    const blocked = preview.decision.action === 'BLOCK';
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <IconButton icon="‹" accessibilityLabel="Back to selection" onPress={() => setPreview(null)} />
          <Text style={socialStyles.screenTitle}>{t('social.share.review')}</Text>
        </View>
        <FlatList
          data={preview.messages}
          keyExtractor={(m) => m.ref}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              <Text style={styles.title} accessibilityRole="header">{t('social.share.selected', { count: preview.visibleMessageCount })}</Text>
              {preview.findings.length ? <Banner type="warning" message={t('social.share.redacted')} /> : null}
              {preview.decision.action === 'REQUIRE_MODERATION' ? <Banner type="info" message={t('social.share.reviewNotice')} /> : null}
              {blocked ? <Banner type="error" message={preview.decision.userMessage ?? t('social.error.generic')} /> : null}
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={[styles.previewMsg, m.speaker === 'CHARACTER' && styles.previewAi]}>
              <Text style={socialStyles.muted}>{m.speaker === 'CHARACTER' ? t('social.aiCharacter') : 'You'}{m.redacted ? ' · redacted' : ''}</Text>
              <Text style={styles.body}>{m.text}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              <Text style={socialStyles.sectionTitle}>{t('social.share.visibility')}</Text>
              {(['UNLISTED', 'FOLLOWERS', 'PUBLIC'] as const).map((v) => (
                <Pressable key={v} onPress={() => setVisibility(v)} style={styles.radioRow} accessibilityRole="radio" accessibilityState={{ checked: visibility === v }}>
                  <Text style={styles.body}>{visibility === v ? '◉' : '○'} {t(v === 'UNLISTED' ? 'social.share.unlisted' : v === 'FOLLOWERS' ? 'social.share.followers' : 'social.share.public')}</Text>
                </Pressable>
              ))}
              <Text style={socialStyles.muted}>{preview.externalCopyNotice}</Text>
              <Button label={t('social.share.create')} fullWidth disabled={blocked} isLoading={busy} onPress={confirmShare} />
              <Button label={t('social.cancel')} variant="ghost" fullWidth onPress={() => nav.goBack()} />
            </View>
          }
        />
      </ScreenContainer>
    );
  }

  const list = messages.data?.items ?? [];
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={socialStyles.screenTitle}>{t('social.share.title')}</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item: m }) => {
          const selected = shareSelection.includes(m.id);
          return (
            <Pressable onPress={() => toggleShareMessage(m.id)} style={[styles.previewMsg, selected && styles.selected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
                <Icon name={selected ? 'check' : 'plus'} size={13} color={selected ? c.accent : c.textMuted} />
                <Text style={socialStyles.muted}>{m.senderType === 'CHARACTER' ? t('social.aiCharacter') : 'You'}</Text>
              </View>
              <Text style={styles.body} numberOfLines={4}>{m.content}</Text>
            </Pressable>
          );
        }}
      />
      <View style={{ padding: spacing.lg }}>
        <Button label={`${t('social.share.review')} (${shareSelection.length})`} fullWidth disabled={shareSelection.length === 0} isLoading={busy} onPress={requestPreview} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  tab: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: c.accent },
  tabText: { ...typography.labelLarge, color: c.textMuted },
  tabTextActive: { color: c.textPrimary },
  title: { ...typography.titleMedium, color: c.textPrimary },
  body: { ...typography.bodyMedium, color: c.textSecondary },
  comment: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  reply: { marginLeft: spacing.xxl },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.labelMedium, color: c.textMuted },
  composer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle, gap: spacing.xs },
  input: { flex: 1, ...typography.bodyMedium, color: c.textPrimary, backgroundColor: c.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 120 },
  previewMsg: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.surface },
  previewAi: { borderColor: c.accent },
  selected: { borderColor: c.accent, backgroundColor: c.accentMuted },
  radioRow: { minHeight: 44, justifyContent: 'center' },
});
