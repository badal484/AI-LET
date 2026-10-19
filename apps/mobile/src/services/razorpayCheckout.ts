import RazorpayCheckout from 'react-native-razorpay';
import { api } from './api/client.js';
import { useAuthStore } from '../stores/authStore.js';

/**
 * Paying with UPI / cards / netbanking through Razorpay (India), offered next to Google Play through Play's
 * user choice billing. The flow the person sees: Razorpay's sheet → their UPI app → one PIN → done.
 * For Premium that one PIN pays ₹1 and sets up UPI Autopay (₹499 a month from tomorrow).
 * The server checks every payment with Razorpay before anything is granted.
 */

export interface UpiConfig {
  enabled: boolean;
  keyId: string | null;
  userChoiceBilling: boolean;
  premium: { firstDayMinorUnits: number; monthlyMinorUnits: number };
  coinPacks: Array<{ id: string; coins: number; amountMinorUnits: number }>;
}

let cached: { at: number; config: UpiConfig } | null = null;

export async function loadUpiConfig(force = false): Promise<UpiConfig | null> {
  if (!force && cached && Date.now() - cached.at < 5 * 60_000) return cached.config;
  try {
    const res = await api.get('/billing/razorpay/config');
    cached = { at: Date.now(), config: res.data.data as UpiConfig };
    return cached.config;
  } catch {
    return cached?.config ?? null;
  }
}

export const rupees = (minor: number) => `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: minor % 100 ? 2 : 0 })}`;

export type PayIntent = { kind: 'premium' } | { kind: 'coins'; packId: string };
export type PayResult = { ok: boolean; message?: string };

const BRAND = { name: 'Loveek', theme: { color: '#8B5CF6' } };
/** The Loveek heart on Razorpay's checkout (served by our API), instead of Razorpay's letter placeholder. */
const brandFor = (started: Record<string, unknown>) => ({ ...BRAND, ...(typeof started['logoUrl'] === 'string' && { image: started['logoUrl'] }) });

function prefill() {
  const user = useAuthStore.getState().user;
  return { email: user?.email ?? '', name: user?.profile?.displayName ?? '' };
}

/** Confirms with the server; retried a few times on a bad connection (the webhook also confirms it). */
async function confirmWithServer(body: Record<string, string | undefined>): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await api.post('/billing/razorpay/confirm', body);
      return true;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status && status < 500) return false; // refused: retrying won't help
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return false;
}

/** Opens Razorpay for Premium or a coin pack. `googleToken` comes from Google's choice screen (user choice billing). */
export async function payWithRazorpay(intent: PayIntent, googleToken?: string): Promise<PayResult> {
  let started: Record<string, unknown>;
  try {
    started =
      intent.kind === 'premium'
        ? (await api.post('/billing/razorpay/premium', { googleToken })).data.data
        : (await api.post('/billing/razorpay/coins', { packId: intent.packId, googleToken })).data.data;
  } catch (err) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    return { ok: false, message: msg ?? "Couldn't start the payment — check your connection and try again." };
  }

  const options =
    intent.kind === 'premium'
      ? {
          key: String(started['keyId']),
          subscription_id: String(started['subscriptionId']),
          description: `Premium · ${rupees(Number(started['firstDayMinorUnits']))} today, then ${rupees(Number(started['monthlyMinorUnits']))}/month`,
          ...brandFor(started),
          prefill: prefill(),
        }
      : {
          key: String(started['keyId']),
          order_id: String(started['orderId']),
          amount: Number(started['amountMinorUnits']),
          currency: 'INR',
          description: `${Number(started['coins']).toLocaleString('en-IN')} coins`,
          ...brandFor(started),
          prefill: prefill(),
        };

  let paid: { razorpay_payment_id: string; razorpay_signature: string; razorpay_subscription_id?: string; razorpay_order_id?: string };
  try {
    paid = await RazorpayCheckout.open(options);
  } catch (err) {
    const e = err as { code?: number; description?: string; error?: { description?: string } };
    const text = `${e.description ?? ''} ${e.error?.description ?? ''}`;
    if (e.code === 0 || e.code === 2 || /cancel/i.test(text)) return { ok: false }; // they closed it
    return { ok: false, message: 'The payment didn’t go through. If money was taken, it’s refunded automatically — please try again.' };
  }

  const ok = await confirmWithServer({
    kind: intent.kind,
    paymentId: paid.razorpay_payment_id,
    signature: paid.razorpay_signature,
    subscriptionId: intent.kind === 'premium' ? paid.razorpay_subscription_id ?? String(started['subscriptionId']) : undefined,
    orderId: intent.kind === 'coins' ? paid.razorpay_order_id ?? String(started['orderId']) : undefined,
  });
  return ok
    ? { ok: true }
    : { ok: false, message: 'Payment received — it can take a minute to show. You won’t be charged twice.' };
}

export async function cancelUpiPremium(): Promise<{ ok: boolean; premiumUntil?: string; message?: string }> {
  try {
    const res = await api.post('/billing/razorpay/cancel', {});
    return { ok: true, premiumUntil: res.data.data.premiumUntil };
  } catch {
    return { ok: false, message: "Couldn't cancel right now — please try again in a moment." };
  }
}
