import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../../stores/authStore.js';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Icon,
  IconName,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

interface MenuItemConfig {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  route: keyof RootStackParamList;
  accessibilityLabel: string;
}

const MENU_ITEMS: MenuItemConfig[] = [
  {
    id: 'preferences',
    icon: 'sparkles',
    title: 'Preferences & Style',
    subtitle: 'Adjust language, pacing, and discovery filters',
    route: 'PreferencesSettings',
    accessibilityLabel: 'Preferences and conversation tone',
  },
  {
    id: 'subscription',
    icon: 'zap',
    title: 'Subscription & Quotas',
    subtitle: 'Manage active plan, renewal, and tier upgrades',
    route: 'SubscriptionManagement',
    accessibilityLabel: 'Subscription and quotas',
  },
  {
    id: 'credits',
    icon: 'star',
    title: 'AI Credits Wallet',
    subtitle: 'Balance, bonus promo codes, and credit packs',
    route: 'CreditWallet',
    accessibilityLabel: 'AI Credits wallet',
  },
  {
    id: 'memory',
    icon: 'brain',
    title: 'Memory & Continuity',
    subtitle: 'View, edit, or wipe remembered facts',
    route: 'MemorySettings',
    accessibilityLabel: 'Memory and privacy',
  },
  {
    id: 'knowledge',
    icon: 'book',
    title: 'Knowledge & Documents',
    subtitle: 'Personal knowledge bases, uploaded files & citations',
    route: 'KnowledgeDocuments',
    accessibilityLabel: 'Knowledge, documents and research',
  },
  {
    id: 'personalization',
    icon: 'heart',
    title: 'Personalization & Rapport',
    subtitle: 'Manage conversational dynamics and companion relationships',
    route: 'PersonalizationSettings',
    accessibilityLabel: 'Personalization and rapport',
  },
  {
    id: 'notifications',
    icon: 'bell',
    title: 'Notification Inbox',
    subtitle: 'View past companion messages and alerts',
    route: 'NotificationCenter',
    accessibilityLabel: 'Notification inbox',
  },
  {
    id: 'reminders',
    icon: 'moon',
    title: 'Scheduled Reminders',
    subtitle: 'Manage reminders created during conversations',
    route: 'Reminders',
    accessibilityLabel: 'Scheduled reminders',
  },
  {
    id: 'notif_settings',
    icon: 'settings',
    title: 'Notification Preferences',
    subtitle: 'Quiet hours, lock-screen privacy, and channels',
    route: 'NotificationSettings',
    accessibilityLabel: 'Notification preferences',
  },
  {
    id: 'social',
    icon: 'compass',
    title: 'Social Feed',
    subtitle: 'Creators and characters you follow',
    route: 'SocialFeed',
    accessibilityLabel: 'Social feed',
  },
  {
    id: 'messages',
    icon: 'chat',
    title: 'Messages',
    subtitle: 'Conversations and message requests from people',
    route: 'SocialInbox',
    accessibilityLabel: 'Direct messages',
  },
  {
    id: 'social_privacy',
    icon: 'user',
    title: 'Social & Privacy',
    subtitle: 'Profile, who can contact you, permissions and blocks',
    route: 'SocialPrivacySettings',
    accessibilityLabel: 'Social and privacy settings',
  },
  {
    id: 'safety',
    icon: 'shield',
    title: 'Safety & Privacy',
    subtitle: 'Data controls, export, and account deletion',
    route: 'SafetyPrivacySettings',
    accessibilityLabel: 'Safety and privacy settings',
  },
];

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const displayName = user?.profile?.displayName || user?.email || 'User';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Manage your profile, settings, and subscriptions</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar name={displayName} size="xl" />
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Badge label="Active Session" variant="success" size="sm" />
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
            >
              <View style={styles.menuIconContainer}>
                <Icon name={item.icon} size={18} color={darkThemeColors.accent} />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              <Icon name="arrow-right" size={14} color={darkThemeColors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Divider marginVertical="lg" />

        <Button
          label="Sign Out"
          variant="secondary"
          size="md"
          fullWidth
          onPress={logout}
          accessibilityLabel="Sign out of account"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  header: {
    paddingTop: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: darkThemeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.borderSubtle,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: darkThemeColors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  profileCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    marginBottom: spacing.xl,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkThemeColors.textPrimary,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: darkThemeColors.textMuted,
    marginBottom: spacing.md,
  },
  menuSection: {
    gap: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: darkThemeColors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
    padding: spacing.md,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${darkThemeColors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuItemTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: darkThemeColors.textPrimary,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: darkThemeColors.textMuted,
    lineHeight: 16,
  },
  menuItemArrow: {
    fontSize: 22,
    color: darkThemeColors.textMuted,
    fontWeight: '400',
  },
});
