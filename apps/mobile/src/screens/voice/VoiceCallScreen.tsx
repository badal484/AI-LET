import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  ScrollView,
  StatusBar,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types.js';
import { VoiceWebSocketClient } from '../../services/voice/VoiceWebSocketClient.js';
import { VoicePermissions } from '../../services/voice/VoicePermissions.js';
import { VoiceApi } from '../../services/api/voiceApi.js';
import {
  Avatar,
  IconButton,
  Button,
  ToastService,
} from '../../components/common/index.js';
import { darkThemeColors, spacing, radius } from '../../theme/index.js';
import type { VoiceClientState, VoiceMode } from '@ai-companion/types';
import { NATIVE_AUDIO_AVAILABLE, VOICE_UNAVAILABLE_MESSAGE } from '../../services/voice/AudioCaptureService.js';

type VoiceCallRouteProp = RouteProp<RootStackParamList, 'VoiceCall'>;

export const VoiceCallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<VoiceCallRouteProp>();
  const { characterId, conversationId, characterName, characterAvatarUrl } = route.params;

  const [clientState, setClientState] = useState<VoiceClientState>('CONNECTING');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hands_free');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const clientRef = useRef<VoiceWebSocketClient | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveformAnims = useRef([
    new Animated.Value(0.2),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
  ]).current;

  // Initialize voice call session
  useEffect(() => {
    let timer: any = null;

    const startCall = async () => {
      if (!NATIVE_AUDIO_AVAILABLE) {
        // Don't open (and bill) a server voice session that could only ever receive silence.
        Alert.alert('Voice unavailable', VOICE_UNAVAILABLE_MESSAGE, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      const perm = await VoicePermissions.requestMicrophonePermission();
      if (perm === 'denied' || perm === 'blocked') {
        Alert.alert(
          'Microphone Permission Required',
          'Please grant microphone permission to use real-time voice calls.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      try {
        const sessionData = await VoiceApi.createSession({
          characterId,
          conversationId,
          voiceMode,
        });

        const { sessionId, sessionToken, websocketUrl } = sessionData;

        const client = new VoiceWebSocketClient();
        clientRef.current = client;

        client.stateMachine.subscribe((newState) => {
          setClientState(newState);
          if (newState === 'ENDED') {
            navigation.goBack();
          }
        });

        client.onTranscript((text, isUser) => {
          if (isUser) {
            setUserTranscript(text);
          } else {
            setAiTranscript(text);
          }
        });

        client.audioPlayback.onVolume((vol) => {
          waveformAnims.forEach((anim) => {
            Animated.timing(anim, {
              toValue: Math.max(0.15, vol * (0.5 + Math.random() * 0.5)),
              duration: 80,
              useNativeDriver: true,
            }).start();
          });
        });

        await client.connect(websocketUrl, sessionId, sessionToken);

        timer = setInterval(() => {
          setSessionSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        Alert.alert('Voice Connection Error', err.message || 'Unable to connect to voice session', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    };

    startCall();

    // AppState lifecycle listener to handle backgrounding cleanly
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        // App backgrounded: mute capture to preserve privacy & avoid mic leakage
        clientRef.current?.audioCapture.stopCapture();
      } else if (nextState === 'active') {
        if (!isMuted) {
          clientRef.current?.audioCapture.startCapture();
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (timer) clearInterval(timer);
      appStateSub.remove();
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [characterId, conversationId, navigation, waveformAnims, voiceMode, isMuted]);

  // Breathing pulse animation for speaking state
  useEffect(() => {
    if (clientState === 'AI_SPEAKING' || clientState === 'USER_SPEAKING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [clientState, pulseAnim]);

  const handleEndCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    ToastService.show({ message: 'Call ended', type: 'info', duration: 1500 });
    navigation.goBack();
  }, [navigation]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      clientRef.current?.audioCapture.stopCapture();
    } else {
      clientRef.current?.audioCapture.startCapture();
    }
  }, [isMuted]);

  const handleToggleSpeaker = useCallback(() => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    clientRef.current?.audioPlayback.setSpeaker(nextSpeaker);
  }, [isSpeakerOn]);

  const handlePushToTalkIn = useCallback(() => {
    if (voiceMode === 'push_to_talk') {
      clientRef.current?.audioCapture.triggerSpeechStart();
    }
  }, [voiceMode]);

  const handlePushToTalkOut = useCallback(() => {
    if (voiceMode === 'push_to_talk') {
      clientRef.current?.audioCapture.triggerSpeechEnd();
    }
  }, [voiceMode]);

  const handleBargeIn = useCallback(() => {
    clientRef.current?.interruptAI();
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateLabel = () => {
    switch (clientState) {
      case 'CONNECTING':
        return 'Connecting...';
      case 'LISTENING':
        return 'Listening';
      case 'USER_SPEAKING':
        return 'You are speaking';
      case 'PROCESSING':
        return 'Thinking...';
      case 'AI_SPEAKING':
        return `${characterName || 'Companion'} is speaking`;
      case 'INTERRUPTED':
        return 'Interrupted';
      case 'RECONNECTING':
        return 'Reconnecting...';
      case 'ERROR':
        return 'Connection Error';
      default:
        return 'Ready';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={darkThemeColors.background} />

      {/* Top Header */}
      <View style={styles.header}>
        <IconButton
          icon="close"
          size="md"
          variant="surface"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Minimize call"
        />

        <View style={styles.headerInfo}>
          <Text style={styles.characterHeaderName}>{characterName || 'AI Companion'}</Text>
          <Text style={styles.timerText}>{formatTimer(sessionSeconds)}</Text>
        </View>

        <IconButton
          icon="CC"
          size="md"
          variant={showSubtitles ? 'accent' : 'surface'}
          onPress={() => setShowSubtitles(!showSubtitles)}
          accessibilityLabel="Toggle live subtitles"
        />
      </View>

      {/* Center Character Avatar & Waveform */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.avatarGlowContainer,
            { transform: [{ scale: pulseAnim }] },
            clientState === 'AI_SPEAKING' && styles.avatarGlowSpeaking,
            clientState === 'USER_SPEAKING' && styles.avatarGlowUser,
          ]}
        >
          <Avatar
            uri={characterAvatarUrl}
            name={characterName || 'AI'}
            size="huge"
          />
        </Animated.View>

        {/* State Label */}
        <View style={styles.stateBadge}>
          <View
            style={[
              styles.stateDot,
              clientState === 'AI_SPEAKING' && styles.stateDotSpeaking,
              clientState === 'USER_SPEAKING' && styles.stateDotUser,
            ]}
          />
          <Text style={styles.stateLabelText}>{getStateLabel()}</Text>
        </View>

        {/* Dynamic Waveform Visualizer */}
        <View style={styles.waveformContainer}>
          {waveformAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                { transform: [{ scaleY: anim }] },
                clientState === 'AI_SPEAKING' && styles.waveformBarSpeaking,
                clientState === 'USER_SPEAKING' && styles.waveformBarUser,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Live Subtitles Drawer */}
      {showSubtitles && (
        <View style={styles.subtitlesContainer}>
          <ScrollView contentContainerStyle={styles.subtitlesScroll} showsVerticalScrollIndicator={false}>
            {userTranscript ? (
              <Text style={styles.userSubtitleText}>
                <Text style={styles.subtitleSpeaker}>You: </Text>
                {userTranscript}
              </Text>
            ) : null}
            {aiTranscript ? (
              <Text style={styles.aiSubtitleText}>
                <Text style={styles.subtitleSpeaker}>{characterName || 'Companion'}: </Text>
                {aiTranscript}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* Mode Toggle Banner */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeTab, voiceMode === 'hands_free' && styles.modeTabActive]}
          onPress={() => {
            setVoiceMode('hands_free');
            clientRef.current?.audioCapture.setMode('hands_free');
          }}
          accessibilityRole="tab"
          accessibilityLabel="Hands-free continuous conversation mode"
        >
          <Text style={[styles.modeTabText, voiceMode === 'hands_free' && styles.modeTabTextActive]}>
            Hands-Free
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, voiceMode === 'push_to_talk' && styles.modeTabActive]}
          onPress={() => {
            setVoiceMode('push_to_talk');
            clientRef.current?.audioCapture.setMode('push_to_talk');
          }}
          accessibilityRole="tab"
          accessibilityLabel="Push-to-talk mode"
        >
          <Text style={[styles.modeTabText, voiceMode === 'push_to_talk' && styles.modeTabTextActive]}>
            Push-to-Talk
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Control Bar */}
      <View style={styles.controlsContainer}>
        <IconButton
          icon={isMuted ? 'mic-off' : 'mic'}
          size="lg"
          variant={isMuted ? 'danger' : 'surface'}
          onPress={handleToggleMute}
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        />

        {voiceMode === 'push_to_talk' ? (
          <TouchableOpacity
            style={[styles.pttButton, clientState === 'USER_SPEAKING' && styles.pttButtonActive]}
            onPressIn={handlePushToTalkIn}
            onPressOut={handlePushToTalkOut}
            accessibilityLabel="Hold to speak"
          >
            <Text style={styles.pttButtonText}>
              {clientState === 'USER_SPEAKING' ? 'Listening...' : 'Hold to Speak'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Button
            label="Interrupt"
            variant={clientState === 'AI_SPEAKING' ? 'danger' : 'secondary'}
            size="md"
            onPress={handleBargeIn}
            accessibilityLabel="Interrupt companion speech"
          />
        )}

        <IconButton
          icon={isSpeakerOn ? 'speaker' : 'speaker-off'}
          size="lg"
          variant={isSpeakerOn ? 'surface' : 'default'}
          onPress={handleToggleSpeaker}
          accessibilityLabel={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
        />

        <IconButton
          icon="phone-off"
          size="lg"
          variant="danger"
          onPress={handleEndCall}
          accessibilityLabel="End voice call"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerInfo: {
    alignItems: 'center',
  },
  characterHeaderName: {
    color: darkThemeColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  timerText: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  avatarGlowContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    padding: 6,
    backgroundColor: darkThemeColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: darkThemeColors.borderSubtle,
  },
  avatarGlowSpeaking: {
    borderColor: darkThemeColors.speaking,
    shadowColor: darkThemeColors.speaking,
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarGlowUser: {
    borderColor: darkThemeColors.userSpeaking,
    shadowColor: darkThemeColors.userSpeaking,
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkThemeColors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: darkThemeColors.textMuted,
    marginRight: spacing.sm,
  },
  stateDotSpeaking: {
    backgroundColor: darkThemeColors.speaking,
  },
  stateDotUser: {
    backgroundColor: darkThemeColors.userSpeaking,
  },
  stateLabelText: {
    color: darkThemeColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    marginTop: spacing.lg,
    gap: 8,
  },
  waveformBar: {
    width: 6,
    height: 36,
    borderRadius: 3,
    backgroundColor: darkThemeColors.surfaceElevated,
  },
  waveformBarSpeaking: {
    backgroundColor: darkThemeColors.speaking,
  },
  waveformBarUser: {
    backgroundColor: darkThemeColors.userSpeaking,
  },
  subtitlesContainer: {
    maxHeight: 110,
    backgroundColor: darkThemeColors.surfaceElevated,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  subtitlesScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  subtitleSpeaker: {
    fontWeight: '700',
    color: darkThemeColors.textMuted,
  },
  userSubtitleText: {
    color: darkThemeColors.userSpeaking,
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  aiSubtitleText: {
    color: darkThemeColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: darkThemeColors.surfaceElevated,
    marginHorizontal: spacing.xxl,
    borderRadius: radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: darkThemeColors.borderSubtle,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  modeTabActive: {
    backgroundColor: darkThemeColors.surfaceHover,
  },
  modeTabText: {
    color: darkThemeColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: darkThemeColors.textPrimary,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  pttButton: {
    paddingHorizontal: spacing.xl,
    height: 52,
    borderRadius: 26,
    backgroundColor: darkThemeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttButtonActive: {
    backgroundColor: darkThemeColors.userSpeaking,
  },
  pttButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  endCallRotate: {
    transform: [{ rotate: '135deg' }],
  },
});
