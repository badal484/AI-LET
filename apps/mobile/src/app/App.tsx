import { LimitReached } from '../services/limitReached.js';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from '@react-navigation/native';
import {
  ScreenContainer,
  Typography,
  Card,
  Button,
  Toast,
  ErrorBoundary,
} from '../components/common/index.js';
import { spacing, darkThemeColors } from '../theme/index.js';
import { useAuthStore } from '../stores/authStore.js';
import { AuthNavigator } from '../navigation/AuthNavigator.js';
import { OnboardingNavigator } from '../navigation/OnboardingNavigator.js';
import { RootNavigator } from '../navigation/RootNavigator.js';
import type { RootStackParamList } from '../navigation/types.js';
import { installStorageEngines } from '../services/storage/storageEngines.js';
import { Analytics } from '../services/analytics/AnalyticsSDK.js';
import { APP_VERSION } from '../config/appInfo.js';
import { api } from '../services/api/client.js';
import { AppNotices } from '../components/AppNotices.js';
import { PushPrimerHost } from '../components/PushPrimer.js';
import { PushService } from '../services/push/PushService.js';
import { openAppLink } from '../navigation/openAppLink.js';
import { Realtime } from '../services/realtime/RealtimeClient.js';
import { useTypingStore } from '../stores/typingStore.js';
import { useBillingStore } from '../stores/billingStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import { CampaignMessages } from '../components/CampaignMessages.js';

// Persistent storage must be attached before anything reads a session, draft or queued event.
installStorageEngines();
Analytics.initialize({ appVersion: APP_VERSION }).catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One quick retry (network blips) — then surface the error with a Retry button.
      retry: 1,
      retryDelay: 800,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['companion://', 'https://companion.ai'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Discover: 'discover',
          Conversations: 'messages',
          Profile: 'profile',
        },
      },
      Chat: 'chat/:characterId',
      CharacterDetail: {
        path: 'character/:characterSlug',
        alias: ['c/:characterSlug'],
      },
      Search: 'search',
      Paywall: 'paywall',
      NotificationCenter: 'notifications',
      Reminders: 'reminders',
      MemorySettings: 'memory',
      SafetyPrivacySettings: 'privacy',
      SubscriptionManagement: 'subscription',
      CreditWallet: 'wallet',
      CreatorProfile: 'creator/:username',
    },
  },
};

