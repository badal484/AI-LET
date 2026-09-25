import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RootStackParamList } from '../../../navigation/types.js';
import { Button } from '../../../components/common/index.js';
import { darkThemeColors as c, MAX_FONT_SIZE_MULTIPLIER, spacing, typography } from '../../../theme/index.js';
import { SocialApi } from '../api/socialApi.js';
import { useSocialT } from '../i18n/strings.js';
import { AttributionLabel } from './SocialComponents.js';

/**
 * Character-page social strip. Following a character is distinct from favoriting it and from chatting;
 * "Start chat" stays the primary action elsewhere on the page. Degrades silently if social is off.
 */
export const CharacterSocialBar: React.FC<{ slug: string }> = ({ slug }) => {
  const t = useSocialT();
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ['social', 'characterFollow', slug], queryFn: () => SocialApi.characterFollowState(slug), retry: false });
  const posts = useQuery({ queryKey: ['social', 'characterContent', slug], queryFn: () => SocialApi.characterContent(slug), retry: false });
  const toggle = useMutation({
    mutationFn: (next: { follow: boolean; notify: boolean }) => (next.follow ? SocialApi.followCharacter(slug, next.notify) : SocialApi.unfollowCharacter(slug)),
    onSuccess: (data) => qc.setQueryData(['social', 'characterFollow', slug], data),
  });

  // Social failures never affect the core character/chat experience.
  if (state.isError || !state.data) return null;
  const s = state.data;
  const items = posts.data?.items.slice(0, 3) ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.count} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} accessibilityLabel={`${s.followerCount} followers`}>
          {s.followerCount} {t('social.followers').toLowerCase()}
        </Text>
        <Button
          label={s.following ? t('social.following') : t('social.follow')}
          size="sm"
          variant={s.following ? 'outline' : 'secondary'}
          isLoading={toggle.isPending}
          onPress={() => toggle.mutate({ follow: !s.following, notify: false })}
          accessibilityState={{ selected: s.following }}
        />
      </View>
      {s.following ? (
        <View style={styles.row}>
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>Updates from this character</Text>
          <Switch
            value={s.notificationsEnabled}
            onValueChange={(v) => toggle.mutate({ follow: true, notify: v })}
            accessibilityLabel="Notify me about updates from this character"
            trackColor={{ true: c.accent, false: c.border }}
          />
        </View>
      ) : null}
      {items.map((p) => (
        <Pressable key={p.publicId} onPress={() => nav.navigate('SocialContent', { publicId: p.publicId })} style={styles.post} accessibilityRole="button">
          <AttributionLabel attribution={p.attribution} />
          <Text style={styles.postText} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}>{p.title ?? p.body ?? ''}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  count: { ...typography.labelLarge, color: c.textSecondary },
  label: { ...typography.bodyMedium, color: c.textSecondary, flex: 1 },
  post: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle, minHeight: 44 },
  postText: { ...typography.bodyMedium, color: c.textPrimary, marginTop: spacing.xs },
});
