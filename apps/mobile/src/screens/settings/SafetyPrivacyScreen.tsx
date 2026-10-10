import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon, IconButton, type IconName } from '../../components/common/index.js';
import { privacyApi, type BlockedItem } from '../../services/api/privacyApi.js';
import { darkThemeColors, spacing } from '../../theme/index.js';

/**
 * Privacy & account, kept to what people actually need: making the characters forget them, characters
 * they blocked, and deleting the account (14-day grace period; required by Google Play and the DPDP Act).
 * A copy of their data is asked for in Help & contact us ("Get a copy of my data"); the team replies.
 */

export const SafetyPrivacyScreen: React.FC = () => {
  const navigation = useNavigation();
  const [blocks, setBlocks] = useState<BlockedItem[]>([]);
  const [busy, setBusy] = useState<'forget' | 'delete' | null>(null);

  useEffect(() => {
    privacyApi.getBlocks().then(setBlocks).catch(() => undefined);
  }, []);

  const forget = () =>
    Alert.alert('Make every character forget you?', 'They will forget everything they remembered about you — your name, your life, your goals. Your chats stay. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget me',
        style: 'destructive',
        onPress: async () => {
          setBusy('forget');
          try {
            const r = await privacyApi.purgeMemories();
            Alert.alert('Done', r.deletedCount ? `${r.deletedCount} memories deleted.` : 'There was nothing to forget.');
          } catch {
            Alert.alert('Could not delete', 'Please try again later.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'Your account, chats and memories will be deleted after 14 days. Sign in before then to cancel. Premium bought through Google Play must be cancelled in the Play Store.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              const r = await privacyApi.requestAccountDeletion('User-initiated from app');
              Alert.alert('Account will be deleted', `On ${new Date(r.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Sign in before then to keep it.`);
            } catch {
              Alert.alert('Could not delete', 'Please write to us from Help & contact us.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );

  const unblock = (b: BlockedItem) =>
    Alert.alert(`Unblock ${b.targetDisplayName || 'this character'}?`, 'They will show up again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await privacyApi.removeBlock(b.id);
            setBlocks((all) => all.filter((x) => x.id !== b.id));
          } catch {
            Alert.alert('Could not unblock', 'Please try again.');
          }
        },
      },
    ]);

  const action = (icon: IconName, title: string, sub: string, onPress: () => void, key: typeof busy, first = false, danger = false) => (
    <Pressable style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && styles.pressed]} onPress={onPress} disabled={busy !== null} accessibilityRole="button">
      <View style={[styles.icon, danger && styles.iconDanger]}>
        <Icon name={icon} size={16} color={danger ? darkThemeColors.danger : darkThemeColors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: darkThemeColors.danger }]}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {busy === key ? <ActivityIndicator size="small" color={darkThemeColors.accent} /> : <Icon name="arrow-right" size={12} color={darkThemeColors.textMuted} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.title}>Privacy & account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          Your chats are private. Our team never reads them, except a logged safety review if something serious is reported. Want a copy of your data? Ask us in Help & contact us.
        </Text>

        <View style={styles.card}>
          {action('brain', 'Make characters forget me', 'Delete everything they remember about you', forget, 'forget', true)}
        </View>

        {blocks.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Blocked</Text>
            {blocks.map((b) => (
              <View key={b.id} style={[styles.row, styles.rowBorder]}>
                <Text style={[styles.rowTitle, { flex: 1 }]}>{b.targetDisplayName || 'Character'}</Text>
                <Pressable onPress={() => unblock(b)} hitSlop={8}>
                  <Text style={styles.unblock}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>{action('trash', 'Delete account', 'Deleted after 14 days — sign in to cancel', deleteAccount, 'delete', true, true)}</View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  note: { color: darkThemeColors.textSecondary, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: darkThemeColors.surface, borderRadius: 16, borderWidth: 1, borderColor: darkThemeColors.border, paddingHorizontal: spacing.md },
  cardTitle: { color: darkThemeColors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: darkThemeColors.border },
  pressed: { opacity: 0.7 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,92,246,0.14)' },
  iconDanger: { backgroundColor: 'rgba(239,68,68,0.12)' },
  rowTitle: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  unblock: { color: '#F472B6', fontSize: 14, fontWeight: '600' },
});
