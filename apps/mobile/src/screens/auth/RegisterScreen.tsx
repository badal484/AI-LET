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

interface RegisterScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, isLoading, errorMessage, clearError } = useAuthStore();

  const handleRegister = async () => {
    if (!displayName.trim()) {
      setLocalError('Please enter your name or nickname.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        device: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
        },
      });
    } catch {
      // Error state handled in store
    }
  };

  const displayError = localError || errorMessage;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Begin building deep connections with AI companions</Text>
        </View>

        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name / Nickname</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex"
              placeholderTextColor={darkThemeColors.textDisabled}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (displayError) {
                  setLocalError(null);
                  clearError();
                }
              }}
              autoCapitalize="words"
            />
          </View>

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
            <Text style={styles.label}>Password (Min. 8 characters)</Text>
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
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={darkThemeColors.accentText} />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signupLink}> Sign In</Text>
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
  label: {
    ...typography.caption,
    color: darkThemeColors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
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
