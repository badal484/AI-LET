import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { ToastService } from '../../components/common/Toast.js';
import { Icon } from '../../components/common/Icon.js';
import { tapFeedback } from '../../utils/motion.js';

const LOGO = require('../../assets/brand/logo.png');
const MIN_AGE = 13; // same as the server (users/ageGate.ts)

const LANGUAGES = [
  { code: 'hinglish', name: 'Hinglish' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
] as const;

// So characters say "thak gaye ho?" or "thak gayi ho?" the right way — never guessed from a name.
const GENDERS = [
  { code: 'male', label: 'Man' },
  { code: 'female', label: 'Woman' },
  { code: 'unspecified', label: 'Skip' },
] as const;

/**
 * The one onboarding step (owner's decision, 18 Oct 2026), all answers required: the language characters text in
 * (their first messages; then they follow how the person writes), how they address the person (Hinglish/Hindi
 * grammar: "kaise ho" / "kaisi ho") and their age (13+; romance characters are 18+ and shown blurred to younger
 * people). Then Home.
 */
export const LanguageSelectScreen: React.FC = () => {
  const { selectedLanguage, setLanguage, selectedGender, setGender, selectedAge, setAge, completeCurrentStep, isSubmitting } = useOnboardingStore();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();
  const tooYoung = selectedAge !== null && selectedAge < MIN_AGE;
  const ready = Boolean(selectedLanguage) && Boolean(selectedGender) && selectedAge !== null;
  // Under 12: a friendly "see you soon" instead of a dead button.
  const [tooYoungScreen, setTooYoungScreen] = useState(false);

  const step = (by: number) => {
    tapFeedback();
    setAge(Math.min(99, Math.max(MIN_AGE, (selectedAge ?? 18) + by)));
  };

  const handleContinue = async () => {
    if (!ready) return;
    tapFeedback('medium');
    if (tooYoung) {
      setTooYoungScreen(true);
      return;
    }
    try {
      await completeCurrentStep('LANGUAGE');
      await bootstrap(); // the profile is now onboarded → the app opens Home
    } catch (err) {
      ToastService.show({ message: (err as Error)?.message || "Couldn't save that — please try again.", type: 'error', duration: 3500 });
    }
  };

  if (tooYoungScreen) {
    return (
      <View style={[styles.root, styles.young, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.youngBody}>
          <Image source={LOGO} style={styles.youngLogo} />
          <Text style={styles.youngTitle}>See you soon! 💜</Text>
          <Text style={styles.youngText}>Loveek is for ages {MIN_AGE} and up. Come back when you turn {MIN_AGE}.</Text>
        </View>
        <Pressable onPress={() => setTooYoungScreen(false)} style={({ pressed }) => [styles.youngPrimary, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.ctaText}>I typed my age wrong</Text>
        </Pressable>
        <Pressable onPress={() => void logout()} style={({ pressed }) => [styles.youngSecondary, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.youngSecondaryText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* A soft glow behind the header, like the sign-in screen. */}
      <View pointerEvents="none" style={styles.glow}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7C3AED" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={LOGO} style={styles.logo} />
        <Text style={styles.title}>Quick setup</Text>

        {/* 1. Language */}
        <Text style={styles.label}>Language</Text>
        <View style={styles.langList}>
          {LANGUAGES.map((l) => {
            const on = selectedLanguage === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => {
                  tapFeedback();
                  setLanguage(l.code);
                }}
                style={({ pressed }) => [styles.langCard, on && styles.langCardOn, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={l.name}
              >
                <Text style={[styles.langName, styles.flex, on && styles.langNameOn]}>{l.name}</Text>
                <View style={[styles.tick, on && styles.tickOn]}>{on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        {/* 2. How to address them */}
        <Text style={styles.label}>You are</Text>
        <View style={styles.segment}>
          {GENDERS.map((g) => {
            const on = selectedGender === g.code;
            return (
              <Pressable
                key={g.code}
                onPress={() => {
                  tapFeedback();
                  setGender(g.code);
                }}
                style={({ pressed }) => [styles.segmentItem, on && styles.segmentItemOn, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={g.code === 'unspecified' ? 'Prefer not to say' : g.label}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 3. Age */}
        <Text style={styles.label}>Age</Text>
        <View style={[styles.ageRow, tooYoung && styles.ageRowError]}>
          <Pressable onPress={() => step(-1)} style={styles.ageStep} accessibilityLabel="One year less" hitSlop={8}>
            <Text style={styles.ageStepText}>−</Text>
          </Pressable>
          <View style={styles.ageCenter}>
            <TextInput
              style={styles.ageInput}
              value={selectedAge === null ? '' : String(selectedAge)}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, '').slice(0, 2);
                setAge(digits ? Number(digits) : null);
              }}
              placeholder="--"
              placeholderTextColor="#5E5670"
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Your age"
            />
            <Text style={styles.ageUnit}>years</Text>
          </View>
          <Pressable onPress={() => step(1)} style={styles.ageStep} accessibilityLabel="One year more" hitSlop={8}>
            <Text style={styles.ageStepText}>+</Text>
          </Pressable>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!ready || isSubmitting}
          style={({ pressed }) => [styles.cta, (!ready || isSubmitting) && styles.ctaOff, pressed && ready && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || isSubmitting }}
        >
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#EC4899" />
                <Stop offset="1" stopColor="#8B5CF6" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx="18" fill="url(#cta)" />
          </Svg>
          <Text style={styles.ctaText}>{isSubmitting ? 'Saving…' : 'Continue'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0614' },
  flex: { flex: 1 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 320 },
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  logo: { width: 40, height: 40, borderRadius: 20, marginBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  label: { color: '#E6E0F2', fontSize: 15, fontWeight: '800', marginTop: 24, marginBottom: 10 },

  langList: { gap: 8 },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: '#150F22',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  langCardOn: { borderColor: '#A78BFA', backgroundColor: '#1D1430' },
  langName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  langNameOn: { color: '#D8B4FE' },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },

  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#150F22',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  segmentItemOn: { borderColor: '#A78BFA', backgroundColor: '#1D1430' },
  segmentText: { color: '#E6E0F2', fontSize: 15, fontWeight: '700' },
  segmentTextOn: { color: '#D8B4FE' },

  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#150F22',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 6,
  },
  ageRowError: { borderColor: '#F87171' },
  ageStep: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  ageStepText: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginTop: -2 },
  ageCenter: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  ageInput: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', minWidth: 44, textAlign: 'center', padding: 0 },
  ageUnit: { color: '#9E97B0', fontSize: 15, fontWeight: '600' },
  young: { paddingHorizontal: 22, justifyContent: 'space-between' },
  youngBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  youngLogo: { width: 72, height: 72, borderRadius: 36, marginBottom: 20 },
  youngTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  youngText: { color: '#B9B2CC', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  youngPrimary: { height: 54, borderRadius: 18, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  youngSecondary: { height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  youngSecondaryText: { color: '#B9B2CC', fontSize: 15, fontWeight: '700' },


  footer: { paddingHorizontal: 22, paddingTop: 12, backgroundColor: '#0B0614', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' },
  cta: { height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
