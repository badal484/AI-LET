import { readServiceAccount, tokenSource } from '../../../infrastructure/google/serviceAccount.js';

/**
 * Google Play Developer API (androidpublisher v3) with a service account — no extra SDK.
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON (the key file's JSON, raw or base64) and GOOGLE_PLAY_PACKAGE_NAME.
 * The service account must be invited in Play Console → Users and permissions (financial data / orders).
 */

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export function googlePlayConfigured(): boolean {
  return Boolean(process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] && process.env['GOOGLE_PLAY_PACKAGE_NAME']);
}

const accessToken = tokenSource(() => {
  const sa = readServiceAccount(process.env['GOOGLE_SERVICE_ACCOUNT_JSON']);
  if (!sa) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  return sa;
}, SCOPE);

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
