import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay's REST API (v1) with the account's key id + secret — no SDK. Env:
 *  - RAZORPAY_KEY_ID      public; the app's checkout uses it too (rzp_test_… / rzp_live_…)
 *  - RAZORPAY_KEY_SECRET  server only: API calls and checkout signatures
 *  - RAZORPAY_WEBHOOK_SECRET  the secret set on the webhook in Razorpay → Settings → Webhooks
 * Every payment is checked here (signature + Razorpay's own record); the phone's word is never enough.
 */

const API = 'https://api.razorpay.com/v1';

export const razorpayConfigured = (): boolean => Boolean(process.env['RAZORPAY_KEY_ID'] && process.env['RAZORPAY_KEY_SECRET']);
export const razorpayKeyId = (): string => process.env['RAZORPAY_KEY_ID'] ?? '';

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function rzp<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env['RAZORPAY_KEY_ID']}:${process.env['RAZORPAY_KEY_SECRET']}`).toString('base64');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let reason = text.slice(0, 200);
    try {
      reason = (JSON.parse(text) as { error?: { description?: string } }).error?.description ?? reason;
    } catch {
      /* not JSON */
    }
    throw new RazorpayApiError(`Razorpay ${method} ${path.split('?')[0]}: HTTP ${res.status} ${reason}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

function sameHex(expected: string, given: string | undefined): boolean {
  if (!given || given.length !== expected.length || !/^[0-9a-f]+$/i.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'));
}

/** Checkout's signature for a one-time order: HMAC(order_id|payment_id). */
export const orderSignatureValid = (orderId: string, paymentId: string, signature: string | undefined): boolean =>
  sameHex(hmac(process.env['RAZORPAY_KEY_SECRET'] ?? '', `${orderId}|${paymentId}`), signature);

/** Checkout's signature for a subscription's first payment: HMAC(payment_id|subscription_id) or HMAC(subscription_id|payment_id). */
export const subscriptionSignatureValid = (subscriptionId: string, paymentId: string, signature: string | undefined): boolean => {
  const secret = process.env['RAZORPAY_KEY_SECRET'] ?? '';
  return (
    sameHex(hmac(secret, `${paymentId}|${subscriptionId}`), signature) ||
    sameHex(hmac(secret, `${subscriptionId}|${paymentId}`), signature)
  );
};

/** A webhook is Razorpay's only when its X-Razorpay-Signature is HMAC(raw body) with the webhook secret. */
export function webhookSignatureValid(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env['RAZORPAY_WEBHOOK_SECRET'];
  if (!secret) return false;
  return sameHex(hmac(secret, rawBody), signature);
}

// ── The parts of Razorpay's entities used here ──────────────────────────────

export interface RzpPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id?: string | null;
  invoice_id?: string | null;
  method?: string;
  created_at: number;
  notes?: Record<string, string> | [];
}

export interface RzpSubscription {
  id: string;
  plan_id: string;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired' | 'paused';
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  charge_at?: number | null;
  paid_count?: number;
  notes?: Record<string, string> | [];
}

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string> | [];
}

export const notesOf = (e: { notes?: Record<string, string> | [] } | undefined): Record<string, string> =>
  e?.notes && !Array.isArray(e.notes) ? e.notes : {};
