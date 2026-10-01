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
    characterName?: string;
    characterAvatarUrl?: string;
    characterSlug?: string;
  };
  CharacterDetail: {
    characterId: string;
    characterSlug?: string;
    initialPrompt?: string;
  };
  CreateCharacter: undefined;
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
  SafetyPrivacySettings: undefined;
  CreatorProfile: {
    username: string;
  };
  // Phase 26: Knowledge Documents, RAG & Web Research
  KnowledgeDocuments: undefined;
  DocumentViewer: { documentId: string; title: string; filename?: string; mimeType?: string; status?: string };
  WebResearchViewer: { taskId: string; query: string };
};
