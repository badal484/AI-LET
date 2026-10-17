import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { darkThemeColors } from '../../theme/colors.js';
import { typography } from '../../theme/typography.js';
import { spacing } from '../../theme/spacing.js';
import { radius } from '../../theme/radius.js';
import { useAuthStore } from '../../stores/authStore.js';
import { APP_VERSION } from '../../config/appInfo.js';
import { AuthHero } from '../../components/auth/AuthHero.js';
import { AuthField } from '../../components/auth/AuthField.js';

interface LoginScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

// The local test account, for development builds only. In release builds __DEV__ is false, so the bundler
// drops these strings entirely (they must never ship inside the app).
const DEMO_ACCOUNT = __DEV__ ? { email: 'user@ai-companion.local', password: 'UserPass123!' } : null;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState(DEMO_ACCOUNT?.email ?? '');
  const [password, setPassword] = useState(DEMO_ACCOUNT?.password ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, isLoading, errorMessage, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await login({
        email: email.trim(),
        password,
        device: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
          appVersion: APP_VERSION,
          osVersion: String(Platform.Version),
        },
      });
    } catch {
      // Error handled by store
    }
  };

  const handleDemoLogin = async () => {
    if (!DEMO_ACCOUNT) return;
    setLocalError(null);
    clearError();
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
    } catch {}
  };

  const displayError = localError || errorMessage;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <AuthHero title="Welcome back" subtitle="Sign in — they've been waiting to hear from you." />

        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <AuthField
            label="Email"
            icon="mail"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (displayError) {
                setLocalError(null);
                clearError();
              }
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            returnKeyType="next"
          />

          <AuthField
            label="Password"
            icon="lock"
            password
            placeholder="Your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (displayError) {
                setLocalError(null);
                clearError();
              }
            }}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            accessory={
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8}>
                <Text style={styles.forgotPasswordText}>Forgot?</Text>
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={darkThemeColors.accentText} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={styles.demoButton}
              onPress={handleDemoLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.demoButtonText}>Quick Demo Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}> Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: darkThemeColors.textMuted,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: darkThemeColors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: darkThemeColors.danger,
    textAlign: 'center',
  },
  form: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    gap: 18,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  forgotPasswordText: {
    ...typography.caption,
    color: darkThemeColors.accent,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderColor: darkThemeColors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: darkThemeColors.textPrimary,
    ...typography.body,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: darkThemeColors.accentText,
  },
  demoButton: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderColor: darkThemeColors.accentMuted,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  demoButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: darkThemeColors.accent,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
  },
  signupLink: {
    ...typography.bodySmall,
    color: darkThemeColors.accent,
    fontWeight: '600',
  },
});