export const AppContent: React.FC = () => {
  const { status, user, bootstrap, logout } = useAuthStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const currentRoute = useRef<string | undefined>(undefined);

  // Out of messages for today: open the paywall (trial offer, or a message pack for Premium users).
  useEffect(
    () =>
      LimitReached.on((payload) => {
        if (navigationRef.isReady()) navigationRef.navigate('Paywall', { reason: payload.reason, resetsAt: payload.resetsAt });
      }),
    [navigationRef],
  );

  // Analytics identity follows the verified session (the server still attributes by token).
  const userId = user?.id;
  useEffect(() => {
    if (status === 'authenticated' && userId) {
      Analytics.identify(userId);
      // Keep the profile's timezone in sync with the phone: quiet hours, "good morning" and
      // "today" on the server all depend on it.
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (deviceTimezone && deviceTimezone !== user?.profile?.timezone) {
        api.patch('/users/profile', { timezone: deviceTimezone }).catch(() => undefined);
      }
    } else if (status === 'unauthenticated' || status === 'session-expired') {
      Analytics.reset().catch(() => undefined);
    }
  }, [status, userId]);

  const trackScreen = () => {
    const name = navigationRef.getCurrentRoute()?.name;
    if (name && name !== currentRoute.current) {
      currentRoute.current = name;
      Analytics.trackScreen(name);
    }
  };

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Push notifications: listen from the start, register this phone once signed in, and let a
  // tapped notification open its chat (waits for sign-in when the app was closed).
  useEffect(() => {
    void PushService.start();
    PushService.setNavigator({
      open: ({ characterId, conversationId, deepLink }) => {
        if (!navigationRef.isReady()) return;
        // A chat reply opens that exact conversation; anything else follows its link.
        if (characterId && (!deepLink || deepLink.startsWith('companion://chat/'))) navigationRef.navigate('Chat', { characterId, conversationId });
        else openAppLink(navigationRef, deepLink);
      },
      isViewingChat: (characterId) => {
        const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
        return route?.name === 'Chat' && (route.params as { characterId?: string } | undefined)?.characterId === characterId;
      },
    });
    const offChatPush = PushService.onChatPush(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }));
    return () => {
      offChatPush();
      PushService.setNavigator(null);
    };
  }, [navigationRef]);

  const onboarded = Boolean(
    user?.profile?.onboardingCompleted || user?.profile?.onboardingStatus === 'COMPLETED' || user?.profile?.onboardingStatus === 'SKIPPED',
  );
  useEffect(() => {
    void PushService.setSignedIn(status === 'authenticated' && Boolean(userId) && onboarded);
    Realtime.setSignedIn(status === 'authenticated' && Boolean(userId) && onboarded);
    if (status !== 'authenticated') useTypingStore.getState().clear();
  }, [status, userId, onboarded]);

  // Live updates while the app is open: "typing…" and new messages in Chats, unread counts.
  useEffect(() => {
    Realtime.start();
    return Realtime.on((event) => {
      if (event.type === 'typing') useTypingStore.getState().set(event.conversationId, event.typing);
      else if (event.type === 'conversation.updated') {
        useTypingStore.getState().set(event.conversationId, false);
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['messages', event.conversationId] });
      } else if (event.type === 'billing.updated') {
        // Premium switched on / off, messages added, limit reset: show it now.
        void useBillingStore.getState().loadBillingState();
        void queryClient.invalidateQueries({ queryKey: ['billing'] });
      } else if (event.type === 'notification.new') {
        void useNotificationStore.getState().fetchUnreadCount();
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } else if (event.type === 'session.revoked') {
        // Blocked or signed out by the team: leave now, not at the next tap.
        void useAuthStore.getState().logout();
      } else if (event.type === 'hello') {
        // (Re)connected: catch up on anything missed while offline.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    });
  }, []);

  if (status === 'initializing') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={darkThemeColors.accent} />
      </View>
    );
  }

  if (status === 'account-suspended') {
    return (
      <ScreenContainer style={styles.suspendedContainer}>
        <Card variant="glass" padding="xl">
          <Typography
            variant="displayMedium"
            style={{ color: darkThemeColors.danger, marginBottom: spacing.sm }}
          >
            Account Suspended
          </Typography>
          <Typography
            variant="bodyMedium"
            style={{ color: darkThemeColors.textSecondary, marginBottom: spacing.lg }}
          >
            Your account has been suspended for violating platform safety terms. Please contact support if you believe this is an error.
          </Typography>
          <Button label="Sign Out" variant="secondary" size="md" onPress={logout} />
        </Card>
      </ScreenContainer>
    );
  }

  if (status === 'authenticated' && user) {
    const isOnboardingComplete =
      user.profile?.onboardingCompleted ||
      user.profile?.onboardingStatus === 'COMPLETED' ||
      user.profile?.onboardingStatus === 'SKIPPED';

    return (
      <>
        <NavigationContainer linking={linking} ref={navigationRef} onReady={trackScreen} onStateChange={trackScreen}>
          {isOnboardingComplete ? <RootNavigator /> : <OnboardingNavigator />}
        </NavigationContainer>
        {isOnboardingComplete && <CampaignMessages navigationRef={navigationRef} />}
      </>
    );
  }

  return (
    <NavigationContainer linking={linking as any} ref={navigationRef} onReady={trackScreen} onStateChange={trackScreen}>
      <AuthNavigator />
    </NavigationContainer>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar
            barStyle="light-content"
          />
          <AppContent />
          <AppNotices />
          <PushPrimerHost />
          <Toast />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suspendedContainer: {
    padding: spacing.xl,
    justifyContent: 'center',
  },
});

export default App;
