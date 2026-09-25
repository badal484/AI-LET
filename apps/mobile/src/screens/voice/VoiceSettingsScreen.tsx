import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { VoiceApi } from '../../services/api/voiceApi.js';
import type { UserVoicePreferenceData } from '@ai-companion/types';

export const VoiceSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<UserVoicePreferenceData>({
    id: '',
    userId: '',
    voiceEnabled: true,
    preferredMode: 'hands_free',
    speechSpeed: 1.0,
    preferredLanguage: 'en',
    subtitlesEnabled: true,
    autoPlayAudio: true,
    noiseSuppression: true,
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const data = await VoiceApi.getPreferences();
      if (data) {
        setPrefs(data);
      }
    } catch (err: any) {
      console.error('Failed to load voice preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updated: Partial<UserVoicePreferenceData>) => {
    try {
      const data = await VoiceApi.updatePreferences(updated);
      if (data) {
        setPrefs(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update preferences');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4E6EE2" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Voice Enable */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Voice Calls</Text>
              <Text style={styles.settingSubtext}>Enable real-time voice conversations with AI companions</Text>
            </View>
            <Switch
              value={prefs.voiceEnabled}
              onValueChange={(val) => {
                setPrefs({ ...prefs, voiceEnabled: val });
                savePreferences({ voiceEnabled: val });
              }}
              trackColor={{ false: '#272D3D', true: '#4E6EE2' }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Live Subtitles</Text>
              <Text style={styles.settingSubtext}>Show real-time transcript subtitles during calls</Text>
            </View>
            <Switch
              value={prefs.subtitlesEnabled}
              onValueChange={(val) => {
                setPrefs({ ...prefs, subtitlesEnabled: val });
                savePreferences({ subtitlesEnabled: val });
              }}
              trackColor={{ false: '#272D3D', true: '#4E6EE2' }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Noise Suppression</Text>
              <Text style={styles.settingSubtext}>Filter background noise and echo</Text>
            </View>
            <Switch
              value={prefs.noiseSuppression}
              onValueChange={(val) => {
                setPrefs({ ...prefs, noiseSuppression: val });
                savePreferences({ noiseSuppression: val });
              }}
              trackColor={{ false: '#272D3D', true: '#4E6EE2' }}
            />
          </View>
        </View>

        {/* Conversation Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Conversation Mode</Text>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeOption, prefs.preferredMode === 'hands_free' && styles.modeOptionActive]}
              onPress={() => {
                setPrefs({ ...prefs, preferredMode: 'hands_free' });
                savePreferences({ preferredMode: 'hands_free' });
              }}
            >
              <Text style={[styles.modeOptionTitle, prefs.preferredMode === 'hands_free' && styles.modeOptionTitleActive]}>
                Hands-Free
              </Text>
              <Text style={styles.modeOptionDesc}>Natural conversational flow with automatic voice activity detection.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeOption, prefs.preferredMode === 'push_to_talk' && styles.modeOptionActive]}
              onPress={() => {
                setPrefs({ ...prefs, preferredMode: 'push_to_talk' });
                savePreferences({ preferredMode: 'push_to_talk' });
              }}
            >
              <Text style={[styles.modeOptionTitle, prefs.preferredMode === 'push_to_talk' && styles.modeOptionTitleActive]}>
                Push-to-Talk
              </Text>
              <Text style={styles.modeOptionDesc}>Hold the button while speaking. Best for noisy environments.</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Speech Speed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playback Speed</Text>
          <View style={styles.speedRow}>
            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
              <TouchableOpacity
                key={speed}
                style={[styles.speedButton, prefs.speechSpeed === speed && styles.speedButtonActive]}
                onPress={() => {
                  setPrefs({ ...prefs, speechSpeed: speed });
                  savePreferences({ speechSpeed: speed });
                }}
              >
                <Text style={[styles.speedButtonText, prefs.speechSpeed === speed && styles.speedButtonTextActive]}>
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#8A92A6',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161922',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  settingSubtext: {
    color: '#8A92A6',
    fontSize: 12,
    marginTop: 2,
  },
  modeSelector: {
    gap: 10,
  },
  modeOption: {
    backgroundColor: '#161922',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    borderColor: '#4E6EE2',
    backgroundColor: '#1B2133',
  },
  modeOptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeOptionTitleActive: {
    color: '#4E6EE2',
  },
  modeOptionDesc: {
    color: '#8A92A6',
    fontSize: 12,
    lineHeight: 18,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  speedButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#161922',
    borderRadius: 12,
  },
  speedButtonActive: {
    backgroundColor: '#4E6EE2',
  },
  speedButtonText: {
    color: '#8A92A6',
    fontSize: 14,
    fontWeight: '600',
  },
  speedButtonTextActive: {
    color: '#FFFFFF',
  },
});
