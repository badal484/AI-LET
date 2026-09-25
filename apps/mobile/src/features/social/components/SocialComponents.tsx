import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SocialContentAttribution, SocialContentView, SocialReportTargetType, SocialUserCard } from '@ai-companion/types';
import { Avatar, Badge, BottomSheet, Button, Icon } from '../../../components/common/index.js';
import { darkThemeColors as c, spacing, radius, typography, MAX_FONT_SIZE_MULTIPLIER } from '../../../theme/index.js';
import { SocialApi } from '../api/socialApi.js';
import { useSocialT, type SocialStringKey } from '../i18n/strings.js';
import { useBlock, useReactionToggle } from '../hooks/useSocial.js';

const MIN_TOUCH = 44;

// ─── Attribution: who produced this (never conveyed by color alone) ─────────

const ATTRIBUTION_KEY: Record<SocialContentAttribution, SocialStringKey> = {
  AI_GENERATED: 'social.attribution.ai',
  CREATOR_WROTE_THIS: 'social.attribution.creator',
  USER_SHARED: 'social.attribution.user',
  PLATFORM: 'social.attribution.platform',
};

export const AttributionLabel: React.FC<{ attribution: SocialContentAttribution }> = ({ attribution }) => {
  const t = useSocialT();
  const isAi = attribution === 'AI_GENERATED';
  return (
    <View style={[styles.attribution, isAi && styles.attributionAi]} accessibilityRole="text" accessibilityLabel={t(ATTRIBUTION_KEY[attribution])}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {isAi && <Icon name="sparkles" size={10} color={c.accent} style={{ marginRight: 4 }} />}
        <Text style={styles.attributionText} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>
          {t(ATTRIBUTION_KEY[attribution])}
        </Text>
      </View>
    </View>
  );
};

// ─── People ──────────────────────────────────────────────────────────────────

