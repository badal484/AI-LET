import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainTabNavigator } from './MainTabNavigator.js';
import { ChatScreen } from '../screens/chat/ChatScreen.js';
import { CharacterDetailScreen } from '../screens/explore/CharacterDetailScreen.js';
import { CreatorProfileScreen } from '../screens/explore/CreatorProfileScreen.js';
import { CategoryBrowserScreen } from '../screens/explore/CategoryBrowserScreen.js';
import { CollectionDetailScreen } from '../screens/explore/CollectionDetailScreen.js';
import { SearchScreen } from '../screens/explore/SearchScreen.js';
import { PreferencesSettingsScreen } from '../screens/settings/PreferencesSettingsScreen.js';
import { MemorySettingsScreen } from '../screens/memory/MemorySettingsScreen.js';
import { PersonalizationSettingsScreen } from '../screens/settings/PersonalizationSettingsScreen.js';
import { NotificationPreferencesScreen } from '../screens/settings/NotificationPreferencesScreen.js';
import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen.js';
import { RemindersScreen } from '../screens/notifications/RemindersScreen.js';
import { VoiceCallScreen } from '../screens/voice/VoiceCallScreen.js';
import { VoiceSettingsScreen } from '../screens/voice/VoiceSettingsScreen.js';
import { SafetyPrivacyScreen } from '../screens/settings/SafetyPrivacyScreen.js';
import { PaywallScreen } from '../screens/subscription/PaywallScreen.js';
import { SubscriptionManagementScreen } from '../screens/subscription/SubscriptionManagementScreen.js';
import { CreditWalletScreen } from '../screens/subscription/CreditWalletScreen.js';
import { SocialContentScreen, SocialFeedScreen, ShareConversationScreen } from '../features/social/screens/SocialContentScreens.js';
import { SocialFollowListScreen, SocialInboxScreen, SocialProfileScreen, SocialProfileSetupScreen, SocialThreadScreen } from '../features/social/screens/SocialPeopleScreens.js';
import { CommunityScreen, SocialPrivacySettingsScreen } from '../features/social/screens/SocialSettingsScreens.js';
import { ExperiencesScreen } from '../screens/experiences/ExperiencesScreen.js';
import { KnowledgeDocumentsScreen } from '../screens/knowledge/KnowledgeDocumentsScreen.js';
import { CreateCharacterScreen } from '../screens/creator/CreateCharacterScreen.js';
import type { RootStackParamList } from './types.js';

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#090A0F' },
      }}
      initialRouteName="MainTabs"
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="CreateCharacter" component={CreateCharacterScreen} />
      <Stack.Screen name="CharacterDetail" component={CharacterDetailScreen} />
      <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
      <Stack.Screen name="CategoryBrowser" component={CategoryBrowserScreen} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} />
      <Stack.Screen name="CreditWallet" component={CreditWalletScreen} />
      <Stack.Screen name="PreferencesSettings" component={PreferencesSettingsScreen} />
      <Stack.Screen name="MemorySettings" component={MemorySettingsScreen} />
      <Stack.Screen name="PersonalizationSettings" component={PersonalizationSettingsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationPreferencesScreen} />
      <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
      <Stack.Screen name="SafetyPrivacySettings" component={SafetyPrivacyScreen} />
      <Stack.Screen name="SocialFeed" component={SocialFeedScreen} />
      <Stack.Screen name="SocialProfile" component={SocialProfileScreen} />
      <Stack.Screen name="SocialFollowList" component={SocialFollowListScreen} />
      <Stack.Screen name="SocialContent" component={SocialContentScreen} />
      <Stack.Screen name="ShareConversation" component={ShareConversationScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SocialInbox" component={SocialInboxScreen} />
      <Stack.Screen name="SocialThread" component={SocialThreadScreen} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="SocialPrivacySettings" component={SocialPrivacySettingsScreen} />
      <Stack.Screen name="SocialProfileSetup" component={SocialProfileSetupScreen} />
      <Stack.Screen name="Experiences" component={ExperiencesScreen} />
      <Stack.Screen name="KnowledgeDocuments" component={KnowledgeDocumentsScreen} />
      <Stack.Screen
        name="VoiceCall"
        component={VoiceCallScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};
