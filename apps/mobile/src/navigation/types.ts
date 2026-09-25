import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Conversations: undefined;
  BuyPro: undefined;
  Profile: undefined;
  Discover?: undefined;
  // Legacy alias for backwards compatibility
  Explore?: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Chat: {
    characterId: string;
    conversationId?: string;
    initialPrompt?: string;
  };
  CharacterDetail: {
    characterId: string;
    characterSlug?: string;
    initialPrompt?: string;
  };
  CategoryBrowser: {
    categorySlug: string;
    categoryName?: string;
  };
  CollectionDetail: {
    collectionSlug: string;
    title?: string;
  };
  Search: {
    initialQuery?: string;
    category?: string;
  } | undefined;
  Paywall: {
    feature?: string;
  } | undefined;
  SubscriptionManagement: undefined;
  CreditWallet: undefined;
  Settings: undefined;
  PreferencesSettings: undefined;
  MemorySettings: undefined;
  PersonalizationSettings: undefined;
  NotificationSettings: undefined;
  NotificationCenter: undefined;
  Reminders: undefined;
  VoiceSettings: undefined;
  SafetyPrivacySettings: undefined;
  VoiceCall: {
    characterId: string;
    conversationId?: string;
    characterName?: string;
    characterAvatarUrl?: string;
    voiceConfig?: any;
  };
  CreatorProfile: {
    username: string;
  };
  // Phase 24 social layer
  SocialFeed: undefined;
  SocialProfile: { handle: string };
  SocialFollowList: { handle: string; direction: 'followers' | 'following' };
  SocialContent: { publicId: string };
  ShareConversation: { conversationId: string };
  SocialInbox: undefined;
  SocialThread: { threadId?: string; recipient?: string; displayName?: string };
  Community: { slug: string };
  SocialPrivacySettings: undefined;
  SocialProfileSetup: undefined;
  // Phase 25: Guided Experiences, Goals & Tasks
  Experiences: { characterId?: string } | undefined;
  ExperienceDetail: { experienceSlug: string; title: string; characterId?: string };
  ActiveGoals: undefined;
  // Phase 26: Knowledge Documents, RAG & Web Research
  KnowledgeDocuments: undefined;
  DocumentViewer: { documentId: string; title: string; filename?: string; mimeType?: string; status?: string };
  WebResearchViewer: { taskId: string; query: string };
};
