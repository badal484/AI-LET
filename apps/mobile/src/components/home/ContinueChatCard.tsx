import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ConversationSummary } from '@ai-companion/types';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { useAuthStore } from '../../stores/authStore.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { Avatar } from '../common/Avatar.js';
import { Icon } from '../common/Icon.js';
import { PressableScale } from '../common/PressableScale.js';
import { chatListTime } from '../../utils/chatDates.js';

/** "Good evening, Badal" — by the phone's clock; late at night it's "Still up". */
function greetingFor(hour: number, name: string | null): string {
  const who = name ? `, ${name}` : '';
  if (hour >= 23 || hour < 4) return `Still up${who}? 🌙`;
  if (hour < 12) return `Good morning${who}`;
  if (hour < 17) return `Good afternoon${who}`;
  return `Good evening${who}`;
}

/**
 * Top of Home: a personal greeting and, once they've chatted, a one-tap way back into their latest chat
 * (shares the Chats tab's cached list, so it costs no extra request when that's loaded).
 */
export const ContinueChatCard: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const displayName = useAuthStore((s) => s.user?.profile?.displayName ?? null);
  const firstName = displayName?.trim().split(/\s+/)[0] || null;

  const { data, refetch } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => ConversationApi.listConversations({ limit: 50 }),
    staleTime: 30_000,
  });
  // Back on Home after a chat: show where they left off.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const latest: ConversationSummary | undefined = (data?.items ?? [])
    .filter((c) => c.lastMessageAt && !c.id.startsWith('demo_'))
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))[0];

  const open = () => {
    if (!latest) return;
    navigation.navigate('Chat', {
      characterId: latest.character.id,
      conversationId: latest.id,
      characterName: latest.character.name,
      characterAvatarUrl: latest.character.avatarUrl,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting} accessibilityRole="header">
        {greetingFor(new Date().getHours(), firstName)}
      </Text>
      {latest ? (
        <PressableScale
          onPress={open}
          scaleTo={0.98}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={`Continue chatting with ${latest.character.name}`}
        >
          <Avatar uri={latest.character.avatarUrl} name={latest.character.name} size="md" />
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Continue with {latest.character.name.split(' ')[0]}
              </Text>
              {latest.lastMessageAt ? <Text style={styles.time}>{chatListTime(latest.lastMessageAt)}</Text> : null}
            </View>
            {latest.lastMessageSnippet ? (
              <Text style={styles.snippet} numberOfLines={1}>
                {latest.lastMessageSnippet}
              </Text>
            ) : null}
          </View>
          <View style={styles.go}>
            <Icon name="arrow-right" size={18} color="#FFFFFF" />
          </View>
        </PressableScale>
      ) : (
        <Text style={styles.sub}>Who do you want to talk to today?</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14, gap: 10 },
  greeting: { color: '#F5E9FF', fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  sub: { color: '#9E97B0', fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#1A1028',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.22)',
  },
  text: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  time: { color: '#8E86A3', fontSize: 12 },
  snippet: { color: '#B9B2CC', fontSize: 13.5 },
  go: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E02494',
  },
});
