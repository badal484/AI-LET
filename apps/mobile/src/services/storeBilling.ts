import { Linking, Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
} from 'react-native-iap';
import { billingApi } from './api/billingApi.js';
import { api } from './api/client.js';
import { isoDays } from '../utils/isoPeriod.js';

/**
 * Google Play Billing. Every purchase is verified by our server (which checks it with Google,
 * acknowledges it and ties it to this account) before it's finished here — nothing is granted on
 * the phone's word. Play Console catalog: subscription `companion_premium` (base plans monthly /
 * weekly / yearly; offer `trial` = ₹1 for 1 day on monthly) and consumable `messages_100`.
 */

export type BasePlan = 'monthly' | 'weekly' | 'yearly';

export interface StoreOffer {
  basePlan: BasePlan;
  /** Localized price from Play, e.g. "₹499.00". */
  price: string;
  offerToken: string;
  /** The ₹1 intro offer (new customers only — Play leaves it out otherwise). `days` is read from Play, so
   *  the paywall always states the length Google will actually charge for. */
  trial?: { offerToken: string; price: string; days: number };
}

export interface StoreCatalog {
  /** Google Play answered (false = no connection to the Play Store). */
  connected: boolean;
  offers: Partial<Record<BasePlan, StoreOffer>>;
  pack?: { price: string };
}

let catalogIds = { subscription: 'companion_premium', pack: 'messages_100' };
/** Coin packs (one-time). How many coins each gives comes from our server; the price from Google Play. */
let coinPackDefs: Array<{ id: string; coins: number }> = [
  { id: 'coins_100', coins: 100 },
  { id: 'coins_330', coins: 330 },
  { id: 'coins_1000', coins: 1000 },
];
const isCoinProduct = (productId: string) => productId === catalogIds.pack || coinPackDefs.some((p) => p.id === productId);

export interface CoinPack {
  id: string;
  coins: number;
  /** Localized price from Play, e.g. "₹49.00". */
  price: string;
}
let accountId: string | null = null;
let connected = false;
let listening = false;
const waiting = new Set<(r: { ok: boolean; kind?: 'subscription' | 'pack'; message?: string }) => void>();

const settle = (r: { ok: boolean; kind?: 'subscription' | 'pack'; message?: string }) => {
  waiting.forEach((w) => w(r));
  waiting.clear();
};

