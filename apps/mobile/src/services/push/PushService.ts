import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance, AndroidStyle, AuthorizationStatus, EventType, type Event } from '@notifee/react-native';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import type { PushPermissionStatus } from '@ai-companion/types';
import { NotificationApi } from '../api/notificationApi.js';
import { APP_VERSION } from '../../config/appInfo.js';

/**
 * Push notifications (Firebase Cloud Messaging + Notifee).
 *
 * - The server sends "notification" messages: when the app is closed Android draws them itself
 *   (works even on phones that kill background apps); while the app is open we draw them here,
 *   unless the user is already looking at that chat.
 * - Permission is never asked on first launch: PushPrimer asks after a good chat (askPermission).
 * - Tapping a notification opens the chat / screen in its data (see open()).
 */

type PushData = Record<string, string | object | undefined>;
export type PushOpenTarget = { characterId?: string; conversationId?: string; deepLink?: string; campaignId?: string; nkey?: string };

const DEVICE_ID_KEY = 'push.deviceId';
const ASKED_KEY = 'push.askedAt';

const CHANNELS = [
  { id: 'messages', name: 'Messages from characters', importance: AndroidImportance.HIGH },
  { id: 'reminders', name: 'Reminders you set', importance: AndroidImportance.HIGH },
  { id: 'account', name: 'Account & payments', importance: AndroidImportance.DEFAULT },
  { id: 'news', name: 'News & offers', importance: AndroidImportance.DEFAULT },
] as const;

let navigator: { open: (t: PushOpenTarget) => void; isViewingChat: (characterId: string) => boolean } | null = null;
let pendingOpen: PushOpenTarget | null = null;
let started = false;
const chatPushListeners = new Set<(characterId: string) => void>();
const anyPushListeners = new Set<(data: PushData) => void>();
let signedIn = false;

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const targetOf = (data: PushData | undefined): PushOpenTarget => ({
  characterId: str(data?.characterId),
  conversationId: str(data?.conversationId),
  deepLink: str(data?.deepLink),
  campaignId: str(data?.campaignId),
  nkey: str(data?.nkey),
});

function open(target: PushOpenTarget) {
  if (target.campaignId) void NotificationApi.campaignAction(target.campaignId, 'open').catch(() => undefined);
  if (target.nkey) void NotificationApi.opened(target.nkey).catch(() => undefined);
  if (!target.characterId && !target.deepLink) return;
  if (navigator && signedIn) navigator.open(target);
  else pendingOpen = target; // opened from a closed app: wait until sign-in and navigation are ready
}

async function deviceId(): Promise<string> {
  const saved = await AsyncStorage.getItem(DEVICE_ID_KEY).catch(() => null);
  if (saved) return saved;
  const id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id).catch(() => undefined);
  return id;
}

function toStatus(s: AuthorizationStatus): PushPermissionStatus {
  if (s === AuthorizationStatus.AUTHORIZED) return 'AUTHORIZED';
  if (s === AuthorizationStatus.PROVISIONAL) return 'PROVISIONAL';
  if (s === AuthorizationStatus.DENIED) return 'DENIED';
  return 'NOT_DETERMINED';
}

/** Draws a push that arrived while the app is open (Android only draws it when the app is closed). */
async function showInApp(message: RemoteMessage) {
  const data = (message.data ?? {}) as PushData;
  const characterId = str(data.characterId);
  anyPushListeners.forEach((l) => l(data));
  if (characterId) chatPushListeners.forEach((l) => l(characterId));
  if (characterId && navigator?.isViewingChat(characterId)) return; // the open chat shows it instead
  const title = message.notification?.title ?? str(data.title);
  const body = message.notification?.body ?? str(data.body);
  if (!title && !body) return;
  const image = str(data.imageUrl) ?? message.notification?.android?.imageUrl;
  await notifee.displayNotification({
    id: str(data.tag),
    title,
    body,
    data: Object.fromEntries(Object.entries(data).filter((e): e is [string, string] => typeof e[1] === 'string')),
    android: {
      channelId: str(data.channel) ?? 'messages',
      smallIcon: 'ic_notification',
      color: '#EC4899',
      pressAction: { id: 'default', launchActivity: 'default' },
      ...(image && { style: { type: AndroidStyle.BIGPICTURE, picture: image } }),
    },
  });
}

