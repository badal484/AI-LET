import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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

interface LoginScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('user@ai-companion.local');
  const [password, setPassword] = useState('UserPass123!');
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
        },
      });
    } catch {
      // Error handled by store
    }
  };

  const handleDemoLogin = async () => {
    setLocalError(null);
    clearError();
    try {
      await login({
        email: 'user@ai-companion.local',
        password: 'UserPass123!',
        device: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
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
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue chatting with your companions</Text>
        </View>

        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={darkThemeColors.textDisabled}
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
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPasswordText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={darkThemeColors.textDisabled}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (displayError) {
                  setLocalError(null);
                  clearError();
                }
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

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

          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleDemoLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.demoButtonText}>Quick Demo Sign In</Text>
          </TouchableOpacity>
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
    padding: spacing.xl,
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
    marginBottom: spacing.xl,
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
    backgroundColor: darkThemeColors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
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
