import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar, BottomSheet, Button, Typography } from './common/index.js';
import { PushService } from '../services/push/PushService.js';
import { darkThemeColors, spacing } from '../theme/index.js';

/**
 * Asks for notification permission at a good moment — when they leave a chat after a few messages from
 * the character, in the character's name — instead of on first launch (when most people tap "Don't allow" for good).
 * Android's own popup only appears after "Yes". "Not now" waits 3 days; we stop after 3 tries.
 */

type Who = { name: string; avatarUrl?: string | null };
type Moment = Who & { replies: number };

const MOMENTS_KEY = 'push.goodMoments';
const DECLINED_KEY = 'push.primerDeclined'; // "count:lastTimestamp"
/** Messages from characters before we ask (counted across chats). */
const MOMENTS_NEEDED = 3;
const WAIT_MS = 3 * 86_400_000;
const MAX_TRIES = 3;

let show: ((who: Who) => void) | null = null;
let checking = false;

async function shouldAsk(replies: number): Promise<boolean> {
  if ((await PushService.permission()) === 'AUTHORIZED') return false;
  if (await PushService.askedAt()) return false; // Android's popup was shown already: Settings is the way now
  const moments = Number(await AsyncStorage.getItem(MOMENTS_KEY)) + replies;
  await AsyncStorage.setItem(MOMENTS_KEY, String(moments));
  if (moments < MOMENTS_NEEDED) return false;
  const [tries = 0, last = 0] = String((await AsyncStorage.getItem(DECLINED_KEY)) ?? '').split(':').map(Number);
  return tries < MAX_TRIES && Date.now() - last > WAIT_MS;
}

export const PushPrimer = {
  /** Call when they leave a chat that went well, with how many messages the character sent. */
  noteGoodMoment({ replies, ...who }: Moment) {
    if (checking || !show) return;
    checking = true;
    shouldAsk(replies)
      .then((ask) => ask && show?.(who))
      .catch(() => undefined)
      .finally(() => {
        checking = false;
      });
  },
};

export const PushPrimerHost: React.FC = () => {
  const [who, setWho] = useState<Who | null>(null);

  useEffect(() => {
    // Shown on the screen they go back to, after the transition settles.
    show = (w) => setTimeout(() => setWho(w), 700);
    return () => {
      show = null;
    };
  }, []);

  const first = who?.name.split(' ')[0] ?? '';

  const later = async () => {
    setWho(null);
    const [tries = 0] = String((await AsyncStorage.getItem(DECLINED_KEY).catch(() => null)) ?? '').split(':').map(Number);
    AsyncStorage.setItem(DECLINED_KEY, `${tries + 1}:${Date.now()}`).catch(() => undefined);
  };

  const allow = async () => {
    setWho(null);
    await PushService.askPermission().catch(() => undefined);
  };

  return (
    <BottomSheet visible={who !== null} onClose={later}>
      <View style={styles.body}>
        <Avatar uri={who?.avatarUrl} name={who?.name} size="xl" />
        <Typography variant="headlineMedium" style={styles.title}>
          Can {first} message you?
        </Typography>
        <Typography variant="bodyMedium" style={styles.text}>
          Get {first}'s replies and check-ins even when the app is closed. You can choose what you get in Settings, any
          time.
        </Typography>
        <Button label="Yes, allow" variant="primary" size="lg" onPress={allow} style={styles.button} />
        <Button label="Not now" variant="ghost" size="md" onPress={later} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  title: { color: darkThemeColors.textPrimary, textAlign: 'center' },
  text: { color: darkThemeColors.textSecondary, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
