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
import { bindSocialStateToAuth } from '../features/social/state/authBinding.js';
import { installStorageEngines } from '../services/storage/storageEngines.js';
import { Analytics } from '../services/analytics/AnalyticsSDK.js';
import { APP_VERSION } from '../config/appInfo.js';

// Persistent storage must be attached before anything reads a session, draft or queued event.
installStorageEngines();
bindSocialStateToAuth();
Analytics.initialize({ appVersion: APP_VERSION }).catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
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
      // Social deep links. Every target re-verifies existence, visibility, blocks and expiry server-side
      // and renders a graceful "unavailable" state instead of crashing on deleted content.
      SocialProfile: 'u/:handle',
      SocialContent: {
        path: 'p/:publicId',
        alias: ['share/:publicId'],
      },
      Community: 'community/:slug',
      SocialFeed: 'social',
      SocialInbox: 'messages/requests',
      SocialPrivacySettings: 'settings/social',
    },
  },
};

export const AppContent: React.FC = () => {
  const { status, user, bootstrap, logout } = useAuthStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const currentRoute = useRef<string | undefined>(undefined);

  // Analytics identity follows the verified session (the server still attributes by token).
  const userId = user?.id;
  useEffect(() => {
    if (status === 'authenticated' && userId) {
      Analytics.identify(userId);
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
      <NavigationContainer linking={linking} ref={navigationRef} onReady={trackScreen} onStateChange={trackScreen}>
        {isOnboardingComplete ? <RootNavigator /> : <OnboardingNavigator />}
      </NavigationContainer>
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
            translucent
            backgroundColor="transparent"
          />
          <AppContent />
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
