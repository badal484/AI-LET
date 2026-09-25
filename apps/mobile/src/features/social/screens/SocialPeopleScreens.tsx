import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialDirectMessageView } from '@ai-companion/types';
import type { RootStackParamList } from '../../../navigation/types.js';
import { Avatar, Banner, BottomSheet, Button, EmptyState, Icon, IconButton, ScreenContainer, Skeleton, TextInput } from '../../../components/common/index.js';
import { darkThemeColors as c, MAX_FONT_SIZE_MULTIPLIER, radius, spacing, typography } from '../../../theme/index.js';
import { SocialApi, newIdempotencyKey } from '../api/socialApi.js';
import { useSocialT } from '../i18n/strings.js';
import { socialKeys, useBlock, useFollowToggle, useMessageRequests, useMessages, useSocialProfile, useThreads, useUserContent } from '../hooks/useSocial.js';
import { SocialDraftStorage } from '../state/socialClientState.js';
import { ContentCard, FollowButton, ReportSheet, UserRow, socialStyles } from '../components/SocialComponents.js';

type Nav = StackNavigationProp<RootStackParamList>;
const errMessage = (e: unknown) => (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;

// ═══════════════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════════════

export const SocialProfileScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const { handle } = useRoute<RouteProp<RootStackParamList, 'SocialProfile'>>().params;
  const profile = useSocialProfile(handle);
  const follow = useFollowToggle(handle);
  const block = useBlock();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const content = useUserContent(handle, !!profile.data?.isFullView);

  if (profile.isError) {
    // Unknown, deleted, hidden and blocked profiles look identical (no enumeration / block inference).
    return <ScreenContainer><EmptyState title={t('social.unavailable')} actionLabel="OK" onAction={() => nav.goBack()} /></ScreenContainer>;
  }
  if (!profile.data) return <ScreenContainer><Skeleton height={180} /></ScreenContainer>;
  const p = profile.data;
  const rel = p.relationship;
  const items = content.data?.pages.flatMap((pg) => pg.items) ?? [];

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        {!rel?.isSelf ? <IconButton icon="⋯" accessibilityLabel="More options" onPress={() => setMenu(true)} /> : null}
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Avatar uri={p.avatarUrl} name={p.displayName} size="xl" />
        <Text style={socialStyles.screenTitle} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{p.displayName}</Text>
        {p.username ? <Text style={socialStyles.muted}>@{p.username}{p.pronouns ? ` · ${p.pronouns}` : ''}</Text> : null}
        {p.isCreator ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {p.isVerified ? <Icon name="check" size={12} color={c.accent} /> : null}
            <Text style={socialStyles.muted}>{p.isVerified ? 'Verified creator' : 'Creator'}</Text>
          </View>
        ) : null}
        {p.bio ? <Text style={[styles.body, { textAlign: 'center' }]}>{p.bio}</Text> : null}
      </View>
      {p.isFullView ? (
        <View style={styles.stats} accessibilityRole="summary">
          <Pressable style={styles.stat} onPress={() => nav.navigate('SocialFollowList', { handle, direction: 'followers' })} accessibilityRole="button">
            <Text style={styles.statValue}>{p.followersCount ?? '—'}</Text>
            <Text style={socialStyles.muted}>{t('social.followers')}</Text>
          </Pressable>
          <Pressable style={styles.stat} onPress={() => nav.navigate('SocialFollowList', { handle, direction: 'following' })} accessibilityRole="button">
            <Text style={styles.statValue}>{p.followingCount ?? '—'}</Text>
            <Text style={socialStyles.muted}>{t('social.followingCount')}</Text>
          </Pressable>
        </View>
      ) : (
        <Banner type="info" message={t('social.profileLimited')} />
      )}
      {rel && !rel.isSelf ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
          <FollowButton state={rel.following} loading={follow.isPending} onPress={() => follow.mutate(rel.following ? 'unfollow' : 'follow')} />
          {rel.canMessage ? <Button label={t('social.message')} variant="outline" size="sm" onPress={() => nav.navigate('SocialThread', { recipient: p.publicId, displayName: p.displayName })} /> : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.publicId}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ContentCard item={item} onOpen={() => nav.navigate('SocialContent', { publicId: item.publicId })} />}
        onEndReached={() => content.hasNextPage && content.fetchNextPage()}
      />
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <Pressable style={styles.sheetRow} onPress={async () => { setMenu(false); await SocialApi.mute({ targetType: 'USER', target: p.publicId, scope: 'ALL' }); }}>
          <Text style={styles.sheetText}>{t('social.mute')}</Text>
        </Pressable>
        <Pressable style={styles.sheetRow} onPress={() => { setMenu(false); setReport(true); }}>
          <Text style={[styles.sheetText, { color: c.danger }]}>{t('social.report')}</Text>
        </Pressable>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setMenu(false);
            Alert.alert(t('social.block'), p.displayName, [
              { text: t('social.cancel'), style: 'cancel' },
              { text: t('social.block'), style: 'destructive', onPress: () => block.mutate({ target: p.publicId }, { onSuccess: () => nav.goBack() }) },
            ]);
          }}
        >
          <Text style={[styles.sheetText, { color: c.danger }]}>{t('social.block')}</Text>
        </Pressable>
      </BottomSheet>
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="PROFILE" target={p.publicId} />
    </ScreenContainer>
  );
};