export const UserRow: React.FC<{ user: SocialUserCard; onPress?: () => void; right?: React.ReactNode }> = ({ user, onPress, right }) => (
  <Pressable
    onPress={onPress}
    style={styles.userRow}
    accessibilityRole="button"
    accessibilityLabel={`${user.displayName}${user.username ? `, @${user.username}` : ''}${user.isVerified ? ', verified creator' : ''}`}
  >
    <Avatar uri={user.avatarUrl} name={user.displayName} size="md" />
    <View style={{ flex: 1, marginLeft: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{user.displayName}</Text>
        {user.isVerified ? <Badge label="Verified" variant="verified" size="sm" /> : null}
      </View>
      {user.username ? <Text style={styles.handle} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>@{user.username}</Text> : null}
    </View>
    {right}
  </Pressable>
);

export const FollowButton: React.FC<{ state: 'ACTIVE' | 'PENDING' | null; onPress: () => void; loading?: boolean }> = ({ state, onPress, loading }) => {
  const t = useSocialT();
  const label = state === 'ACTIVE' ? t('social.following') : state === 'PENDING' ? t('social.requested') : t('social.follow');
  return <Button label={label} variant={state ? 'outline' : 'primary'} size="sm" onPress={onPress} isLoading={loading} accessibilityState={{ selected: !!state }} />;
};

// ─── Reporting (reasons are user-friendly; internal taxonomy stays internal) ──

const REPORT_REASONS: Array<{ code: string; label: string }> = [
  { code: 'HARASSMENT', label: 'Harassment or bullying' },
  { code: 'SPAM', label: 'Spam or scam' },
  { code: 'SEXUAL_CONTENT', label: 'Sexual content' },
  { code: 'HATE', label: 'Hate or violence' },
  { code: 'SELF_HARM', label: 'Self-harm concerns' },
  { code: 'MINOR_SAFETY', label: 'Involves a minor' },
  { code: 'PRIVACY_VIOLATION', label: 'Shares private information' },
  { code: 'IMPERSONATION', label: 'Impersonation' },
  { code: 'MISLEADING_AI_CONTENT', label: 'Misleading AI content' },
  { code: 'OTHER', label: 'Something else' },
];

export const ReportSheet: React.FC<{ visible: boolean; onClose: () => void; targetType: SocialReportTargetType; target: string }> = ({ visible, onClose, targetType, target }) => {
  const t = useSocialT();
  const [sending, setSending] = useState(false);
  const submit = async (reasonCode: string) => {
    setSending(true);
    try {
      await SocialApi.report({ targetType, target, reasonCode });
      Alert.alert(t('social.report.title'), t('social.report.thanks'));
      onClose();
    } catch {
      Alert.alert(t('social.report.title'), t('social.error.generic'));
    } finally {
      setSending(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('social.report.title')}>
      {REPORT_REASONS.map((r) => (
        <Pressable key={r.code} disabled={sending} onPress={() => submit(r.code)} style={styles.sheetRow} accessibilityRole="button">
          <Text style={styles.sheetRowText} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{r.label}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
};

// ─── Content card with real feed controls ────────────────────────────────────

export const ContentCard: React.FC<{
  item: SocialContentView;
  reason?: string;
  onOpen: () => void;
  onOpenAuthor?: () => void;
  onFeedFeedback?: () => void;
}> = ({ item, reason, onOpen, onOpenAuthor, onFeedFeedback }) => {
  const t = useSocialT();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const react = useReactionToggle(item.publicId);
  const block = useBlock();
  const liked = item.viewerReactions.includes('LIKE');
  const messages = (item.snapshot['messages'] as Array<{ speaker: 'USER' | 'CHARACTER'; text: string }> | undefined) ?? [];

  const feedback = async (signal: 'NOT_INTERESTED' | 'SHOW_LESS' | 'HIDE', targetType: 'CONTENT' | 'AUTHOR' | 'CHARACTER', target: string) => {
    setMenu(false);
    await SocialApi.feedFeedback({ signal, targetType, target }).catch(() => undefined);
    onFeedFeedback?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={onOpenAuthor} accessibilityRole="button" accessibilityLabel={item.author?.displayName ?? item.character?.name ?? ''}>
          <Avatar uri={item.character?.avatarUrl ?? item.author?.avatarUrl} name={item.character?.name ?? item.author?.displayName} size="sm" />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>
              {item.character && item.attribution === 'AI_GENERATED' ? item.character.name : item.author?.displayName ?? t('social.unavailable')}
            </Text>
            <AttributionLabel attribution={item.attribution} />
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={8} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="More options">
          <Icon name="more" size={16} color={c.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint="Opens the post">
        {item.title ? <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{item.title}</Text> : null}
        {item.body ? <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{item.body}</Text> : null}
        {messages.slice(0, 3).map((m, i) => (
          <View key={i} style={[styles.excerpt, m.speaker === 'CHARACTER' && styles.excerptAi]}>
            <Text style={styles.excerptSpeaker} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{m.speaker === 'CHARACTER' ? t('social.aiCharacter') : 'User'}</Text>
            <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{m.text}</Text>
          </View>
        ))}
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={() => react.mutate({ type: 'LIKE', on: !liked })}
          style={styles.action}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={`${liked ? 'Remove like' : 'Like'}, ${item.reactionCount}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name={liked ? 'heart-filled' : 'heart'} size={14} color={liked ? '#ef4444' : c.textMuted} />
            <Text style={[styles.actionText, liked && { color: c.accent }]}>{item.reactionCount}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.action} accessibilityRole="button" accessibilityLabel={`${t('social.comments')}, ${item.commentCount}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="chat" size={14} color={c.textMuted} />
            <Text style={styles.actionText}>{item.commentCount}</Text>
          </View>
        </Pressable>
        {reason ? <Text style={styles.reason} accessibilityLabel={`Shown because ${reason.toLowerCase().replace(/_/g, ' ')}`}>{reason.toLowerCase().replace(/_/g, ' ')}</Text> : null}
      </View>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <Pressable style={styles.sheetRow} onPress={() => feedback('NOT_INTERESTED', 'CONTENT', item.publicId)}><Text style={styles.sheetRowText}>{t('social.feed.notInterested')}</Text></Pressable>
        {item.author ? <Pressable style={styles.sheetRow} onPress={() => feedback('SHOW_LESS', 'AUTHOR', item.author!.publicId)}><Text style={styles.sheetRowText}>{t('social.feed.showLess')}</Text></Pressable> : null}
        {item.author && !item.isOwner ? (
          <Pressable style={styles.sheetRow} onPress={async () => { setMenu(false); await SocialApi.mute({ targetType: 'USER', target: item.author!.publicId, scope: 'POSTS' }).catch(() => undefined); onFeedFeedback?.(); }}>
            <Text style={styles.sheetRowText}>{t('social.mute')} @{item.author.username}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.sheetRow} onPress={() => { setMenu(false); setReport(true); }}><Text style={[styles.sheetRowText, { color: c.danger }]}>{t('social.report')}</Text></Pressable>
        {item.author && !item.isOwner ? (
          <Pressable
            style={styles.sheetRow}
            onPress={() => {
              setMenu(false);
              Alert.alert(t('social.block'), `@${item.author!.username}`, [
                { text: t('social.cancel'), style: 'cancel' },
                { text: t('social.block'), style: 'destructive', onPress: () => block.mutate({ target: item.author!.publicId }, { onSuccess: onFeedFeedback }) },
              ]);
            }}
          >
            <Text style={[styles.sheetRowText, { color: c.danger }]}>{t('social.block')}</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="CONTENT" target={item.publicId} />
    </View>
  );
};

export const socialStyles = StyleSheet.create({
  screenTitle: { ...typography.headlineSmall, color: c.textPrimary },
  muted: { ...typography.bodySmall, color: c.textMuted },
  sectionTitle: { ...typography.titleSmall, color: c.textPrimary, marginBottom: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginVertical: spacing.md },
});

const styles = StyleSheet.create({
  attribution: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, marginTop: 2 },
  attributionAi: { borderColor: c.accent },
  attributionText: { ...typography.caption, color: c.textSecondary },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, minHeight: MIN_TOUCH },
  name: { ...typography.titleSmall, color: c.textPrimary, flexShrink: 1 },
  handle: { ...typography.bodySmall, color: c.textMuted },
  card: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  menuButton: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  menuDots: { color: c.textMuted, fontSize: 20 },
  title: { ...typography.titleMedium, color: c.textPrimary, marginBottom: spacing.xs },
  body: { ...typography.bodyMedium, color: c.textSecondary },
  excerpt: { borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: spacing.sm, marginTop: spacing.sm },
  excerptAi: { borderLeftColor: c.accent },
  excerptSpeaker: { ...typography.caption, color: c.textMuted, marginBottom: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  actionText: { ...typography.labelMedium, color: c.textMuted },
  reason: { ...typography.caption, color: c.textMuted, marginLeft: 'auto' },
  sheetRow: { minHeight: MIN_TOUCH + 4, justifyContent: 'center', paddingHorizontal: spacing.lg },
  sheetRowText: { ...typography.bodyLarge, color: c.textPrimary },
});
