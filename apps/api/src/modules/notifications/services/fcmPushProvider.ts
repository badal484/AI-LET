import type { PushChannel, PushPayload } from '@ai-companion/types';
import { readServiceAccount, tokenSource, type ServiceAccount } from '../../../infrastructure/google/serviceAccount.js';
import type { IPushProvider, PushSendResult } from './pushProvider.interface.js';

/**
 * Firebase Cloud Messaging (HTTP v1). Env: FIREBASE_SERVICE_ACCOUNT_JSON — the Firebase Admin key
 * (Project settings → Service accounts), raw JSON, base64, or a path to the file locally.
 *
 * Sent as a notification message so Android itself draws it even when the app is closed or killed
 * (phones that stop background apps still show it); the app draws it when it is open.
 */

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const CHANNEL_FOR: Record<string, PushChannel> = {
  character_message: 'messages',
  conversation_reply: 'messages',
  reminder: 'reminders',
  user_reminder: 'reminders',
  billing: 'account',
  subscription: 'account',
  usage_limit: 'account',
  security: 'account',
  system: 'account',
  campaign: 'news',
  product_update: 'news',
  recommendations: 'news',
};

export const channelFor = (type: string): PushChannel => CHANNEL_FOR[type] ?? 'messages';

export function fcmConfigured(): boolean {
  return Boolean(process.env['FIREBASE_SERVICE_ACCOUNT_JSON']?.trim());
}

export class FcmPushProvider implements IPushProvider {
  public readonly providerName = 'fcm';
  private readonly account: ServiceAccount;
  private readonly accessToken: () => Promise<string>;

  constructor(raw = process.env['FIREBASE_SERVICE_ACCOUNT_JSON']) {
    const sa = readServiceAccount(raw);
    if (!sa?.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing or has no project_id');
    this.account = sa;
    this.accessToken = tokenSource(() => sa, SCOPE);
  }

  public async sendPush(payload: PushPayload): Promise<PushSendResult> {
    const channel = payload.channel ?? channelFor(payload.data.type);
    // FCM data values must be strings.
    const data = Object.fromEntries(
      Object.entries({ ...payload.data, channel, title: payload.title, body: payload.body, imageUrl: payload.imageUrl, tag: payload.tag }).filter(
        (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
      ),
    );
    const message = {
      token: payload.toToken,
      notification: { title: payload.title, body: payload.body, ...(payload.imageUrl && { image: payload.imageUrl }) },
      data,
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        ...(payload.tag && { collapse_key: payload.tag }),
        notification: {
          channel_id: channel,
          icon: 'ic_notification',
          color: '#EC4899',
          ...(payload.tag && { tag: payload.tag }),
          ...(payload.sound === false ? {} : { sound: 'default' }),
          ...(payload.imageUrl && { image: payload.imageUrl }),
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      return { success: false, error: `FCM unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (res.ok) {
      const ok = (await res.json()) as { name?: string };
      return { success: true, messageId: ok.name?.split('/').pop() };
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> };
    };
    const code = body.error?.details?.find((d) => d.errorCode)?.errorCode ?? body.error?.status ?? `HTTP ${res.status}`;
    // The app was uninstalled or the token is stale/garbage: stop using this device.
    const isInvalidToken =
      code === 'UNREGISTERED' ||
      (code === 'INVALID_ARGUMENT' && /registration token/i.test(body.error?.message ?? '')) ||
      code === 'SENDER_ID_MISMATCH';
    return { success: false, isInvalidToken, error: `${code}: ${(body.error?.message ?? '').slice(0, 160)}` };
  }
}
