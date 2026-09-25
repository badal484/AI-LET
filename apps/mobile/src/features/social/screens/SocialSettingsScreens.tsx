import React, { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialAudience, SocialPrivacySettingsDto } from '@ai-companion/types';
import type { UpdateSocialPrivacyInput } from '@ai-companion/validation';
import type { RootStackParamList } from '../../../navigation/types.js';
import { Banner, BottomSheet, Button, EmptyState, Icon, IconButton, ScreenContainer, Skeleton, TextInput } from '../../../components/common/index.js';
import { darkThemeColors as c, MAX_FONT_SIZE_MULTIPLIER, spacing, typography } from '../../../theme/index.js';
import { SocialApi } from '../api/socialApi.js';
import { useSocialT, type SocialStringKey } from '../i18n/strings.js';
import { socialKeys, useCommunity, useCommunityPosts, useEnforcement, useMySocialProfile, useSocialConsents, useSocialPrivacy } from '../hooks/useSocial.js';
import { ContentCard, ReportSheet, UserRow, socialStyles } from '../components/SocialComponents.js';

type Nav = StackNavigationProp<RootStackParamList>;
const errMessage = (e: unknown) => (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;

// ═══════════════════════════════════════════════════════════════════════════
// Community — rules are shown before joining.
// ═══════════════════════════════════════════════════════════════════════════

export const CommunityScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const { slug } = useRoute<RouteProp<RootStackParamList, 'Community'>>().params;
  const community = useCommunity(slug);
  const posts = useCommunityPosts(slug, !!community.data?.canViewContent);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);

  if (community.isError) return <ScreenContainer><EmptyState title={t('social.unavailable')} actionLabel="OK" onAction={() => nav.goBack()} /></ScreenContainer>;
  if (!community.data) return <ScreenContainer><Skeleton height={160} /></ScreenContainer>;
  const cm = community.data;
  const member = cm.viewerMembership?.status === 'ACTIVE' || cm.viewerMembership?.status === 'MUTED';

  const join = async () => {
    setBusy(true);
    try {
      await SocialApi.joinCommunity(slug);
      setRulesOpen(false);
      qc.invalidateQueries({ queryKey: socialKeys.community(slug) });
    } catch (e) {
      Alert.alert(cm.name, errMessage(e) ?? t('social.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <FlatList
        data={posts.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(i) => i.publicId}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
            <View style={styles.header}>
              <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
              <IconButton icon="flag" accessibilityLabel={t('social.report')} onPress={() => setReport(true)} />
            </View>
            <Text style={socialStyles.screenTitle} accessibilityRole="header">{cm.name}</Text>
            <Text style={socialStyles.muted}>{t('social.community.members', { count: cm.memberCount })} · {cm.privacy.toLowerCase().replace('_', ' ')}</Text>
            <Text style={styles.body}>{cm.description}</Text>
            <Pressable onPress={() => setRulesOpen(true)} style={styles.row} accessibilityRole="button">
              <Text style={styles.link}>{t('social.community.rules')} ({cm.rules.length})</Text>
            </Pressable>
            {member ? (
              <Button label={t('social.community.leave')} variant="outline" size="sm" onPress={async () => { await SocialApi.leaveCommunity(slug); qc.invalidateQueries({ queryKey: socialKeys.community(slug) }); }} />
            ) : cm.viewerMembership?.status === 'PENDING' ? (
              <Banner type="info" message={t('social.requested')} />
            ) : (
              <Button label={t('social.community.join')} onPress={() => setRulesOpen(true)} />
            )}
            {!cm.canViewContent ? <Banner type="info" message={t('social.community.private')} /> : null}
          </View>
        }
        renderItem={({ item }) => <ContentCard item={item} onOpen={() => nav.navigate('SocialContent', { publicId: item.publicId })} />}
        onEndReached={() => posts.hasNextPage && posts.fetchNextPage()}
      />
      <BottomSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} title={t('social.community.rules')}>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {cm.rules.map((r, i) => (
            <Text key={i} style={styles.body}>{i + 1}. {r}</Text>
          ))}
          {!member ? <Button label={t('social.community.join')} fullWidth isLoading={busy} onPress={join} /> : null}
        </View>
      </BottomSheet>
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="COMMUNITY" target={slug} />
    </ScreenContainer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Settings → Social & Privacy (per-feature privacy + consent center + status)
// ═══════════════════════════════════════════════════════════════════════════

const AUDIENCES: SocialAudience[] = ['EVERYONE', 'FOLLOWERS', 'MUTUALS', 'NOBODY'];

const ChoiceRow: React.FC<{ label: string; value: string; onPress: () => void }> = ({ label, value, onPress }) => (
  <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={styles.rowValue} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{value}</Text>
      <Icon name="arrow-right" size={12} color={c.textMuted} />
    </View>
  </Pressable>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, { flex: 1 }]} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{label}</Text>
    <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} trackColor={{ true: c.accent, false: c.border }} />
  </View>
);

