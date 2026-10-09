import { createSign } from 'node:crypto';

/**
 * Google Play Developer API (androidpublisher v3) with a service account — no extra SDK.
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON (the key file's JSON, raw or base64) and GOOGLE_PLAY_PACKAGE_NAME.
 * The service account must be invited in Play Console → Users and permissions (financial data / orders).
 */

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function googlePlayConfigured(): boolean {
  return Boolean(process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] && process.env['GOOGLE_PLAY_PACKAGE_NAME']);
}

function serviceAccount(): ServiceAccount {
  const raw = process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ?? '';
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(json) as ServiceAccount;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const pkg = process.env['GOOGLE_PLAY_PACKAGE_NAME'];
  const res = await fetch(`${API}/${pkg}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`Google Play API ${method} ${path.split('/tokens/')[0]}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** subscriptionsv2 — the current state of a subscription purchase. */
export interface PlaySubscription {
  subscriptionState:
    | 'SUBSCRIPTION_STATE_PENDING'
    | 'SUBSCRIPTION_STATE_ACTIVE'
    | 'SUBSCRIPTION_STATE_PAUSED'
    | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    | 'SUBSCRIPTION_STATE_ON_HOLD'
    | 'SUBSCRIPTION_STATE_CANCELED'
    | 'SUBSCRIPTION_STATE_EXPIRED'
    | 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'
    | string;
  acknowledgementState?: 'ACKNOWLEDGEMENT_STATE_PENDING' | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' | string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  startTime?: string;
  testPurchase?: Record<string, never>;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{ productId: string; expiryTime?: string; offerDetails?: { basePlanId?: string; offerId?: string; offerTags?: string[] } }>;
}

export const getSubscription = (purchaseToken: string) =>
  call<PlaySubscription>('GET', `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);

/** Unacknowledged purchases are refunded by Google after 3 days. */
export const acknowledgeSubscription = (productId: string, purchaseToken: string) =>
  call<unknown>('POST', `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {});

export interface PlayProductPurchase {
  purchaseState?: number; // 0 purchased, 1 cancelled, 2 pending
  consumptionState?: number; // 0 not consumed, 1 consumed
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  purchaseType?: number; // 0 test
}

export const getProductPurchase = (productId: string, purchaseToken: string) =>
  call<PlayProductPurchase>('GET', `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`);

/** A message pack is consumable: consumed once its messages are granted, so it can be bought again. */
export const consumeProduct = (productId: string, purchaseToken: string) =>
  call<unknown>('POST', `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`, {});