export const SocialFollowListScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const { handle, direction } = useRoute<RouteProp<RootStackParamList, 'SocialFollowList'>>().params;
  const list = useQuery({ queryKey: ['social', 'followList', handle, direction], queryFn: () => (direction === 'followers' ? SocialApi.followers(handle) : SocialApi.following(handle)), retry: false });
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={socialStyles.screenTitle}>{direction === 'followers' ? t('social.followers') : t('social.followingCount')}</Text>
      </View>
      {list.isError ? (
        <EmptyState title={errMessage(list.error) ?? t('social.unavailable')} />
      ) : (
        <FlatList
          data={list.data?.items ?? []}
          keyExtractor={(u) => u.publicId}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          renderItem={({ item }) => <UserRow user={item} onPress={() => nav.push('SocialProfile', { handle: item.username ?? item.publicId })} />}
        />
      )}
    </ScreenContainer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Messages (human ↔ human). Requests are separate from the inbox.
// ═══════════════════════════════════════════════════════════════════════════

export const SocialInboxScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'inbox' | 'requests'>('inbox');
  const threads = useThreads();
  const requests = useMessageRequests();
  const threadItems = threads.data?.pages.flatMap((p) => p.items) ?? [];

  const respond = async (id: string, action: 'ACCEPT' | 'DECLINE' | 'BLOCK') => {
    try {
      const r = await SocialApi.respondMessageRequest(id, action);
      qc.invalidateQueries({ queryKey: socialKeys.requests });
      qc.invalidateQueries({ queryKey: socialKeys.threads });
      if (r.threadId && action === 'ACCEPT') setTab('inbox');
    } catch (e) {
      Alert.alert(t('social.messages.requests'), errMessage(e) ?? t('social.error.generic'));
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['inbox', 'requests'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.tabText, tab === k && { color: c.textPrimary }]}>
              {k === 'inbox' ? t('social.messages.inbox') : `${t('social.messages.requests')}${requests.data?.items.length ? ` (${requests.data.items.length})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'inbox' ? (
        <FlatList
          data={threadItems}
          keyExtractor={(th) => th.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          ListEmptyComponent={<EmptyState title={t('social.messages.empty')} />}
          renderItem={({ item }) => (
            <UserRow
              user={item.counterpart}
              onPress={() => nav.navigate('SocialThread', { threadId: item.id, displayName: item.counterpart.displayName })}
              right={item.unreadCount ? <View style={styles.unread} accessibilityLabel={`${item.unreadCount} unread`}><Text style={styles.unreadText}>{item.unreadCount}</Text></View> : null}
            />
          )}
          onEndReached={() => threads.hasNextPage && threads.fetchNextPage()}
        />
      ) : (
        <FlatList
          data={requests.data?.items ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          ListEmptyComponent={<EmptyState title={t('social.messages.empty')} />}
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              <UserRow user={item.from} />
              <Text style={styles.body}>{item.preview ?? t('social.messages.filtered')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label={t('social.messages.accept')} size="sm" onPress={() => respond(item.id, 'ACCEPT')} />
                <Button label={t('social.messages.decline')} size="sm" variant="outline" onPress={() => respond(item.id, 'DECLINE')} />
                <Button label={t('social.block')} size="sm" variant="danger" onPress={() => respond(item.id, 'BLOCK')} />
              </View>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
};

const MessageBubbleRow: React.FC<{ m: SocialDirectMessageView }> = ({ m }) => {
  const t = useSocialT();
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={[styles.bubble, m.isMine ? styles.mine : styles.theirs]} accessibilityLabel={`${m.isMine ? 'You' : 'Them'}: ${m.body ?? ''}`}>
      {m.body === null ? (
        <Text style={socialStyles.muted}>{t('social.unavailable')}</Text>
      ) : m.isFlagged && !revealed ? (
        <Pressable onPress={() => setRevealed(true)} accessibilityRole="button" accessibilityHint="Reveals a message that our safety checks flagged" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="warning" size={12} color={c.warning} />
          <Text style={socialStyles.muted}>{t('social.messages.filtered')}</Text>
        </Pressable>
      ) : (
        <Text style={styles.body}>{m.body}</Text>
      )}
    </View>
  );
};

export const SocialThreadScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const params = useRoute<RouteProp<RootStackParamList, 'SocialThread'>>().params;
  const [threadId, setThreadId] = useState<string | undefined>(params.threadId);
  const messages = useMessages(threadId ?? '__none__');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const draftId = `dm:${threadId ?? params.recipient}`;
  const items = useMemo(() => (threadId ? messages.data?.pages.flatMap((p) => p.items) ?? [] : []), [messages.data, threadId]);
  const typing = messages.data?.pages[0]?.counterpartTyping ?? false;

  useEffect(() => {
    SocialDraftStorage.load(draftId).then((d) => d && setText(d));
  }, [draftId]);
  useEffect(() => {
    const h = setTimeout(() => SocialDraftStorage.save(draftId, text), 400);
    return () => clearTimeout(h);
  }, [draftId, text]);
  useEffect(() => {
    if (threadId) SocialApi.markRead(threadId).catch(() => undefined);
  }, [threadId, items.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    // Retries of this exact send reuse the same client id (server de-duplicates).
    const clientMessageId = newIdempotencyKey();
    setSending(true);
    try {
      if (threadId) {
        await SocialApi.send(threadId, body, clientMessageId);
      } else if (params.recipient) {
        const started = await SocialApi.startConversation(params.recipient, body, clientMessageId);
        setThreadId(started.threadId);
        if (started.mode === 'REQUEST') setInfo(t('social.messages.requestSent'));
      }
      setText('');
      await SocialDraftStorage.clear(draftId);
      qc.invalidateQueries({ queryKey: socialKeys.threads });
      if (threadId) qc.invalidateQueries({ queryKey: socialKeys.messages(threadId) });
    } catch (e) {
      Alert.alert(t('social.message'), errMessage(e) ?? t('social.error.generic'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={socialStyles.screenTitle} numberOfLines={1}>{params.displayName ?? t('social.message')}</Text>
        <View style={{ width: 44 }} />
      </View>
      {info ? <Banner type="info" message={info} onDismiss={() => setInfo(null)} /> : null}
      <FlatList
        inverted
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => <MessageBubbleRow m={item} />}
        onEndReached={() => messages.hasNextPage && messages.fetchNextPage()}
        ListHeaderComponent={typing ? <Text style={socialStyles.muted} accessibilityLiveRegion="polite">…</Text> : null}
      />
      <View style={styles.composer}>
        <RNTextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (threadId && v.length % 12 === 1) SocialApi.typing(threadId);
          }}
          placeholder={t('social.messages.placeholder')}
          placeholderTextColor={c.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
          accessibilityLabel={t('social.messages.placeholder')}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        />
        <Button label={t('social.messages.send')} size="sm" isLoading={sending} disabled={!text.trim()} onPress={send} />
      </View>
    </ScreenContainer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Profile setup (opt-in: nobody has a public identity until they create one)
// ═══════════════════════════════════════════════════════════════════════════

export const SocialProfileSetupScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const availability = useQuery({
    queryKey: ['social', 'usernameAvailability', username],
    queryFn: () => SocialApi.usernameAvailability(username),
    enabled: username.trim().length >= 3,
    staleTime: 10_000,
  });

  const create = async () => {
    setBusy(true);
    try {
      await SocialApi.createProfile({ username, displayName, bio: bio || undefined });
      qc.invalidateQueries({ queryKey: socialKeys.me });
      nav.replace('SocialPrivacySettings');
    } catch (e) {
      Alert.alert(t('social.settings.title'), errMessage(e) ?? t('social.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  const a = availability.data;
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={socialStyles.screenTitle}>{t('social.settings.title')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <TextInput label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} error={a && !a.available ? a.message : undefined} helperText={a?.available ? 'Available' : undefined} />
        <TextInput label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={60} />
        <TextInput label="Bio" value={bio} onChangeText={setBio} maxLength={300} multiline />
        <Text style={socialStyles.muted}>Your profile starts as “Limited” and isn’t suggested to others until you choose. You can change this anytime.</Text>
        <Button label="Create profile" fullWidth isLoading={busy} disabled={!a?.available || !displayName.trim()} onPress={create} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  body: { ...typography.bodyMedium, color: c.textSecondary },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxxl },
  stat: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  statValue: { ...typography.titleMedium, color: c.textPrimary },
  sheetRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg },
  sheetText: { ...typography.bodyLarge, color: c.textPrimary },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  tab: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: c.accent },
  tabText: { ...typography.labelLarge, color: c.textMuted },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { ...typography.labelSmall, color: c.accentText },
  requestCard: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: c.accentMuted },
  theirs: { alignSelf: 'flex-start', backgroundColor: c.surfaceElevated },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
  input: { flex: 1, ...typography.bodyMedium, color: c.textPrimary, backgroundColor: c.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 140 },
});
