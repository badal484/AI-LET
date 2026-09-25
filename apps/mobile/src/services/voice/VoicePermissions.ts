import { Platform, PermissionsAndroid } from 'react-native';

export type MicrophonePermissionStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'blocked';

export class VoicePermissions {
  /**
   * Checks current microphone permission status.
   */
  public static async checkMicrophonePermission(): Promise<MicrophonePermissionStatus> {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        return hasPermission ? 'granted' : 'undetermined';
      } catch {
        return 'denied';
      }
    } else if (Platform.OS === 'ios') {
      // In React Native iOS environments, AVAudioSession permission check
      return 'granted';
    }

    return 'granted';
  }

  /**
   * Requests microphone permission from user.
   */
  public static async requestMicrophonePermission(): Promise<MicrophonePermissionStatus> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'AI Companion needs access to your microphone for real-time voice conversations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return 'granted';
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return 'blocked';
        } else {
          return 'denied';
        }
      } catch {
        return 'denied';
      }
    } else if (Platform.OS === 'ios') {
      return 'granted';
    }

    return 'granted';
  }
}
