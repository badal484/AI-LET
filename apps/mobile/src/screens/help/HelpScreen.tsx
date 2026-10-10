import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, IconButton, ToastService } from '../../components/common/index.js';
import { api } from '../../services/api/client.js';
import { Realtime } from '../../services/realtime/RealtimeClient.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

/**
 * Help & contact us: quick answers, a message to the team, and their replies (admin console → Support).
 * A reply also arrives as a notification that opens this screen; the list refreshes live.
 */

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How many messages can I send?',
    a: 'The free plan has a few messages every day, and they refill at midnight. Premium gives you 150 a day, and you can add 100 more any time for ₹49.',
  },
  {
    q: 'How do I cancel Premium?',
    a: 'Open the Play Store → your profile photo → Payments & subscriptions → Subscriptions → Lovira → Cancel. Premium stays on until the end of the period you paid for.',
  },
  {
    q: 'Are the characters real people?',
    a: 'No. Every character is an AI with their own personality and story. No real person reads or writes your chats.',
  },
  {
    q: 'Is my chat private?',
    a: 'Yes. Your chats are only for you. Our team never reads them, except for a safety review when something serious is reported, and that is logged. You can download or delete your data in Profile → Privacy & account.',
  },
  {
    q: 'How do I make a character forget something?',
    a: 'Go to Profile → What characters remember. You can delete single memories or everything a character knows about you.',
  },
  {
    q: 'I am going through something really hard',
    a: 'You matter. If you are in danger or thinking of hurting yourself, please call 112 now, or Tele-MANAS on 14416 (free, any time, in many languages).',
  },
];

const TOPICS: Array<{ id: string; label: string }> = [
  { id: 'payment', label: 'Payment' },
  { id: 'account', label: 'Account' },
  { id: 'bug', label: 'Something broken' },
  { id: 'feedback', label: 'Idea / feedback' },
  { id: 'delete_data', label: 'Delete my data' },
  { id: 'other', label: 'Other' },
];
const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.id, t.label]));

interface SupportItem {
  id: string;
  topic: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const HelpScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<number | null>(null);
  const [topic, setTopic] = useState('other');
  const [message, setMessage] = useState('');

  const { data: mine, isLoading } = useQuery({
    queryKey: ['support', 'mine'],
    queryFn: async () => (await api.get('/support')).data.data as SupportItem[],
  });

  // A team reply arrives as a notification: show it here right away.
  useEffect(() => Realtime.on((e) => e.type === 'notification.new' && void queryClient.invalidateQueries({ queryKey: ['support', 'mine'] })), [queryClient]);

  const send = useMutation({
    mutationFn: async () => (await api.post('/support', { topic, message: message.trim() })).data.data,
    onSuccess: () => {
      setMessage('');
      ToastService.show({ message: 'Sent. We usually reply within a day 💜', type: 'success', duration: 3000 });
      void queryClient.invalidateQueries({ queryKey: ['support', 'mine'] });
    },
    onError: (err: { message?: string }) => ToastService.show({ message: err?.message || 'Could not send. Please try again.', type: 'error', duration: 3500 }),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.headerTitle}>Help & contact us</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Quick answers</Text>
        <View style={styles.card}>
          {FAQ.map((f, i) => (
            <View key={f.q} style={[styles.faq, i > 0 && styles.divider]}>
              <Pressable onPress={() => setOpen(open === i ? null : i)} style={styles.faqQ} accessibilityRole="button" accessibilityState={{ expanded: open === i }}>
                <Text style={styles.faqQText}>{f.q}</Text>
                <Icon name={open === i ? 'close' : 'plus'} size={12} color={darkThemeColors.textMuted} />
              </Pressable>
              {open === i && (
                <Text style={styles.faqA}>
                  {f.a}
                  {i === FAQ.length - 1 && (
                    <Text style={styles.link} onPress={() => Linking.openURL('tel:14416').catch(() => undefined)}>
                      {'\n'}Call 14416
                    </Text>
                  )}
                </Text>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.section}>Message the team</Text>
        <View style={styles.card}>
          <View style={styles.chips}>
            {TOPICS.map((t) => (
              <Pressable key={t.id} onPress={() => setTopic(t.id)} style={[styles.chip, topic === t.id && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: topic === t.id }}>
                <Text style={[styles.chipText, topic === t.id && styles.chipTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what happened — the more detail, the faster we can help."
            placeholderTextColor={darkThemeColors.textMuted}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Button label={send.isPending ? 'Sending…' : 'Send'} variant="primary" size="md" fullWidth disabled={send.isPending || message.trim().length < 3} onPress={() => send.mutate()} />
          <Text style={styles.note}>We reply here and send you a notification.</Text>
        </View>

        {(isLoading || (mine && mine.length > 0)) && <Text style={styles.section}>Your messages</Text>}
        {isLoading && <ActivityIndicator color={darkThemeColors.accent} />}
        {mine?.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.msgHead}>
              <Text style={styles.msgTopic}>{TOPIC_LABEL[m.topic] ?? 'Other'}</Text>
              <Text style={[styles.status, m.status === 'answered' && styles.statusAnswered]}>
                {m.status === 'open' ? 'Waiting for a reply' : m.status === 'answered' ? 'Replied' : 'Closed'}
              </Text>
            </View>
            <Text style={styles.msgText}>{m.message}</Text>
            <Text style={styles.msgWhen}>{when(m.createdAt)}</Text>
            {m.reply && (
              <View style={styles.reply}>
                <Text style={styles.replyFrom}>Lovira team{m.repliedAt ? ` · ${when(m.repliedAt)}` : ''}</Text>
                <Text style={styles.replyText}>{m.reply}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl ?? 48, gap: spacing.md },
  section: { color: darkThemeColors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.sm },
  card: { backgroundColor: darkThemeColors.surface, borderRadius: 16, borderWidth: 1, borderColor: darkThemeColors.border, padding: spacing.md, gap: spacing.sm },
  faq: { paddingVertical: 2 },
  divider: { borderTopWidth: 1, borderTopColor: darkThemeColors.border, paddingTop: spacing.sm },
  faqQ: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 6 },
  faqQText: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  faqA: { color: darkThemeColors.textSecondary, fontSize: 14, lineHeight: 20, paddingBottom: 6 },
  link: { color: '#F472B6', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: darkThemeColors.border },
  chipOn: { borderColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.12)' },
  chipText: { color: darkThemeColors.textSecondary, fontSize: 13 },
  chipTextOn: { color: '#F472B6', fontWeight: '600' },
  input: {
    minHeight: 110,
    textAlignVertical: 'top',
    color: darkThemeColors.textPrimary,
    backgroundColor: darkThemeColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  note: { color: darkThemeColors.textMuted, fontSize: 12, textAlign: 'center' },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgTopic: { color: darkThemeColors.textPrimary, fontSize: 14, fontWeight: '700' },
  status: { color: darkThemeColors.warning, fontSize: 12, fontWeight: '600' },
  statusAnswered: { color: darkThemeColors.success },
  msgText: { color: darkThemeColors.textSecondary, fontSize: 14, lineHeight: 20 },
  msgWhen: { color: darkThemeColors.textMuted, fontSize: 12 },
  reply: { marginTop: 4, borderRadius: 12, padding: spacing.md, backgroundColor: 'rgba(236,72,153,0.10)', gap: 4 },
  replyFrom: { color: '#F472B6', fontSize: 12, fontWeight: '700' },
  replyText: { color: darkThemeColors.textPrimary, fontSize: 14, lineHeight: 20 },
});
