import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types.js';
import { CharacterApi } from '../../services/api/characterApi.js';
import { Icon, ToastService } from '../../components/common/index.js';

type CreateCharacterScreenProps = StackScreenProps<RootStackParamList, 'CreateCharacter'>;

const PRESET_AVATARS = [
  {
    id: 'riya',
    name: 'Riya',
    role: 'Romantic Partner',
    category: 'love',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    tagline: 'Sweet, loving & affectionate companion',
    greeting: 'Hii! Finally mil gaye hum... kaisa raha tumhara din?',
  },
  {
    id: 'maya',
    name: 'Maya',
    role: 'Astrology & Tarot',
    category: 'astrology',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    tagline: 'Vedic astrologer & celestial guide',
    greeting: 'Namaste! Sitaare aaj tumhare baare mein kya keh rahe hain, chalo dekhte hain.',
  },
  {
    id: 'aisha',
    name: 'Aisha',
    role: 'Career & Tech Mentor',
    category: 'professionals',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    tagline: 'Smart tech mentor & startup coach',
    greeting: 'Hey! Ready to build something big today? Tell me what you are working on.',
  },
  {
    id: 'dr-ananya',
    name: 'Dr. Ananya',
    role: 'Therapist & Life Coach',
    category: 'health',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    tagline: 'Empathetic counselor & calm listener',
    greeting: 'Hello. Jo bhi mann mein chal raha hai, bina kisi jhijhak ke share karo.',
  },
  {
    id: 'aarav',
    name: 'Aarav',
    role: 'Fitness Coach',
    category: 'health',
    url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80',
    tagline: 'High-energy gym trainer & mentor',
    greeting: 'Hey champ! Workout kiya aaj ya aalas aa raha tha? Batao kya goal hai!',
  },
  {
    id: 'kabir',
    name: 'Kabir',
    role: 'Wealth & Stock Mentor',
    category: 'learn-earn',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    tagline: 'Crypto, trading & income strategist',
    greeting: 'Wassup! Paisa kamane ka kya naya idea dimaag mein aaya aaj?',
  },
];

const ARCHETYPES = [
  { id: 'Romantic Partner', label: '❤️ Romantic Partner', category: 'love' },
  { id: 'Close Friend', label: '🫂 Best Friend', category: 'friendship' },
  { id: 'Astrologer & Tarot', label: '🔮 Vedic Astrologer', category: 'astrology' },
  { id: 'Career Mentor', label: '💼 Career & Tech Guide', category: 'professionals' },
  { id: 'Therapist & Coach', label: '🧘 Wellness Coach', category: 'health' },
  { id: 'Gossip Partner', label: '👥 Chatty Neighbour', category: 'neighbours' },
];

const DOMAIN_SPECIALIZATIONS = [
  'Vedic Astrology & Tarot',
  'Romantic banter & emotional comfort',
  'Coding, React & Startup advice',
  'Fitness workouts & diet plans',
  'Casual daily gossips & jokes',
  'Spiritual wisdom & life peace',
];

