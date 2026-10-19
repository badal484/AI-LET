import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore.js';
import { useBillingStore } from '../../stores/billingStore.js';
import { Avatar, Icon, ToastService, type IconName } from '../../components/common/index.js';
import { api } from '../../services/api/client.js';
import { ConversationApi } from '../../services/api/conversationApi.js';
import { APP_VERSION } from '../../config/appInfo.js';
import { darkThemeColors, spacing } from '../../theme/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { AppAlert } from '../../components/common/AppDialog.js';
import { GradientFill } from '../../components/common/GradientFill.js';
import { CoinStoreSheet } from '../../components/billing/CoinStoreSheet.js';

/**
 * Profile: who you are, your plan, and four settings — nothing else.
 * (Older screens — credits wallet, documents, personalization — are no longer linked here.)
 */

interface Row {
  icon: IconName;
  color: string;
  tint: string;
  title: string;
  subtitle: string;
  route: keyof RootStackParamList;
}

const ROWS: Row[] = [
  { icon: 'palette', color: '#C4B5FD', tint: 'rgba(139,92,246,0.16)', title: 'Chat preferences', subtitle: 'Language, how they address you', route: 'PreferencesSettings' },
  { icon: 'bell', color: '#F9A8D4', tint: 'rgba(236,72,153,0.14)', title: 'Notifications', subtitle: 'Messages, reminders, quiet hours', route: 'NotificationSettings' },
  { icon: 'shield', color: '#6EE7B7', tint: 'rgba(16,185,129,0.14)', title: 'Privacy & account', subtitle: 'Your data, delete account', route: 'SafetyPrivacySettings' },
  { icon: 'chat', color: '#93C5FD', tint: 'rgba(59,130,246,0.14)', title: 'Help & contact us', subtitle: 'Quick answers, write to us', route: 'Help' },
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
  const coins = useBillingStore((st) => st.creditWallet?.availableBalance ?? 0);
  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
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
    AppAlert.alert('Sign out?', 'Your chats and memories stay safe — sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        {/* A soft glow behind the top, then you: big avatar with a ring, your name, your email. */}
        <View style={styles.glow} pointerEvents="none">
          <GradientFill radial colors={[['#A855F7', 0.32], ['#EC4899', 0.08], ['#0B0614', 0]]} />
        </View>

        <View style={styles.me}>
          <View style={styles.ring}>
            <GradientFill colors={['#A855F7', '#EC4899']} />
            <View style={styles.ringInner}>
              <Avatar name={displayName} size="xl" />
            </View>
          </View>
          <Pressable
            onPress={() => {
              setName(displayName);
              setEditing(true);
            }}
            style={styles.nameRow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.editDot}>
              <Icon name="pencil" size={12} color="#E9D5FF" />
            </View>
          </Pressable>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>

        {/* Three numbers that matter. */}
        <View style={styles.stats}>
          <Pressable style={styles.stat} onPress={() => navigation.navigate('Conversations' as never)} accessibilityRole="button">
            <Text style={styles.statValue}>{characters}</Text>
            <Text style={styles.statLabel}>{characters === 1 ? 'Chat' : 'Chats'}</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.stat} onPress={() => setCoinStoreOpen(true)} accessibilityRole="button" accessibilityLabel={`${coins} coins, get more`}>
            <Text style={styles.statValue}>🪙 {coins.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{allowance?.enforced && left !== null ? left : premium ? '150' : '—'}</Text>
            <Text style={styles.statLabel}>Left today</Text>
          </View>
        </View>

        {/* Plan */}
        <Pressable
          style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
          onPress={() => navigation.navigate(premium ? 'SubscriptionManagement' : ('Paywall' as never), {} as never)}
          accessibilityRole="button"
        >
          <GradientFill colors={premium ? ['#4C1D95', '#831843'] : ['#6D28D9', '#DB2777']} />
          <View style={styles.planHead}>
            <View style={styles.crown}>
              <Icon name="diamond" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>{premium ? (trial ? 'Premium · first day' : 'Premium') : 'Loveek Premium'}</Text>
              <Text style={styles.planText} numberOfLines={1}>
                {premium
                  ? subscription?.currentPeriodEnd
                    ? cancelling
                      ? `Ends on ${date(subscription.currentPeriodEnd)}`
                      : trial
                        ? `₹499/month from ${date(subscription.currentPeriodEnd)}`
                        : `Renews on ${date(subscription.currentPeriodEnd)}`
                    : 'Everyone, 150 messages a day'
                  : 'Everyone, 150 messages a day'}
              </Text>
            </View>
            {premium ? (
              <Icon name="arrow-right" size={18} color="#FFFFFF" />
            ) : (
              <View style={styles.planCta}>
                <Text style={styles.planCtaText}>Start ₹1</Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Settings */}
        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.list}>
          {ROWS.map((r, i) => (
            <Pressable
              key={r.route}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate(r.route as never)}
              accessibilityRole="button"
              accessibilityLabel={r.title}
            >
              <View style={[styles.rowIcon, { backgroundColor: r.tint }]}>
                <Icon name={r.icon} size={18} color={r.color} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowSub}>{r.subtitle}</Text>
              </View>
              <Icon name="arrow-right" size={14} color={darkThemeColors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel="Sign out">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Text style={styles.version}>Loveek v{APP_VERSION}</Text>
      </ScrollView>

      <CoinStoreSheet visible={coinStoreOpen} onClose={() => setCoinStoreOpen(false)} />

      {/* Edit name */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <GradientFill radial colors={[['#A855F7', 0.28], ['#EC4899', 0.06], ['#1A1428', 0]]} />
            <View style={styles.sheetBadge}>
              <Icon name="pencil" size={20} color="#E9D5FF" />
            </View>
            <Text style={styles.sheetTitle}>What should they call you?</Text>
            <Text style={styles.sheetSub}>Everyone you talk to will use this name.</Text>
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
              <Pressable onPress={() => setEditing(false)} style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]} accessibilityRole="button">
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveName()}
                disabled={saving || !name.trim()}
                style={({ pressed }) => [styles.sheetBtn, (saving || !name.trim()) && styles.sheetOff, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <GradientFill colors={['#7C3AED', '#DB2777']} />
                <Text style={styles.sheetSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0614' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },
  glow: { position: 'absolute', top: 0, left: -spacing.lg, right: -spacing.lg, height: 320 },
  me: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xs },
  ring: { width: 104, height: 104, borderRadius: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 98, height: 98, borderRadius: 49, backgroundColor: '#0B0614', alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, maxWidth: '90%' },
  name: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  editDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,85,247,0.3)' },
  email: { color: darkThemeColors.textMuted, fontSize: 13, marginTop: 4 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  statLabel: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  plan: { borderRadius: 20, padding: spacing.md, overflow: 'hidden' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  crown: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  planTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  planText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  planCta: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFFFFF' },
  planCtaText: { color: '#6D28D9', fontSize: 15, fontWeight: '800' },
  sectionLabel: { color: darkThemeColors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.sm, marginLeft: 4 },
  list: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  signOut: { alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  signOutText: { color: '#F87171', fontSize: 15, fontWeight: '700' },
  version: { color: darkThemeColors.textDisabled, fontSize: 12, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,2,10,0.7)', justifyContent: 'center', padding: 28 },
  sheet: {
    backgroundColor: '#1A1428',
    borderRadius: 28,
    padding: 22,
    gap: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
  },
  sheetBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.35)',
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  sheetSub: { color: '#C9C2D9', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  sheetBtn: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sheetCancel: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sheetCancelText: { color: '#E6E0F2', fontSize: 15, fontWeight: '700' },
  sheetSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sheetOff: { opacity: 0.5 },
  input: {
    color: '#FFFFFF',
    backgroundColor: '#120D1D',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
});
