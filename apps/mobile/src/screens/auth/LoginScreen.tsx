import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore.js';
import { APP_VERSION, LEGAL_URLS } from '../../config/appInfo.js';
import { AuthHero } from '../../components/auth/AuthHero.js';
import { GoogleButton } from '../../components/auth/GoogleButton.js';

/**
 * Sign in = one button: Continue with Google (owner's decision, 19 Oct 2026). Google confirms the email, so
 * there are no passwords to forget or reset; an account first made with email + password is linked to Google
 * automatically when the emails match (server: googleSignIn), so nobody loses their chats.
 */

// The local test account, for development builds only. In release builds __DEV__ is false, so the bundler
// drops these strings entirely (they must never ship inside the app).
const DEMO_ACCOUNT = __DEV__ ? { email: 'user@ai-companion.local', password: 'UserPass123!' } : null;

export const LoginScreen: React.FC = () => {
  const { login, isLoading, errorMessage } = useAuthStore();

  const demoLogin = async () => {
    if (!DEMO_ACCOUNT) return;
    try {
      await login({
        email: DEMO_ACCOUNT.email,
        password: DEMO_ACCOUNT.password,
        device: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
          appVersion: APP_VERSION,
          osVersion: String(Platform.Version),
        },
      });
    } catch {
      // shown by the store
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <AuthHero title="Someone's waiting to talk" subtitle="Friends, mentors and more — who remember you and talk your way." />

        <View style={styles.actions}>
          <GoogleButton />
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {DEMO_ACCOUNT && (
            <TouchableOpacity style={styles.demo} onPress={demoLogin} disabled={isLoading}>
              <Text style={styles.demoText}>Quick Demo Sign In (dev only)</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0614' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, maxWidth: 440, width: '100%', alignSelf: 'center' },
  actions: { marginTop: 40, gap: 14 },
  error: { color: '#F87171', fontSize: 13, textAlign: 'center' },
  demo: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(196,181,253,0.25)' },
  demoText: { color: '#C4B5FD', fontSize: 13, fontWeight: '600' },
  legal: { color: '#7D7591', fontSize: 12, textAlign: 'center', marginTop: 28, lineHeight: 18 },
  link: { color: '#C4B5FD', textDecorationLine: 'underline' },
});