type AudienceField = 'followListAudience' | 'whoCanMessage' | 'whoCanMention' | 'whoCanComment' | 'whoCanInviteToCommunities';

export const SocialPrivacySettingsScreen: React.FC = () => {
  const t = useSocialT();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const me = useMySocialProfile();
  const privacy = useSocialPrivacy();
  const consents = useSocialConsents();
  const enforcement = useEnforcement();
  const blocks = useQuery({ queryKey: socialKeys.blocks, queryFn: () => SocialApi.blocks() });
  const [picker, setPicker] = useState<{ field: AudienceField | 'profileVisibility' | 'followPolicy'; label: string } | null>(null);
  const [appealCase, setAppealCase] = useState<string | null>(null);
  const [appealText, setAppealText] = useState('');

  const submitAppeal = async () => {
    if (!appealCase || appealText.trim().length < 10) return;
    try {
      await SocialApi.appeal(appealCase, appealText.trim());
      setAppealCase(null);
      qc.invalidateQueries({ queryKey: socialKeys.enforcement });
    } catch (e) {
      Alert.alert(t('social.settings.appeal'), errMessage(e) ?? t('social.error.generic'));
    }
  };

  const update = async (patch: UpdateSocialPrivacyInput) => {
    const prev = qc.getQueryData<SocialPrivacySettingsDto>(socialKeys.privacy);
    if (prev) qc.setQueryData(socialKeys.privacy, { ...prev, ...patch });
    try {
      await SocialApi.updatePrivacy(patch);
    } catch (e) {
      if (prev) qc.setQueryData(socialKeys.privacy, prev);
      Alert.alert(t('social.settings.title'), errMessage(e) ?? t('social.error.generic'));
    } finally {
      qc.invalidateQueries({ queryKey: socialKeys.privacy });
    }
  };

  if (me.isError) {
    return (
      <ScreenContainer>
        <EmptyState title={t('social.settings.title')} description="Create a social profile to use social features. Nothing is public until you do." actionLabel="Set up profile" onAction={() => nav.navigate('SocialProfileSetup')} />
      </ScreenContainer>
    );
  }
  if (!privacy.data) return <ScreenContainer><Skeleton height={300} /></ScreenContainer>;
  const p = privacy.data;
  const options: string[] =
    picker?.field === 'profileVisibility' ? ['PUBLIC', 'LIMITED', 'PRIVATE'] : picker?.field === 'followPolicy' ? ['EVERYONE', 'APPROVAL_REQUIRED', 'NOBODY'] : AUDIENCES;
  const label = (v: string) =>
    picker?.field === 'profileVisibility' ? t(`social.visibility.${v}` as SocialStringKey) : picker?.field === 'followPolicy' ? v.replace('_', ' ').toLowerCase() : t(`social.audience.${v}` as SocialStringKey);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <IconButton icon="‹" accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={socialStyles.screenTitle}>{t('social.settings.title')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        {enforcement.data?.length ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={socialStyles.sectionTitle}>{t('social.settings.enforcement')}</Text>
            {enforcement.data.map((n) => (
              <View key={n.caseId} style={styles.notice}>
                <Text style={styles.body}>{n.what}</Text>
                {n.until ? <Text style={socialStyles.muted}>Until {new Date(n.until).toLocaleString()}</Text> : null}
                {n.appealStatus ? <Text style={socialStyles.muted}>Appeal: {n.appealStatus.toLowerCase().replace('_', ' ')}</Text> : null}
                {n.canAppeal ? (
                  <Button label={t('social.settings.appeal')} size="sm" variant="outline" onPress={() => { setAppealCase(n.caseId); setAppealText(''); }} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <Text style={socialStyles.sectionTitle}>Profile</Text>
        <ChoiceRow label={t('social.settings.profileVisibility')} value={t(`social.visibility.${p.profileVisibility}` as SocialStringKey)} onPress={() => setPicker({ field: 'profileVisibility', label: t('social.settings.profileVisibility') })} />
        <ChoiceRow label={t('social.settings.whoCanFollow')} value={p.followPolicy.replace('_', ' ').toLowerCase()} onPress={() => setPicker({ field: 'followPolicy', label: t('social.settings.whoCanFollow') })} />
        <ChoiceRow label={t('social.settings.followLists')} value={t(`social.audience.${p.followListAudience}`)} onPress={() => setPicker({ field: 'followListAudience', label: t('social.settings.followLists') })} />
        <ToggleRow label={t('social.settings.onlineStatus')} value={p.showOnlineStatus} onChange={(v) => update({ showOnlineStatus: v })} />

        <View style={socialStyles.divider} />
        <Text style={socialStyles.sectionTitle}>Interactions</Text>
        <ChoiceRow label={t('social.settings.whoCanMessage')} value={t(`social.audience.${p.whoCanMessage}`)} onPress={() => setPicker({ field: 'whoCanMessage', label: t('social.settings.whoCanMessage') })} />
        <ChoiceRow label={t('social.settings.whoCanMention')} value={t(`social.audience.${p.whoCanMention}`)} onPress={() => setPicker({ field: 'whoCanMention', label: t('social.settings.whoCanMention') })} />
        <ChoiceRow label={t('social.settings.whoCanComment')} value={t(`social.audience.${p.whoCanComment}`)} onPress={() => setPicker({ field: 'whoCanComment', label: t('social.settings.whoCanComment') })} />
        <ChoiceRow label="Community invitations" value={t(`social.audience.${p.whoCanInviteToCommunities}`)} onPress={() => setPicker({ field: 'whoCanInviteToCommunities', label: 'Community invitations' })} />
        <ToggleRow label={t('social.settings.characterInteractions')} value={p.characterSocialInteractions} onChange={(v) => update({ characterSocialInteractions: v })} />

        <View style={socialStyles.divider} />
        <Text style={socialStyles.sectionTitle}>Discovery</Text>
        <ToggleRow label={t('social.settings.searchable')} value={p.searchable} onChange={(v) => update({ searchable: v })} />
        <ToggleRow label={t('social.settings.discoverable')} value={p.discoverable} onChange={(v) => update({ discoverable: v })} />
        <ToggleRow label={t('social.settings.recommendations')} value={p.socialRecommendations} onChange={(v) => update({ socialRecommendations: v })} />

        <View style={socialStyles.divider} />
        <Text style={socialStyles.sectionTitle}>{t('social.settings.consent')}</Text>
        <Text style={[socialStyles.muted, { marginBottom: spacing.sm }]}>Each permission is recorded with a timestamp and can be withdrawn at any time.</Text>
        {(consents.data ?? []).map((cn) => (
          <ToggleRow
            key={cn.consentType}
            label={t(`social.consent.${cn.consentType}` as SocialStringKey)}
            value={cn.granted}
            onChange={async (v) => {
              await SocialApi.setConsent(cn.consentType, v).catch((e) => Alert.alert(t('social.settings.consent'), errMessage(e) ?? t('social.error.generic')));
              qc.invalidateQueries({ queryKey: socialKeys.consents });
            }}
          />
        ))}

        <View style={socialStyles.divider} />
        <Text style={socialStyles.sectionTitle}>{t('social.settings.blocked')}</Text>
        {(blocks.data?.items ?? []).length === 0 ? <Text style={socialStyles.muted}>—</Text> : null}
        {(blocks.data?.items ?? []).map((u) => (
          <UserRow
            key={u.publicId}
            user={u}
            right={<Button label={t('social.unblock')} size="sm" variant="outline" onPress={async () => { await SocialApi.unblock(u.publicId); qc.invalidateQueries({ queryKey: socialKeys.blocks }); }} />}
          />
        ))}
      </ScrollView>

      <BottomSheet visible={!!appealCase} onClose={() => setAppealCase(null)} title={t('social.settings.appeal')}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TextInput label="Tell us why this decision should be reviewed" value={appealText} onChangeText={setAppealText} multiline maxLength={2000} helperText="At least 10 characters" />
          <Button label={t('social.settings.appeal')} fullWidth disabled={appealText.trim().length < 10} onPress={submitAppeal} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!picker} onClose={() => setPicker(null)} title={picker?.label}>
        {options.map((o) => {
          const selected = picker ? (p as unknown as Record<string, string>)[picker.field] === o : false;
          return (
            <Pressable
              key={o}
              style={[styles.sheetRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (picker) update({ [picker.field]: o } as UpdateSocialPrivacyInput);
                setPicker(null);
              }}
            >
              <Text style={[styles.rowLabel, selected && { color: c.accent }]}>{label(o)}</Text>
              {selected ? <Icon name="check" size={16} color={c.accent} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  body: { ...typography.bodyMedium, color: c.textSecondary },
  link: { ...typography.labelLarge, color: c.accent },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.bodyLarge, color: c.textPrimary, flexShrink: 1 },
  rowValue: { ...typography.bodyMedium, color: c.textMuted },
  sheetRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg },
  notice: { padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.warning, borderRadius: 12, gap: spacing.xs, marginBottom: spacing.sm },
});
