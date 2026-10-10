import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Typography } from './common/index.js';
import { api } from '../services/api/client.js';
import { APP_VERSION } from '../config/appInfo.js';
import { darkThemeColors, spacing } from '../theme/index.js';
import { compareVersions } from '../utils/versions.js';
import { Realtime } from '../services/realtime/RealtimeClient.js';
import { MaintenanceScreen } from './MaintenanceScreen.js';
import { useMaintenanceStore, type MaintenanceInfo } from '../stores/maintenanceStore.js';

/**
 * What the team sets in the admin console → Settings, shown over the whole app (and maintenance mode,
 * MaintenanceScreen):
 *  - an announcement banner at the top (each text can be closed once; a new text shows again);
 *  - "Please update" when this app is older than the minimum version (can't be closed).
 * Read on launch and whenever the app comes back to the foreground (at most every 5 minutes).
 */

interface AppConfig {
  announcement: { id: string; text: string } | null;
  minVersion: string | null;
  maintenance: MaintenanceInfo | null;
}

const DISMISSED_KEY = 'appNotices.dismissedAnnouncement';
const PLAY_ID = 'com.aicompanionmobile';
const REFRESH_MS = 5 * 60_000;

const openStore = () => {
  const market = Platform.OS === 'android' ? `market://details?id=${PLAY_ID}` : `https://play.google.com/store/apps/details?id=${PLAY_ID}`;
  Linking.openURL(market).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_ID}`).catch(() => undefined));
};

export const AppNotices: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lastFetch = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < REFRESH_MS) return;
    lastFetch.current = Date.now();
    try {
      const res = await api.get('/app/config');
      const cfg = (res.data?.data ?? null) as AppConfig | null;
      setConfig(cfg);
      useMaintenanceStore.getState().set(cfg?.maintenance ?? null);
    } catch {
      lastFetch.current = 0; // offline: try again next time the app opens
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(setDismissed).catch(() => undefined);
    void load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
    // The team changed the announcement or the minimum version: show it now.
    const off = Realtime.on((e) => e.type === 'settings.updated' && void load(true));
    return () => {
      sub.remove();
      off();
    };
  }, [load]);

  const mustUpdate = Boolean(config?.minVersion && compareVersions(APP_VERSION, config.minVersion) < 0);
  const announcement = config?.announcement && config.announcement.id !== dismissed ? config.announcement : null;

  const dismiss = () => {
    if (!announcement) return;
    setDismissed(announcement.id);
    AsyncStorage.setItem(DISMISSED_KEY, announcement.id).catch(() => undefined);
  };

  return (
    <>
      <MaintenanceScreen onRetry={() => load(true)} />
      {announcement && !mustUpdate && (
        <View pointerEvents="box-none" style={[styles.bannerWrap, { top: insets.top + spacing.xs }]}>
          <Banner type="info" message={announcement.text} onDismiss={dismiss} />
        </View>
      )}
      <Modal visible={mustUpdate} animationType="fade" transparent statusBarTranslucent onRequestClose={() => undefined}>
        <View style={[styles.updateBackdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.updateCard}>
            <Typography variant="displayMedium" style={styles.updateTitle}>Time to update 💜</Typography>
            <Typography variant="bodyMedium" style={styles.updateBody}>
              A new version of the app is ready, with fixes and new things. Please update to keep chatting.
            </Typography>
            <Button label="Update now" variant="primary" size="lg" onPress={openStore} />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    elevation: 50,
  },
  updateBackdrop: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  updateCard: {
    gap: spacing.lg,
  },
  updateTitle: {
    color: darkThemeColors.textPrimary,
    textAlign: 'center',
  },
  updateBody: {
    color: darkThemeColors.textSecondary,
    textAlign: 'center',
  },
});