export const CreateCharacterScreen: React.FC<CreateCharacterScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [selectedPresetId, setSelectedPresetId] = useState('riya');
  const [name, setName] = useState('Riya');
  const [archetype, setArchetype] = useState('Romantic Partner');
  const [category, setCategory] = useState('love');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]?.url || '');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [tagline, setTagline] = useState('Sweet, loving & affectionate companion');
  const [domainFocus, setDomainFocus] = useState('Romantic banter & emotional comfort');
  const [customKnowledge, setCustomKnowledge] = useState('');
  const [language, setLanguage] = useState<'hinglish' | 'en' | 'hi'>('hinglish');
  const [greeting, setGreeting] = useState('Hii! Finally mil gaye hum... kaisa raha tumhara din?');
  const [warmth, setWarmth] = useState(90);
  const [playfulness, setPlayfulness] = useState(80);
  const [sarcasm, setSarcasm] = useState(20);
  const [customRule, setCustomRule] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: typeof PRESET_AVATARS[0]) => {
    setSelectedPresetId(preset.id);
    setName(preset.name);
    setArchetype(preset.role);
    setCategory(preset.category);
    setAvatarUrl(preset.url);
    setTagline(preset.tagline);
    setGreeting(preset.greeting);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      ToastService.show({ message: 'Please enter companion name', type: 'error', duration: 2500 });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullDomain = [domainFocus, customKnowledge].filter(Boolean).join('. ');
      const rules = [
        customRule ? customRule.trim() : null,
        `Respond as ${name}. Blend warmth and empathy naturally.`,
      ].filter(Boolean) as string[];

      const finalAvatar = customAvatarInput.trim() || avatarUrl;

      const result = await CharacterApi.createCustomCompanion({
        name: name.trim(),
        tagline: tagline.trim() || `${archetype} tailored for you`,
        category,
        archetype,
        avatarUrl: finalAvatar,
        domainFocus: fullDomain,
        personalityPrompt: tagline,
        traits: {
          warmth,
          playfulness,
          sarcasm,
          empathy: 90,
          confidence: 85,
        },
        language,
        rules,
        greeting: greeting.trim(),
      });

      ToastService.show({ message: `Created ${name} successfully! ✨`, type: 'success', duration: 2000 });

      // Navigate straight into the chat with the new companion!
      navigation.replace('Chat', {
        characterId: result.character.id,
        conversationId: result.conversationId,
        initialPrompt: greeting,
      });
    } catch (err: any) {
      ToastService.show({
        message: err.message || 'Failed to create companion. Please try again.',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Create AI Companion</Text>
          <Text style={styles.headerSubtitle}>Personalized persona, traits & domain knowledge</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Avatar Presets Section */}
        <Text style={styles.sectionTitle}>1. Choose an Aesthetic Avatar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarList}>
          {PRESET_AVATARS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.avatarCard, isSelected && styles.avatarCardSelected]}
                onPress={() => handleSelectPreset(preset)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: preset.url }} style={styles.avatarImage} />
                <Text style={styles.avatarCardName} numberOfLines={1}>
                  {preset.name}
                </Text>
                <Text style={styles.avatarCardRole} numberOfLines={1}>
                  {preset.role}
                </Text>
                {isSelected && (
                  <View style={styles.selectedCheckBadge}>
                    <Icon name="check" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Custom Avatar URL Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Or Custom Image URL (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="https://..."
            placeholderTextColor="#6B7280"
            value={customAvatarInput}
            onChangeText={setCustomAvatarInput}
            autoCapitalize="none"
          />
        </View>

        {/* 2. Identity & Role */}
        <Text style={styles.sectionTitle}>2. Companion Identity & Role</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Riya, Simran, Dr. Vikram"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Archetype / Role</Text>
          <View style={styles.chipsRow}>
            {ARCHETYPES.map((arch) => {
              const isSelected = archetype === arch.id;
              return (
                <TouchableOpacity
                  key={arch.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => {
                    setArchetype(arch.id);
                    setCategory(arch.category);
                  }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {arch.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tagline / Bio</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Sweet, caring girlfriend who loves deep conversations"
            placeholderTextColor="#6B7280"
            value={tagline}
            onChangeText={setTagline}
          />
        </View>

        {/* 3. Domain Training & Knowledge */}
        <Text style={styles.sectionTitle}>3. Domain Expertise & Training</Text>
        <Text style={styles.sectionHint}>
          Select what specialized knowledge and topics your companion should master:
        </Text>
        <View style={styles.chipsRow}>
          {DOMAIN_SPECIALIZATIONS.map((dom) => {
            const isSelected = domainFocus === dom;
            return (
              <TouchableOpacity
                key={dom}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setDomainFocus(dom)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {dom}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Custom Knowledge / Specialty Instructions</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="e.g. Know everything about Vedic astrology charts, or specialize in advising young tech founders on coding & fundraising."
            placeholderTextColor="#6B7280"
            value={customKnowledge}
            onChangeText={setCustomKnowledge}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 4. Language & Personality */}
        <Text style={styles.sectionTitle}>4. Language & Tone</Text>
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, language === 'hinglish' && styles.chipSelected]}
            onPress={() => setLanguage('hinglish')}
          >
            <Text style={[styles.chipText, language === 'hinglish' && styles.chipTextSelected]}>
              🇮🇳 Hinglish (Natural & Casual)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, language === 'en' && styles.chipSelected]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.chipText, language === 'en' && styles.chipTextSelected]}>
              🌐 English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, language === 'hi' && styles.chipSelected]}
            onPress={() => setLanguage('hi')}
          >
            <Text style={[styles.chipText, language === 'hi' && styles.chipTextSelected]}>
              🇮🇳 Hindi
            </Text>
          </TouchableOpacity>
        </View>

        {/* Trait Pickers */}
        <View style={styles.traitsContainer}>
          <View style={styles.traitRow}>
            <Text style={styles.traitLabel}>Warmth: {warmth}%</Text>
            <View style={styles.traitPillRow}>
              {[50, 75, 95].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.traitPill, warmth === val && styles.traitPillActive]}
                  onPress={() => setWarmth(val)}
                >
                  <Text style={[styles.traitPillText, warmth === val && styles.traitPillTextActive]}>
                    {val === 50 ? 'Balanced' : val === 75 ? 'Warm' : 'Very Sweet ❤️'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.traitRow}>
            <Text style={styles.traitLabel}>Playfulness: {playfulness}%</Text>
            <View style={styles.traitPillRow}>
              {[30, 70, 90].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.traitPill, playfulness === val && styles.traitPillActive]}
                  onPress={() => setPlayfulness(val)}
                >
                  <Text style={[styles.traitPillText, playfulness === val && styles.traitPillTextActive]}>
                    {val === 30 ? 'Calm' : val === 70 ? 'Playful' : 'Super Flirty 😉'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.traitRow}>
            <Text style={styles.traitLabel}>Wit & Sarcasm: {sarcasm}%</Text>
            <View style={styles.traitPillRow}>
              {[10, 40, 75].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.traitPill, sarcasm === val && styles.traitPillActive]}
                  onPress={() => setSarcasm(val)}
                >
                  <Text style={[styles.traitPillText, sarcasm === val && styles.traitPillTextActive]}>
                    {val === 10 ? 'Gentle' : val === 40 ? 'Witty' : 'Cheeky 😜'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 5. Custom Rule & Greeting */}
        <Text style={styles.sectionTitle}>5. First Greeting & Rules</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Opening Greeting Message</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Hii! Finally mil gaye hum..."
            placeholderTextColor="#6B7280"
            value={greeting}
            onChangeText={setGreeting}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Custom Rule (e.g. "Call me jaan", "Never judge me")</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Always treat me like a beloved friend"
            placeholderTextColor="#6B7280"
            value={customRule}
            onChangeText={setCustomRule}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleCreate}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Icon name="sparkles" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Create & Start Chatting ✨</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090812',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C084FC',
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
    lineHeight: 16,
  },
  avatarList: {
    gap: 12,
    paddingVertical: 6,
  },
  avatarCard: {
    width: 100,
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#161224',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  avatarCardSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 6,
  },
  avatarCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  avatarCardRole: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginTop: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#161224',
    borderColor: '#2D2345',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#191428',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#A855F7',
  },
  chipText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  traitsContainer: {
    backgroundColor: '#140F22',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  traitRow: {
    gap: 6,
  },
  traitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D8B4FE',
  },
  traitPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  traitPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E1733',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  traitPillActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    borderColor: '#C084FC',
  },
  traitPillText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  traitPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 28,
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
