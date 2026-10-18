import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useOnboardingStore } from '../../stores/onboardingStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { ToastService } from '../../components/common/Toast.js';
import { Icon } from '../../components/common/Icon.js';
import { tapFeedback } from '../../utils/motion.js';

const LOGO = require('../../assets/brand/logo.png');
const MIN_AGE = 12;

const LANGUAGES = [
  { code: 'hinglish', name: 'Hinglish', sample: 'kya scene hai aaj? 😄' },
  { code: 'en', name: 'English', sample: "hey, how's your day going?" },
  { code: 'hi', name: 'हिंदी', sample: 'आज दिन कैसा रहा?' },
] as const;

// So characters say "thak gaye ho?" or "thak gayi ho?" the right way — never guessed from a name.
const GENDERS = [
  { code: 'male', label: 'Man' },
  { code: 'female', label: 'Woman' },
  { code: 'unspecified', label: 'Skip' },
] as const;

/** What a character's first message would look like with these choices (why we ask). */
function previewLine(lang: string, gender: string | null): string {
  if (lang === 'en') return 'Hii! How are you doing today? 😊';
  if (lang === 'hi') return gender === 'female' ? 'नमस्ते! आप कैसी हैं? 😊' : gender === 'male' ? 'नमस्ते! आप कैसे हैं? 😊' : 'नमस्ते! आज का दिन कैसा रहा? 😊';
  return gender === 'female' ? 'Hii! Kaisi ho aaj? 😊' : gender === 'male' ? 'Hii! Kaise ho aaj? 😊' : 'Hii! Aaj ka din kaisa raha? 😊';
}

/**
 * The one onboarding step (owner's decision, 18 Oct 2026), all answers required: the language characters text in
 * (their first messages; then they follow how the person writes), how they address the person (Hinglish/Hindi
 * grammar: "kaise ho" / "kaisi ho") and their age (12+; romance characters are 18+ and shown blurred to younger
 * people). Then Home.
 */
export const LanguageSelectScreen: React.FC = () => {
  const { selectedLanguage, setLanguage, selectedGender, setGender, selectedAge, setAge, completeCurrentStep, isSubmitting } = useOnboardingStore();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const insets = useSafeAreaInsets();
  const tooYoung = selectedAge !== null && selectedAge < MIN_AGE;
  const ready = Boolean(selectedLanguage) && Boolean(selectedGender) && selectedAge !== null && !tooYoung;

  const step = (by: number) => {
    tapFeedback();
    setAge(Math.min(99, Math.max(MIN_AGE, (selectedAge ?? 18) + by)));
  };

  const handleContinue = async () => {
    if (!ready) return;
    tapFeedback('medium');
    try {
      await completeCurrentStep('LANGUAGE');
      await bootstrap(); // the profile is now onboarded → the app opens Home
    } catch (err) {
      ToastService.show({ message: (err as Error)?.message || "Couldn't save that — please try again.", type: 'error', duration: 3500 });
    }
  };

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
        <Text style={styles.title}>Let’s get to know you</Text>
        <Text style={styles.subtitle}>Three quick answers, so your characters talk to you the right way.</Text>

        {/* 1. Language */}
        <Text style={styles.label}>Characters text you in</Text>
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
                accessibilityLabel={`${l.name}: ${l.sample}`}
              >
                <View style={styles.flex}>
                  <Text style={[styles.langName, on && styles.langNameOn]}>{l.name}</Text>
                  <Text style={styles.langSample}>“{l.sample}”</Text>
                </View>
                <View style={[styles.tick, on && styles.tickOn]}>{on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        {/* 2. How to address them */}
        <Text style={styles.label}>Characters talk to you as</Text>
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
        <Text style={styles.label}>Your age</Text>
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
        {tooYoung ? <Text style={styles.ageError}>Loveek is for ages {MIN_AGE} and up.</Text> : null}

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        {/* Why we ask: the first message they'd get — always in view, above the button. */}
        {selectedLanguage ? (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Your characters will say</Text>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{previewLine(selectedLanguage, selectedGender)}</Text>
            </View>
          </View>
        ) : null}
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
          <Text style={styles.ctaText}>{isSubmitting ? 'Saving…' : 'Start chatting'}</Text>
        </Pressable>
        {!ready && !tooYoung ? <Text style={styles.hint}>Answer all three to continue</Text> : null}
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
  subtitle: { color: '#B9B2CC', fontSize: 15, lineHeight: 21, marginTop: 6 },
  label: { color: '#E6E0F2', fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 8 },

  langList: { gap: 8 },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#150F22',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  langCardOn: { borderColor: '#A78BFA', backgroundColor: '#1D1430' },
  langName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  langNameOn: { color: '#D8B4FE' },
  langSample: { color: '#9E97B0', fontSize: 13.5, marginTop: 3 },
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
  ageError: { color: '#F87171', fontSize: 13, marginTop: 8 },

  preview: { marginBottom: 12 },
  previewLabel: { color: '#7E778F', fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: '#251B38',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bubbleText: { color: '#FFFFFF', fontSize: 15.5 },

  footer: { paddingHorizontal: 22, paddingTop: 12, backgroundColor: '#0B0614', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' },
  cta: { height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  hint: { color: '#7E778F', fontSize: 12.5, textAlign: 'center', marginTop: 8 },
});