async function register() {
  if (!signedIn) return;
  try {
    const status = toStatus((await notifee.getNotificationSettings()).authorizationStatus);
    const token = await getToken(getMessaging());
    await NotificationApi.registerDevice({
      deviceId: await deviceId(),
      pushToken: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: APP_VERSION,
      pushPermissionStatus: status,
    });
  } catch {
    // Offline or Play services missing: try again next time the app opens.
  }
}

const onNotifeeEvent = async ({ type, detail }: Event) => {
  if (type === EventType.PRESS) open(targetOf(detail.notification?.data as PushData));
};

export const PushService = {
  /** Called once from index.js, before the app renders (also runs for background deliveries). */
  installBackgroundHandlers() {
    // Notification messages are drawn by Android itself; nothing to do for them in the background.
    setBackgroundMessageHandler(getMessaging(), async () => undefined);
    notifee.onBackgroundEvent(onNotifeeEvent);
  },

  /** Starts listening once the app is on screen. */
  async start() {
    if (started) return;
    started = true;
    await Promise.all(CHANNELS.map((c) => notifee.createChannel({ ...c, sound: 'default', vibration: true }))).catch(() => undefined);
    const messaging = getMessaging();
    onMessage(messaging, (m) => void showInApp(m));
    onNotificationOpenedApp(messaging, (m) => open(targetOf(m.data as PushData)));
    onTokenRefresh(messaging, () => void register());
    notifee.onForegroundEvent(onNotifeeEvent);
    const fromClosed = await getInitialNotification(messaging).catch(() => null);
    if (fromClosed) open(targetOf(fromClosed.data as PushData));
    const fromNotifee = await notifee.getInitialNotification().catch(() => null);
    if (fromNotifee) open(targetOf(fromNotifee.notification.data as PushData));
    // Coming back from Android settings may have changed the permission: tell the server.
    AppState.addEventListener('change', (s) => s === 'active' && void register());
  },

  /** A push about a chat arrived while the app is open (refresh that chat and the Chats list). */
  onChatPush(listener: (characterId: string) => void): () => void {
    chatPushListeners.add(listener);
    return () => {
      chatPushListeners.delete(listener);
    };
  },

  /** Any push that arrived while the app is open (e.g. a campaign with a popup to fetch). */
  onPush(listener: (data: PushData) => void): () => void {
    anyPushListeners.add(listener);
    return () => {
      anyPushListeners.delete(listener);
    };
  },

  /** The app's navigation, so a tapped notification can open the right chat. */
  setNavigator(n: typeof navigator) {
    navigator = n;
    if (n && signedIn && pendingOpen) {
      const t = pendingOpen;
      pendingOpen = null;
      n.open(t);
    }
  },

  /** Sign-in state: registers this phone with the server for the signed-in account. */
  async setSignedIn(value: boolean) {
    signedIn = value;
    if (!value) return;
    await register();
    if (navigator && pendingOpen) PushService.setNavigator(navigator);
  },

  /** Before signing out: this account stops getting pushes on this phone. */
  async unregister() {
    try {
      await NotificationApi.unregisterDevice(await deviceId());
    } catch {
      // Never block sign-out; the next account's sign-in moves the token anyway.
    }
  },

  async permission(): Promise<PushPermissionStatus> {
    return toStatus((await notifee.getNotificationSettings()).authorizationStatus);
  },

  /** Whether we have shown Android's permission popup before (Android can't tell "never asked" from "denied"). */
  async askedAt(): Promise<number | null> {
    return Number(await AsyncStorage.getItem(ASKED_KEY).catch(() => null)) || null;
  },

  /** Shows Android's permission popup; afterwards registers the result. */
  async askPermission(): Promise<boolean> {
    await AsyncStorage.setItem(ASKED_KEY, String(Date.now())).catch(() => undefined);
    const settings = await notifee.requestPermission();
    await register();
    return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
  },

  /** After Android stops showing the popup (denied twice), the only way is the app's settings page. */
  openSettings() {
    notifee.openNotificationSettings().catch(() => Linking.openSettings());
  },
};
