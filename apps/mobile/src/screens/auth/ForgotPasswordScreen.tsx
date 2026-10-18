import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { darkThemeColors } from '../../theme/colors.js';
import { spacing } from '../../theme/spacing.js';
import { api } from '../../services/api/client.js';
import { AuthField } from '../../components/auth/AuthField.js';
import { Icon, IconButton } from '../../components/common/index.js';

interface ForgotPasswordScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
  };
}

/** "Forgot?" from sign-in: same look as sign-in; always says the email is on its way (never reveals who has an account). */
export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // Enumeration-safe: always the same answer.
    } finally {
      setIsLoading(false);
      setIsSubmitted(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back to sign in" />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Icon name={isSubmitted ? 'check' : 'lock'} size={26} color="#C4B5FD" />
          </View>

          {isSubmitted ? (
            <>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                If an account uses <Text style={styles.email}>{email.trim()}</Text>, a link to set a new password is on its way. It
                can take a minute — check Spam too.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Back to sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => setIsSubmitted(false)} hitSlop={8}>
                <Text style={styles.secondaryText}>Use a different email</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Forgot your password?</Text>
              <Text style={styles.subtitle}>Enter your email and we’ll send you a link to set a new one.</Text>

              <View style={styles.form}>
                <AuthField
                  label="Email"
                  icon="mail"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  autoFocus
                />
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send link</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.3)',
    marginBottom: spacing.lg,
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#B9B2CC', fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  email: { color: '#FFFFFF', fontWeight: '700' },
  form: { marginTop: spacing.xl, gap: 14 },
  errorText: { color: '#F87171', fontSize: 13 },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondary: { alignSelf: 'center', marginTop: spacing.lg },
  secondaryText: { color: '#C4B5FD', fontSize: 14, fontWeight: '600' },
});
