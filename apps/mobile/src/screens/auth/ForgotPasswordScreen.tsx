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
import { api } from '../../services/api/client.js';

interface ForgotPasswordScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
  };
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setIsSubmitted(true);
    } catch {
      // Enumeration-safe: always indicate success even if not found
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the email associated with your account to receive reset instructions.
          </Text>
        </View>

        {isSubmitted ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Check Your Inbox</Text>
            <Text style={styles.successBody}>
              If an account matches {email}, we have sent a secure password reset link.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Return to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={darkThemeColors.textDisabled}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={darkThemeColors.accentText} />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
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
  backButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.bodySmall,
    color: darkThemeColors.textSecondary,
  },
  successCard: {
    backgroundColor: darkThemeColors.surfaceElevated,
    borderColor: darkThemeColors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  successTitle: {
    ...typography.h2,
    color: darkThemeColors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successBody: {
    ...typography.body,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