async function verifyAndFinish(purchase: Purchase): Promise<boolean> {
  const token = (purchase as { purchaseToken?: string | null }).purchaseToken;
  if (!token) return false;
  const isPack = isCoinProduct(purchase.productId);
  try {
    await billingApi.verifyPurchase({
      provider: 'google',
      productId: purchase.productId,
      receiptData: token,
      transactionId: (purchase as { transactionId?: string | null }).transactionId || purchase.id || token,
      planCode: isPack ? undefined : 'PREMIUM',
      idempotencyKey: `play_${token.slice(-40)}`,
    });
    // The server acknowledged (subscription) or consumed (pack) it with Google; finishing here just clears the queue.
    if (!isPack) await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

function listen() {
  if (listening) return;
  listening = true;
  purchaseUpdatedListener(async (purchase) => {
    const ok = await verifyAndFinish(purchase);
    settle({
      ok,
      kind: isCoinProduct(purchase.productId) ? 'pack' : 'subscription',
      message: ok ? undefined : 'Payment received by Google, but we could not confirm it yet. Tap Restore in a minute — you will not be charged twice.',
    });
  });
  purchaseErrorListener((error) => {
    const cancelled = /cancel/i.test(String((error as { code?: string }).code ?? error.message ?? ''));
    settle({ ok: false, message: cancelled ? undefined : 'The purchase did not go through. Please try again.' });
  });
}

export const StoreBilling = {
  isAvailable: (Platform.OS === 'android') as boolean,
  unavailableMessage: 'Subscriptions are available in the Android app from Google Play.',

  async connect(): Promise<boolean> {
    if (!StoreBilling.isAvailable) return false;
    if (connected) return true;
    try {
      const res = await api.get('/billing/play-account');
      accountId = res.data.data.obfuscatedAccountId;
      catalogIds = { subscription: res.data.data.catalog.subscriptionProductId, pack: res.data.data.catalog.packProductId };
      if (Array.isArray(res.data.data.catalog.coinPacks)) coinPackDefs = res.data.data.catalog.coinPacks;
      connected = Boolean(await initConnection());
      if (connected) listen();
    } catch {
      connected = false;
    }
    return connected;
  },

  /** Real, localized prices from Google Play (never hard-coded in the UI). */
  async loadCatalog(): Promise<StoreCatalog> {
    if (!(await StoreBilling.connect())) return { connected: false, offers: {} };
    const catalog: StoreCatalog = { connected: true, offers: {} };
    const subs = ((await fetchProducts({ skus: [catalogIds.subscription], type: 'subs' })) ?? []) as Array<{
      subscriptionOffers?: Array<{
        id: string;
        basePlanIdAndroid?: string | null;
        displayPrice: string;
        offerTokenAndroid?: string | null;
        price: number;
        pricingPhasesAndroid?: { pricingPhaseList: Array<{ billingPeriod: string; billingCycleCount: number; formattedPrice: string }> } | null;
      }>;
    }>;
    for (const offer of subs[0]?.subscriptionOffers ?? []) {
      const basePlan = offer.basePlanIdAndroid as BasePlan | undefined;
      if (!basePlan || !offer.offerTokenAndroid) continue;
      const entry = (catalog.offers[basePlan] ??= { basePlan, price: offer.displayPrice, offerToken: offer.offerTokenAndroid });
      if (offer.id === 'trial') {
        // The intro phase is the first one (e.g. "₹1.00" for P1D); the regular price follows it.
        const intro = offer.pricingPhasesAndroid?.pricingPhaseList?.[0];
        entry.trial = {
          offerToken: offer.offerTokenAndroid,
          price: intro?.formattedPrice ?? offer.displayPrice,
          days: intro ? isoDays(intro.billingPeriod) * Math.max(1, intro.billingCycleCount || 1) : 1,
        };
      }
      // The plain base plan (no offer id) carries the regular price.
      else if (!offer.id || offer.id === basePlan) Object.assign(entry, { price: offer.displayPrice, offerToken: offer.offerTokenAndroid });
    }
    const packs = ((await fetchProducts({ skus: [catalogIds.pack], type: 'in-app' })) ?? []) as Array<{ displayPrice: string }>;
    if (packs[0]) catalog.pack = { price: packs[0].displayPrice };
    return catalog;
  },

  /** Opens Google Play's purchase sheet; resolves once our server has confirmed it (or it failed/was cancelled). */
  buySubscription(offer: StoreOffer, withTrial: boolean): Promise<{ ok: boolean; message?: string }> {
    return new Promise((resolve) => {
      waiting.add(resolve);
      requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [catalogIds.subscription],
            subscriptionOffers: [{ sku: catalogIds.subscription, offerToken: withTrial && offer.trial ? offer.trial.offerToken : offer.offerToken }],
            obfuscatedAccountId: accountId,
          },
        },
      }).catch(() => settle({ ok: false, message: 'Could not open Google Play. Please try again.' }));
    });
  },

  /** The coin packs with their real Google Play prices (empty if Play isn't reachable or they aren't set up yet). */
  async loadCoinPacks(): Promise<CoinPack[]> {
    // Without Play billing (emulator, no Play account) connecting can hang: give up after 8 s → "not available".
    const load = async (): Promise<CoinPack[]> => {
      if (!(await StoreBilling.connect())) return [];
      const products = ((await fetchProducts({ skus: coinPackDefs.map((p) => p.id), type: 'in-app' })) ?? []) as Array<{ id: string; displayPrice: string }>;
      return coinPackDefs.flatMap((def) => {
        const product = products.find((p) => p.id === def.id);
        return product ? [{ ...def, price: product.displayPrice }] : [];
      });
    };
    return Promise.race([load(), new Promise<CoinPack[]>((resolve) => setTimeout(() => resolve([]), 8000))]);
  },

  /** Buys a coin pack; resolves once our server has confirmed it and added the coins. */
  buyCoins(productId: string): Promise<{ ok: boolean; message?: string }> {
    return new Promise((resolve) => {
      waiting.add(resolve);
      requestPurchase({ type: 'in-app', request: { google: { skus: [productId], obfuscatedAccountId: accountId } } }).catch(() =>
        settle({ ok: false, message: 'Could not open Google Play. Please try again.' }),
      );
    });
  },

  /** The smallest coin pack (also how "add more messages" works: extra messages cost 1 coin each). */
  buyPack(): Promise<{ ok: boolean; message?: string }> {
    return StoreBilling.buyCoins(coinPackDefs[0]?.id ?? catalogIds.pack);
  },

  /** Re-sends every purchase Google still holds to our server (safe to repeat). */
  async restore(): Promise<number> {
    if (!(await StoreBilling.connect())) return 0;
    const purchases = (await getAvailablePurchases()) ?? [];
    let restored = 0;
    for (const p of purchases) if (await verifyAndFinish(p)) restored++;
    return restored;
  },

  /** Cancelling happens in the Play Store (Google's rule) — this opens the right page. */
  openManageSubscription(): void {
    void Linking.openURL(`https://play.google.com/store/account/subscriptions?sku=${catalogIds.subscription}&package=com.aicompanionmobile`);
  },
};

export class StoreBillingUnavailableError extends Error {
  constructor() {
    super(StoreBilling.unavailableMessage);
    this.name = 'StoreBillingUnavailableError';
  }
}

