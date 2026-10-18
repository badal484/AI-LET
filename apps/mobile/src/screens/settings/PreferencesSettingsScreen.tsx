import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { onboardingApi } from '../../services/api/onboardingApi.js';
import { darkThemeColors, spacing } from '../../theme/index.js';
import type { UserPreferenceProfile } from '@ai-companion/types';
import { Icon, IconButton, Skeleton } from '../../components/common/index.js';
import { AppAlert } from '../../components/common/AppDialog.js';
import { tapFeedback } from '../../utils/motion.js';
import { GradientFill } from '../../components/common/GradientFill.js';

/** Chat preferences: the language characters start in, and how Hindi words address you. Saved on tap. */

const LANGUAGES = [
  { value: 'hinglish', label: 'Hinglish', sub: 'Hindi in English letters' },
  { value: 'en', label: 'English', sub: 'Plain English' },
  { value: 'hi', label: 'हिंदी (Hindi)', sub: 'देवनागरी में' },
];
const ADDRESS = [
  { value: 'male', label: 'Man', sub: '“thak gaye?”' },
  { value: 'female', label: 'Woman', sub: '“thak gayi?”' },
  { value: 'unspecified', label: 'Prefer not to say', sub: 'Neutral words' },
] as const;

export const PreferencesSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onboardingApi
      .getPreferences()
      .then(setProfile)
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const updateField = async (fields: Partial<UserPreferenceProfile>) => {
    if (!profile) return;
    tapFeedback();
    const before = profile;
    setProfile({ ...profile, ...fields });
    try {
      const updated = await onboardingApi.updatePreferences(fields as any);
      setProfile(updated);
      setSaved(true);
    } catch {
      setProfile(before);
      AppAlert.alert('Couldn’t save', 'Please check your connection and try again.');
    }
  };

  const Option = ({ label, sub, selected, onPress, first }: { label: string; sub: string; selected: boolean; onPress: () => void; first: boolean }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, !first && styles.optionBorder, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <Icon name="check" size={14} color="#FFFFFF" />}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.glow} pointerEvents="none">
        <GradientFill radial colors={[['#A855F7', 0.2], ['#EC4899', 0.05], ['#0B0614', 0]]} />
      </View>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size="sm" variant="surface" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.title}>Chat preferences</Text>
        {saved && <Text style={styles.saved}>Saved</Text>}
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <Skeleton height={190} borderRadius={16} />
          <Skeleton height={190} borderRadius={16} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.sectionTitle}>Language</Text>
            <Text style={styles.sectionNote}>Characters start in this, then follow the way you write.</Text>
            <View style={styles.card}>
              {LANGUAGES.map((l, i) => (
                <Option
                  key={l.value}
                  label={l.label}
                  sub={l.sub}
                  first={i === 0}
                  selected={profile?.preferredLanguage === l.value}
                  onPress={() => updateField({ preferredLanguage: l.value })}
                />
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Talk to me as</Text>
            <Text style={styles.sectionNote}>Only changes how Hindi words address you.</Text>
            <View style={styles.card}>
              {ADDRESS.map((g, i) => (
                <Option
                  key={g.value}
                  label={g.label}
                  sub={g.sub}
                  first={i === 0}
                  selected={profile?.userGender === g.value}
                  onPress={() => updateField({ userGender: g.value })}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  container: { flex: 1, backgroundColor: darkThemeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { flex: 1, color: darkThemeColors.textPrimary, fontSize: 20, fontWeight: '700' },
  saved: { color: '#34D399', fontSize: 13, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl, paddingBottom: 48 },
  sectionTitle: { color: darkThemeColors.textPrimary, fontSize: 16, fontWeight: '700' },
  sectionNote: { color: darkThemeColors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: spacing.sm },
  card: { backgroundColor: darkThemeColors.surface, borderRadius: 16, borderWidth: 1, borderColor: darkThemeColors.border, paddingHorizontal: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  optionBorder: { borderTopWidth: 1, borderTopColor: darkThemeColors.border },
  pressed: { opacity: 0.7 },
  optionLabel: { color: darkThemeColors.textPrimary, fontSize: 15, fontWeight: '600' },
  optionLabelSelected: { color: '#FFFFFF', fontWeight: '700' },
  optionSub: { color: darkThemeColors.textMuted, fontSize: 12, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
});
