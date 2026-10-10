import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { Avatar, Button, Icon, ToastService, type IconName } from '../../components/common/index.js';
import { api } from '../../services/api/client.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { APP_VERSION } from '../../config/appInfo.js';
import { darkThemeColors, spacing } from '../../theme/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

/**
 * Profile: who you are, your plan, and four settings — nothing else.
 * (Older screens — credits wallet, documents, personalization — are no longer linked here.)
 */

interface Row {
  icon: IconName;
  title: string;
  subtitle: string;
  route: keyof RootStackParamList;
}

const ROWS: Row[] = [
  { icon: 'palette', title: 'Chat preferences', subtitle: 'Language and how characters talk to you', route: 'PreferencesSettings' },
  { icon: 'bell', title: 'Notifications', subtitle: 'What reaches you, quiet hours, reminders', route: 'NotificationSettings' },
  { icon: 'shield', title: 'Privacy & account', subtitle: 'Your data, blocked characters, delete account', route: 'SafetyPrivacySettings' },
  { icon: 'chat', title: 'Help & contact us', subtitle: 'Quick answers, or write to the team', route: 'Help' },
];

interface Allowance {
  premium: boolean;
  used: number;
  limit: number;
  credits?: number;
  resetsAt: string;
  enforced: boolean;
}

