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
  Linking,
} from 'react-native';
import { darkThemeColors } from '../../theme/colors.js';
import { typography } from '../../theme/typography.js';
import { spacing } from '../../theme/spacing.js';
import { radius } from '../../theme/radius.js';
import { useAuthStore } from '../../stores/authStore.js';
import { APP_VERSION } from '../../config/appInfo.js';
import { LEGAL_URLS } from '../../config/appInfo.js';
import { AuthHero } from '../../components/auth/AuthHero.js';
import { AuthField } from '../../components/auth/AuthField.js';
import { Icon } from '../../components/common/Icon.js';

interface RegisterScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Loveek is for adults: an explicit "I am 18 or older" box (audit M-6); the server refuses sign-up without it.
  const [isAdult, setIsAdult] = useState(false);
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
    if (!isAdult) {
      setLocalError('Loveek is only for people 18 or older — please confirm your age.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        ageConfirmed: true,
        device: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceName: `${Platform.OS.toUpperCase()} Mobile Client`,
          appVersion: APP_VERSION,
          osVersion: String(Platform.Version),
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
        <AuthHero title="Create your account" subtitle="Takes 20 seconds. Then pick who you want to talk to." />

        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <AuthField
            label="What should they call you?"
            icon="user"
            placeholder="Your name or nickname"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (displayError) {
                setLocalError(null);
                clearError();
              }
            }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />

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
            placeholder="At least 8 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (displayError) {
                setLocalError(null);
                clearError();
              }
            }}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity
            style={styles.ageRow}
            onPress={() => setIsAdult((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAdult }}
            accessibilityLabel="I am 18 or older"
          >
            <View style={[styles.ageBox, isAdult && styles.ageBoxOn]}>{isAdult ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
            <Text style={styles.ageText}>I am 18 or older</Text>
          </TouchableOpacity>

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
          <Text style={styles.legalText}>
            By creating an account you agree to the{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.terms).catch(() => undefined)}>Terms</Text> and{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined)}>Privacy Policy</Text>.
          </Text>
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
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, marginBottom: 12 },
  ageBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: darkThemeColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBoxOn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  ageText: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalText: {
    ...typography.bodySmall,
    color: darkThemeColors.textMuted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
  legalLink: {
    color: darkThemeColors.textSecondary,
    textDecorationLine: 'underline',
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