const ACTIVE = ['active', 'trialing', 'grace_period', 'cancelled'];
const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuthStore();
  const { subscription, loadBillingState } = useBillingStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const displayName = user?.profile?.displayName || user?.email?.split('@')[0] || 'You';

  useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  const { data: allowance } = useQuery({
    queryKey: ['billing', 'allowance'],
    queryFn: async () => (await api.get('/billing/allowance')).data.data as Allowance,
    staleTime: 30_000,
  });
  // Shares the Chats list's cache: no extra request when Chats was opened.
  const { data: chats } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => ConversationApi.listConversations({ limit: 50 }),
    staleTime: 60_000,
  });
  const characters = chats?.items?.length ?? 0;

  const status = String(subscription?.status ?? '').toLowerCase();
  const premium = Boolean(subscription && ACTIVE.includes(status)) || Boolean(allowance?.premium);
  const trial = status === 'trialing';
  const cancelling = Boolean(subscription?.cancelAtPeriodEnd) || status === 'cancelled';
  const left = allowance ? Math.max(0, allowance.limit - allowance.used) : null;

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === displayName) return setEditing(false);
    setSaving(true);
    try {
      await api.patch('/users/profile', { displayName: next.slice(0, 50) });
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, profile: { ...(s.user.profile ?? {}), displayName: next } as never } } : s));
      ToastService.show({ message: 'Name updated', type: 'success', duration: 2000 });
      setEditing(false);
    } catch {
      ToastService.show({ message: 'Could not save. Please try again.', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const signOut = () =>
    Alert.alert('Sign out?', 'Your chats and memories stay safe — sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* You */}
        <View style={styles.me}>
          <Avatar name={displayName} size="lg" />
          <View style={styles.meText}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>
            {characters > 0 && (
              <Text style={styles.stat}>
                Chatting with {characters} {characters === 1 ? 'character' : 'characters'}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              setName(displayName);
              setEditing(true);
            }}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Plan */}
        <Pressable
          style={[styles.plan, premium && styles.planPremium]}
          onPress={() => navigation.navigate(premium ? 'SubscriptionManagement' : ('Paywall' as never), {} as never)}
          accessibilityRole="button"
        >
          <View style={styles.planHead}>
            <Icon name={premium ? 'diamond' : 'sparkles'} size={18} color={premium ? '#F472B6' : darkThemeColors.accent} />
            <Text style={styles.planTitle}>{premium ? (trial ? 'Premium trial' : 'Premium') : 'Free plan'}</Text>
          </View>
          {premium ? (
            <Text style={styles.planText}>
              {subscription?.currentPeriodEnd
                ? cancelling
                  ? `Ends on ${date(subscription.currentPeriodEnd)} — you won't be charged again`
                  : trial
                    ? `Becomes ₹399/month on ${date(subscription.currentPeriodEnd)}`
                    : `Renews on ${date(subscription.currentPeriodEnd)}`
                : 'All characters, 150 messages a day'}
              {allowance && allowance.enforced ? ` · ${left} messages left today` : ''}
            </Text>
          ) : (
            <>
              <Text style={styles.planText}>
                {allowance && allowance.enforced
                  ? `${left} of ${allowance.limit} free messages left today${allowance.credits ? ` · +${allowance.credits} extra` : ''}`
                  : 'A few free messages every day'}
              </Text>
              <View style={styles.planCta}>
                <Text style={styles.planCtaText}>Try Premium for ₹1</Text>
              </View>
            </>
          )}
          {premium && <Text style={styles.manage}>Manage ›</Text>}
        </Pressable>

        {/* Settings */}
        <View style={styles.list}>
          {ROWS.map((r, i) => (
            <Pressable
              key={r.route}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate(r.route as never)}
              accessibilityRole="button"
              accessibilityLabel={r.title}
            >
              <View style={styles.rowIcon}>
                <Icon name={r.icon} size={18} color={darkThemeColors.accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowSub}>{r.subtitle}</Text>
              </View>
              <Icon name="arrow-right" size={14} color={darkThemeColors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Button label="Sign out" variant="secondary" size="md" fullWidth onPress={signOut} accessibilityLabel="Sign out" />
        <Text style={styles.version}>Lovira v{APP_VERSION}</Text>
      </ScrollView>

      {/* Edit name */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Your name</Text>
            <Text style={styles.sheetSub}>This is what characters call you.</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
              placeholder="Your name"
              placeholderTextColor={darkThemeColors.textMuted}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
            />
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" size="md" onPress={() => setEditing(false)} />
              <Button label={saving ? 'Saving…' : 'Save'} variant="primary" size="md" disabled={saving || !name.trim()} onPress={() => void saveName()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  title: { color: darkThemeColors.textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.lg },
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meText: { flex: 1, minWidth: 0 },
  name: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  email: { color: darkThemeColors.textMuted, fontSize: 13, marginTop: 2 },
  stat: { color: darkThemeColors.textSecondary, fontSize: 13, marginTop: 4 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: darkThemeColors.border },
  editText: { color: darkThemeColors.textPrimary, fontSize: 13, fontWeight: '600' },
  plan: { borderRadius: 20, padding: spacing.lg, backgroundColor: darkThemeColors.surface, borderWidth: 1, borderColor: darkThemeColors.border, gap: 6 },
  planPremium: { borderColor: 'rgba(236,72,153,0.45)', backgroundColor: 'rgba(236,72,153,0.08)' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { color: darkThemeColors.textPrimary, fontSize: 17, fontWeight: '700' },
  planText: { color: darkThemeColors.textSecondary, fontSize: 14, lineHeight: 20 },
  planCta: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#8B5CF6' },
  planCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  manage: { color: '#F472B6', fontSize: 14, fontWeight: '600', marginTop: 4 },
  list: { borderRadius: 20, backgroundColor: darkThemeColors.surface, borderWidth: 1, borderColor: darkThemeColors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: darkThemeColors.border },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,92,246,0.14)' },
  rowText: { flex: 1 },
  rowTitle: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  version: { color: darkThemeColors.textMuted, fontSize: 12, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: darkThemeColors.surface, borderRadius: 20, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { color: darkThemeColors.textPrimary, fontSize: 18, fontWeight: '700' },
  sheetSub: { color: darkThemeColors.textMuted, fontSize: 13 },
  input: {
    color: darkThemeColors.textPrimary,
    backgroundColor: darkThemeColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkThemeColors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
});
