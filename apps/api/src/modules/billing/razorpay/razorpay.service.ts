import type { Prisma } from '@prisma/client';
import { ErrorCode } from '@ai-companion/config';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { AppError, BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logger } from '../../../config/logger.js';
import { publicOrigin } from '../../../infrastructure/email/email.js';
import { Realtime } from '../../../infrastructure/realtime/realtime.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { CreditWalletService } from '../credits/CreditWalletService.js';
import { hasPremium } from '../messageAllowance.js';
import { getSetting } from '../../console/appSettings.js';
import { isRomanceCharacter, isTeen } from '../../users/ageGate.js';
import { COIN_PACKS } from '../providers/GooglePlayBillingProvider.js';
import { googlePlayConfigured, refundExternalTransaction, reportExternalTransaction } from '../providers/googlePlayApi.js';
import {
  notesOf,
  orderSignatureValid,
  razorpayConfigured,
  razorpayKeyId,
  rzp,
  subscriptionSignatureValid,
  webhookSignatureValid,
  type RzpOrder,
  type RzpPayment,
  type RzpSubscription,
  RazorpayApiError,
} from './razorpayClient.js';

/**
 * Razorpay (UPI Autopay / cards) for users in India, offered next to Google Play through Play's user choice
 * billing. The owner's offer (15 Oct 2026): Premium is ₹1 for the first day, then ₹499 a month,
 * auto-debited from the next day. One UPI PIN at the start sets up the mandate and pays the ₹1.
 *
 * Trust: nothing is granted on the phone's word. A payment counts only when its checkout signature is valid,
 * Razorpay's own record says it was paid, it belongs to this account, and the amount is the server's price.
 * Webhooks (signed) keep the subscription in step afterwards — renewals, failed debits, cancellations.
 * Every sale is reported to Google within 24 hours (user choice billing rules); failed reports are retried.
 */

/** Where Razorpay's checkout loads the Loveek logo from (our own server). */
const logoUrl = () => `${publicOrigin()}/legal/logo.png`;

export const RAZORPAY_PREMIUM = { monthlyMinorUnits: 49_900, firstDayMinorUnits: 100, planCode: 'PREMIUM' };
const ONE_TIME_PACKS = ['coins_100', 'coins_330', 'coins_1000'] as const;
/** Premium stays on this long past a due date while that day's auto-debit goes through. */
const CHARGE_GRACE_MS = 6 * 3_600_000;
const RETRY_GRACE_MS = 3 * 86_400_000;

const sec = (unix: number | null | undefined) => (unix ? new Date(unix * 1000) : null);

/**
 * The face on the Premium screen: the character chosen in admin Settings, with their photo as it is now.
 * Not a romance character for someone under 18 (falls back to no face → the Loveek logo).
 */
type Face = { name: string; avatarUrl: string };

async function faceFor(slug: string, teen: boolean): Promise<Face | null> {
  if (!slug) return null;
  const c = await prisma.character.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    select: { slug: true, name: true, avatarUrl: true, category: true },
  });
  if (!c?.avatarUrl || (teen && isRomanceCharacter(c))) return null;
  return { name: c.name.split(' ')[0]!, avatarUrl: c.avatarUrl };
}

export async function paywallFace(userId?: string): Promise<Face | null> {
  return faceFor(String(await getSetting('paywall.character')).trim(), Boolean(userId && (await isTeen(userId))));
}

/** The two faces behind the main one (admin Settings), same rules. */
export async function paywallSideFaces(userId?: string): Promise<Face[]> {
  const teen = Boolean(userId && (await isTeen(userId)));
  const slugs = String(await getSetting('paywall.sideCharacters')).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  return (await Promise.all(slugs.map((s) => faceFor(s, teen)))).filter((f): f is Face => f !== null);
}

/** A user is only eligible for the ₹1 trial once in their life. */
export async function hasUsedTrial(userId: string): Promise<boolean> {
  const [sub, purchase] = await Promise.all([
    prisma.billingSubscription.findFirst({
      where: {
        userId,
        plan: { code: { not: 'FREE' } },
        OR: [
          { trialStart: { not: null } },
          { status: { in: ['ACTIVE', 'TRIALING', 'CANCELLED', 'EXPIRED', 'PAST_DUE'] } },
        ],
      },
      select: { id: true },
    }),
    prisma.purchaseTransaction.findFirst({
      where: {
        userId,
        status: 'SUCCEEDED',
        productId: { in: ['companion_premium', 'premium_monthly'] },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(sub || purchase);
}

/** What the app needs to show Razorpay at all, plus the Premium screen's face. */
export async function razorpayClientConfig(userId?: string) {
  const eligibleForTrial = userId ? !(await hasUsedTrial(userId)) : true;
  return {
    face: await paywallFace(userId),
    sideFaces: await paywallSideFaces(userId),
    enabled: razorpayConfigured(),
    keyId: razorpayConfigured() ? razorpayKeyId() : null,
    /** Google's choice screen (Play vs. Razorpay) is on once the app is enrolled in user choice billing. */
    userChoiceBilling: process.env['PLAY_USER_CHOICE_BILLING'] === 'true',
    eligibleForTrial,
    premium: { firstDayMinorUnits: RAZORPAY_PREMIUM.firstDayMinorUnits, monthlyMinorUnits: RAZORPAY_PREMIUM.monthlyMinorUnits },
    coinPacks: ONE_TIME_PACKS.map((id) => ({ id, coins: COIN_PACKS[id]!.coins, amountMinorUnits: COIN_PACKS[id]!.amountMinorUnits })),
  };
}

function requireConfigured() {
  if (!razorpayConfigured()) throw new AppError('UPI payments are not available right now.', 503, ErrorCode.SERVICE_UNAVAILABLE);
}

/**
 * Razorpay refused a call (keys not activated yet, wrong keys, subscriptions not enabled…): the exact reason goes to
 * the server log for the owner; the person sees a plain message instead of a vague "internal error".
 */
async function razorpayCall<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RazorpayApiError) {
      logger.error(`Razorpay refused ${what}: ${err.message}`);
      throw new AppError('Payments aren’t available right now. Please try again in a little while.', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    throw err;
  }
}

/** GST inside the price (0 until the business is GST-registered: GST_RATE_PERCENT, e.g. 18). */
function taxOf(amountMinor: number): number {
  const rate = Number(process.env['GST_RATE_PERCENT'] ?? 0);
  return rate > 0 ? amountMinor - Math.round(amountMinor / (1 + rate / 100)) : 0;
}

/** Razorpay's monthly ₹499 plan: RAZORPAY_PLAN_ID, or created once and remembered. */
async function premiumPlanId(): Promise<string> {
  if (process.env['RAZORPAY_PLAN_ID']) return process.env['RAZORPAY_PLAN_ID'];
  const key = `razorpay:plan:${razorpayKeyId()}:${RAZORPAY_PREMIUM.monthlyMinorUnits}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const plan = await rzp<{ id: string }>('POST', '/plans', {
    period: 'monthly',
    interval: 1,
    item: { name: 'Loveek Premium', amount: RAZORPAY_PREMIUM.monthlyMinorUnits, currency: 'INR', description: 'Monthly' },
    notes: { app: 'loveek' },
  });
  await redis.set(key, plan.id);
  return plan.id;
}

// ── Starting a purchase ──────────────────────────────────────────────────────

/** Premium: a Razorpay subscription — ₹1 now (sets up Autopay), ₹499 monthly from tomorrow. */
export async function startPremium(userId: string, opts: { googleToken?: string } = {}) {
  requireConfigured();
  if (await hasPremium(userId)) {
    const existing = await prisma.billingSubscription.findFirst({
      where: {
        userId,
        currentPeriodEnd: { gt: new Date() },
        status: { in: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD'] },
        plan: { code: { not: 'FREE' } },
      },
    });
    if (existing && existing.provider === 'RAZORPAY') {
      throw new BadRequestError('You already have an active Premium subscription.');
    }
  }
  const plan = await prisma.billingPlan.findUnique({ where: { code: RAZORPAY_PREMIUM.planCode } });
  if (!plan) throw new NotFoundError('Premium is not set up yet.');

  const eligibleForTrial = !(await hasUsedTrial(userId));
  const startAt = eligibleForTrial ? Math.floor(Date.now() / 1000) + 86_400 : Math.floor(Date.now() / 1000);
  const addons = eligibleForTrial
    ? [{ item: { name: 'Loveek Premium · first day', amount: RAZORPAY_PREMIUM.firstDayMinorUnits, currency: 'INR' } }]
    : [];

  const planId = await razorpayCall('creating the plan', () => premiumPlanId());
  const sub = await razorpayCall('starting Premium', () => rzp<RzpSubscription>('POST', '/subscriptions', {
    plan_id: planId,
    total_count: 120,
    quantity: 1,
    customer_notify: 1,
    start_at: startAt,
    ...(addons.length > 0 && { addons }),
    notes: { userId, app: 'loveek' },
  }));
  await prisma.billingSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'INCOMPLETE',
      provider: 'RAZORPAY',
      providerSubscriptionId: sub.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      metadata: { razorpay: true, isTrial: eligibleForTrial, ...(opts.googleToken && { googleToken: opts.googleToken }) },
    },
  });
  return {
    subscriptionId: sub.id,
    keyId: razorpayKeyId(),
    firstDayMinorUnits: eligibleForTrial ? RAZORPAY_PREMIUM.firstDayMinorUnits : RAZORPAY_PREMIUM.monthlyMinorUnits,
    monthlyMinorUnits: RAZORPAY_PREMIUM.monthlyMinorUnits,
    chargesFrom: new Date(startAt * 1000).toISOString(),
    logoUrl: logoUrl(),
  };
}

/** A coin pack: a one-time Razorpay order at the server's price. */
export async function startCoinPack(userId: string, packId: string, opts: { googleToken?: string } = {}) {
  requireConfigured();
  if (!(ONE_TIME_PACKS as readonly string[]).includes(packId)) throw new BadRequestError('Unknown coin pack.');
  const pack = COIN_PACKS[packId]!;
  const order = await razorpayCall('starting a coin purchase', () => rzp<RzpOrder>('POST', '/orders', {
    amount: pack.amountMinorUnits,
    currency: 'INR',
    receipt: `coins_${Date.now().toString(36)}`,
    notes: { userId, packId, app: 'loveek' },
  }));
  // The Google token is longer than Razorpay's notes allow: kept here for the sale report.
  if (opts.googleToken) await redis.set(`razorpay:order:${order.id}:token`, opts.googleToken, 'EX', 3 * 86_400);
  return { orderId: order.id, keyId: razorpayKeyId(), amountMinorUnits: pack.amountMinorUnits, coins: pack.coins, logoUrl: logoUrl() };
}

// ── Confirming (the app right after checkout; webhooks do the same if the app never comes back) ──────

export interface ConfirmInput {
  kind: 'premium' | 'coins';
  paymentId: string;
  signature: string;
  subscriptionId?: string;
  orderId?: string;
}

export async function confirm(userId: string, input: ConfirmInput) {
  requireConfigured();
  if (input.kind === 'premium') {
    if (!input.subscriptionId || !subscriptionSignatureValid(input.subscriptionId, input.paymentId, input.signature)) {
      throw new BadRequestError("We couldn't confirm this payment.", ErrorCode.PURCHASE_VERIFICATION_FAILED);
    }
    const local = await prisma.billingSubscription.findUnique({ where: { providerSubscriptionId: input.subscriptionId } });
    if (!local || local.provider !== 'RAZORPAY' || local.userId !== userId) {
      throw new BadRequestError('This payment belongs to a different account.', ErrorCode.PURCHASE_VERIFICATION_FAILED);
    }
    const payment = await rzp<RzpPayment>('GET', `/payments/${input.paymentId}`);
    await activateFirstPayment(local.id, payment);
  } else {
    if (!input.orderId || !orderSignatureValid(input.orderId, input.paymentId, input.signature)) {
      throw new BadRequestError("We couldn't confirm this payment.", ErrorCode.PURCHASE_VERIFICATION_FAILED);
    }
    const [payment, order] = await Promise.all([
      rzp<RzpPayment>('GET', `/payments/${input.paymentId}`),
      rzp<RzpOrder>('GET', `/orders/${input.orderId}`),
    ]);
    if (payment.order_id !== order.id || notesOf(order)['userId'] !== userId) {
      throw new BadRequestError('This payment belongs to a different account.', ErrorCode.PURCHASE_VERIFICATION_FAILED);
    }
    await grantCoinPack(userId, order, payment);
  }
  await EntitlementService.invalidateUserEntitlementsCache(userId);
  return { premium: await hasPremium(userId), coins: (await CreditWalletService.getWalletSummary(userId)).availableBalance };
}

/** The ₹1 that set up Autopay: Premium until the first ₹499 is due (plus a little time for that debit). */
async function activateFirstPayment(localSubId: string, payment: RzpPayment) {
  if (!['authorized', 'captured'].includes(payment.status)) {
    throw new BadRequestError('The payment has not gone through yet.', ErrorCode.PURCHASE_VERIFICATION_FAILED);
  }
  if (await prisma.purchaseTransaction.findUnique({ where: { providerTransactionId: payment.id } })) return; // done already
  const local = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: localSubId } });
  const remote = await rzp<RzpSubscription>('GET', `/subscriptions/${local.providerSubscriptionId}`);
  if (notesOf(remote)['userId'] !== local.userId) {
    throw new BadRequestError('This payment belongs to a different account.', ErrorCode.PURCHASE_VERIFICATION_FAILED);
  }
  const isTrial = (local.metadata as { isTrial?: boolean } | null)?.isTrial ?? true;
  const firstCharge = sec(remote.charge_at ?? remote.start_at) ?? (isTrial ? new Date(Date.now() + 86_400_000) : new Date(Date.now() + 30 * 86_400_000));
  const googleToken = (local.metadata as { googleToken?: string } | null)?.googleToken;
  let txId = '';
  try {
    await prisma.$transaction(async (db) => {
      await db.billingSubscription.update({
        where: { id: local.id },
        data: {
          status: isTrial ? 'TRIALING' : 'ACTIVE',
          trialStart: isTrial ? new Date() : null,
          trialEnd: isTrial ? firstCharge : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: isTrial
            ? new Date(firstCharge.getTime() + CHARGE_GRACE_MS)
            : new Date(Math.max(firstCharge.getTime(), Date.now() + 28 * 86_400_000) + CHARGE_GRACE_MS),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
        },
      });
      const tx = await db.purchaseTransaction.create({
        data: {
          userId: local.userId,
          subscriptionId: local.id,
          provider: 'RAZORPAY',
          providerTransactionId: payment.id,
          productId: 'premium_monthly',
          currency: 'INR',
          amountMinorUnits: payment.amount,
          status: 'SUCCEEDED',
          metadata: { kind: 'subscription_first', razorpaySubscriptionId: remote.id, google: googleState(googleToken) },
        },
      });
      txId = tx.id;
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return; // the webhook got there at the same moment
    throw err;
  }
  Realtime.admin({ kind: 'payment', text: 'Premium (UPI)', id: local.userId });
  await reportSale(txId).catch(() => undefined);
}

async function grantCoinPack(userId: string, order: RzpOrder, payment: RzpPayment) {
  const packId = notesOf(order)['packId'] ?? '';
  const pack = COIN_PACKS[packId];
  if (!pack || order.amount !== pack.amountMinorUnits || payment.amount !== pack.amountMinorUnits) {
    throw new BadRequestError("We couldn't confirm this payment.", ErrorCode.PURCHASE_VERIFICATION_FAILED);
  }
  if (payment.status === 'authorized') {
    await rzp('POST', `/payments/${payment.id}/capture`, { amount: payment.amount, currency: 'INR' });
  } else if (payment.status !== 'captured') {
    throw new BadRequestError('The payment has not gone through yet.', ErrorCode.PURCHASE_VERIFICATION_FAILED);
  }
  if (await prisma.purchaseTransaction.findUnique({ where: { providerTransactionId: payment.id } })) return;
  const googleToken = (await redis.get(`razorpay:order:${order.id}:token`)) ?? undefined;
  let tx;
  try {
    tx = await prisma.purchaseTransaction.create({
      data: {
        userId,
        provider: 'RAZORPAY',
        providerTransactionId: payment.id,
        productId: packId,
        currency: 'INR',
        amountMinorUnits: payment.amount,
        status: 'SUCCEEDED',
        metadata: { kind: 'coins', orderId: order.id, coins: pack.coins, google: googleState(googleToken) },
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return;
    throw err;
  }
  await CreditWalletService.grantCredits({
    userId,
    amount: pack.coins,
    type: 'PURCHASE',
    idempotencyKey: `razorpay_${payment.id}`,
    description: `${pack.coins} coins`,
    referenceType: 'PURCHASE',
    referenceId: tx.id,
  });
  Realtime.admin({ kind: 'payment', text: `${pack.coins} coins (UPI)`, id: userId });
  await reportSale(tx.id).catch(() => undefined);
}

// ── Cancelling ───────────────────────────────────────────────────────────────

/** Stops future debits. They keep Premium until the end of what they paid for (the first day, or the month). */
export async function cancelPremium(userId: string) {
  requireConfigured();
  const local = await prisma.billingSubscription.findFirst({
    where: { userId, provider: 'RAZORPAY', status: { in: ['TRIALING', 'ACTIVE', 'GRACE_PERIOD'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!local?.providerSubscriptionId) throw new NotFoundError('No UPI Premium to cancel.');
  const trial = local.status === 'TRIALING';
  // Before the first ₹499 the subscription hasn't started a cycle: cancel now (no debit). Later: at the cycle's end.
  await rzp('POST', `/subscriptions/${local.providerSubscriptionId}/cancel`, { cancel_at_cycle_end: trial ? 0 : 1 });
  const updated = await prisma.billingSubscription.update({
    where: { id: local.id },
    data: {
      status: 'CANCELLED',
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
      ...(trial && local.trialEnd && { currentPeriodEnd: local.trialEnd }),
    },
  });
  await EntitlementService.invalidateUserEntitlementsCache(userId);
  return { premiumUntil: updated.currentPeriodEnd.toISOString() };
}

/** Cancels the remote subscription immediately on Razorpay (used by admin or immediate revocation). */
export async function cancelSubscriptionRemote(providerSubId: string) {
  if (!razorpayConfigured()) return;
  try {
    await rzp('POST', `/subscriptions/${providerSubId}/cancel`, { cancel_at_cycle_end: 0 });
  } catch (err) {
    logger.warn(`Razorpay subscription cancel failed for ${providerSubId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

interface RzpWebhook {
  event: string;
  payload: {
    payment?: { entity: RzpPayment };
    subscription?: { entity: RzpSubscription };
    refund?: { entity: { id: string; payment_id: string; amount: number; created_at: number } };
  };
}

export async function handleWebhook(rawBody: string, signature: string | undefined, eventId: string | undefined) {
  if (!webhookSignatureValid(rawBody, signature)) throw new AppError('Invalid signature', 401, ErrorCode.UNAUTHORIZED);
  const body = JSON.parse(rawBody) as RzpWebhook;
  const id = eventId || `${body.event}:${body.payload.payment?.entity.id ?? body.payload.subscription?.entity.id ?? Date.now()}`;

  const seen = await prisma.billingWebhookEvent.findUnique({ where: { provider_providerEventId: { provider: 'RAZORPAY', providerEventId: id } } });
  if (seen?.status === 'PROCESSED') return { duplicate: true };
  const record =
    seen ??
    (await prisma.billingWebhookEvent.create({
      data: { provider: 'RAZORPAY', providerEventId: id, eventType: body.event, payload: body as unknown as Prisma.InputJsonValue, signature },
    }));
  try {
    await applyEvent(body);
    await prisma.billingWebhookEvent.update({ where: { id: record.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
    return { processed: true };
  } catch (err) {
    await prisma.billingWebhookEvent.update({
      where: { id: record.id },
      data: { status: 'FAILED', retryCount: { increment: 1 }, failureReason: String((err as Error).message).slice(0, 500) },
    });
    throw err; // non-2xx: Razorpay retries
  }
}

async function applyEvent(body: RzpWebhook) {
  const sub = body.payload.subscription?.entity;
  const payment = body.payload.payment?.entity;
  const local = sub ? await prisma.billingSubscription.findUnique({ where: { providerSubscriptionId: sub.id } }) : null;
  if (sub && !local) {
    logger.warn(`Razorpay ${body.event} for an unknown subscription ${sub.id}`);
    return;
  }

  switch (body.event) {
    case 'subscription.authenticated':
    case 'subscription.activated':
      // The app normally confirms the ₹1 itself; this covers an app closed mid-way.
      if (local?.status === 'INCOMPLETE' && payment) await activateFirstPayment(local.id, payment);
      return;
    case 'subscription.charged':
      if (local && payment && sub) await recordRenewal(local.id, sub, payment);
      return;
    case 'subscription.pending': // a debit failed; Razorpay retries for a few days — keep Premium meanwhile
      if (local) {
        const until = new Date(Date.now() + RETRY_GRACE_MS);
        await setStatus(local.id, local.userId, {
          status: 'GRACE_PERIOD',
          gracePeriodEnd: until,
          currentPeriodEnd: local.currentPeriodEnd > until ? local.currentPeriodEnd : until,
        });
      }
      return;
    case 'subscription.halted': // every retry failed
      if (local) await setStatus(local.id, local.userId, { status: 'PAYMENT_FAILED', currentPeriodEnd: new Date() });
      return;
    case 'subscription.cancelled':
      if (local && local.status !== 'CANCELLED') {
        await setStatus(local.id, local.userId, { status: 'CANCELLED', cancelAtPeriodEnd: true, cancelledAt: new Date() });
      }
      return;
    case 'subscription.completed':
    case 'subscription.expired':
      if (local) await setStatus(local.id, local.userId, { status: 'EXPIRED', endedAt: new Date() });
      return;
    case 'payment.captured':
      if (payment?.order_id) {
        const order = await rzp<RzpOrder>('GET', `/orders/${payment.order_id}`);
        const userId = notesOf(order)['userId'];
        if (userId && notesOf(order)['packId']) await grantCoinPack(userId, order, payment);
      }
      return;
    case 'refund.processed': {
      const refund = body.payload.refund?.entity;
      if (refund) await recordRefund(refund.payment_id, sec(refund.created_at) ?? new Date());
      return;
    }
    default:
      return;
  }
}

async function setStatus(localId: string, userId: string, data: Prisma.BillingSubscriptionUpdateInput) {
  await prisma.billingSubscription.update({ where: { id: localId }, data });
  await EntitlementService.invalidateUserEntitlementsCache(userId);
}

/** A monthly ₹499 went through: Premium for the new cycle, and the sale is reported to Google as a renewal. */
async function recordRenewal(localId: string, sub: RzpSubscription, payment: RzpPayment) {
  const local = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: localId } });
  const end = sec(sub.current_end) ?? new Date(Date.now() + 30 * 86_400_000);
  let txId = '';
  try {
    await prisma.$transaction(async (db) => {
      const tx = await db.purchaseTransaction.create({
        data: {
          userId: local.userId,
          subscriptionId: local.id,
          provider: 'RAZORPAY',
          providerTransactionId: payment.id,
          productId: 'premium_monthly',
          currency: 'INR',
          amountMinorUnits: payment.amount,
          status: 'SUCCEEDED',
          metadata: { kind: 'subscription_renewal', razorpaySubscriptionId: sub.id, google: { status: 'pending', attempts: 0 } },
        },
      });
      txId = tx.id;
      await db.billingSubscription.update({
        where: { id: local.id },
        data: {
          status: local.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
          currentPeriodStart: sec(sub.current_start) ?? new Date(),
          currentPeriodEnd: new Date(end.getTime() + CHARGE_GRACE_MS),
          gracePeriodEnd: null,
        },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return; // this debit was recorded already
    throw err;
  }
  await EntitlementService.invalidateUserEntitlementsCache(local.userId);
  Realtime.admin({ kind: 'payment', text: 'Premium renewal (UPI)', id: local.userId });
  await reportSale(txId).catch(() => undefined);
}

async function recordRefund(paymentId: string, at: Date) {
  const tx = await prisma.purchaseTransaction.findUnique({ where: { providerTransactionId: paymentId } });
  if (!tx || tx.status === 'REFUNDED') return;
  await prisma.purchaseTransaction.update({ where: { id: tx.id }, data: { status: 'REFUNDED', refundedAt: at } });
  const google = (tx.metadata as { google?: { status?: string } } | null)?.google;
  if (google?.status === 'reported' && googlePlayConfigured()) {
    await refundExternalTransaction(tx.id, at).catch((err) => logger.warn(`Google refund report failed for ${tx.id}: ${(err as Error).message}`));
  }
}

// ── Reporting sales to Google (user choice billing) ──────────────────────────

type GoogleState = { status: 'pending' | 'reported' | 'failed' | 'not_needed'; attempts?: number; at?: string; error?: string; token?: string };

/** Bought after Google's choice screen → to be reported; bought without it (no token) → nothing to report. */
const googleState = (token: string | undefined): GoogleState => (token ? { status: 'pending', attempts: 0, token } : { status: 'not_needed' });

/** Reports one sale. Safe to call again: a sale that's reported stays reported. */
export async function reportSale(transactionId: string): Promise<GoogleState['status']> {
  const tx = await prisma.purchaseTransaction.findUnique({ where: { id: transactionId } });
  if (!tx || tx.provider !== 'RAZORPAY') return 'not_needed';
  const meta = (tx.metadata ?? {}) as { kind?: string; razorpaySubscriptionId?: string; google?: GoogleState };
  let google = meta.google ?? { status: 'not_needed' };

  // A renewal is reported only if the subscription's first sale was (it came through Google's choice screen).
  let initialId: string | undefined;
  if (meta.kind === 'subscription_renewal') {
    const first = await prisma.purchaseTransaction.findFirst({
      where: { subscriptionId: tx.subscriptionId, provider: 'RAZORPAY', id: { not: tx.id } },
      orderBy: { createdAt: 'asc' },
    });
    const firstGoogle = (first?.metadata as { google?: GoogleState } | null)?.google;
    if (!first || firstGoogle?.status === 'not_needed') google = { status: 'not_needed' };
    else if (firstGoogle?.status !== 'reported') return google.status; // wait for the first one
    else initialId = first.id;
  }
  if (google.status !== 'pending' && google.status !== 'failed') {
    if (meta.google?.status !== google.status) await saveGoogle(tx.id, meta, google);
    return google.status;
  }
  if (!googlePlayConfigured()) return google.status; // stays pending; retried once the service account is set

  try {
    await reportExternalTransaction({
      externalTransactionId: tx.id,
      amountMinorUnits: tx.amountMinorUnits,
      taxMinorUnits: taxOf(tx.amountMinorUnits),
      transactionTime: tx.createdAt,
      kind: meta.kind === 'coins' ? 'one_time' : 'subscription',
      externalTransactionToken: initialId ? undefined : google.token,
      initialExternalTransactionId: initialId,
    });
    google = { status: 'reported', at: new Date().toISOString(), attempts: (google.attempts ?? 0) + 1 };
  } catch (err) {
    google = { ...google, status: 'failed', attempts: (google.attempts ?? 0) + 1, error: (err as Error).message.slice(0, 300) };
    logger.warn(`Google sale report failed for ${tx.id}: ${google.error}`);
  }
  await saveGoogle(tx.id, meta, google);
  return google.status;
}

async function saveGoogle(id: string, meta: Record<string, unknown>, google: GoogleState) {
  await prisma.purchaseTransaction.update({ where: { id }, data: { metadata: { ...meta, google } as Prisma.InputJsonValue } });
}

/** Scheduled: retries sales not yet reported (Google wants them within 24 hours). */
export async function retryGoogleReports(): Promise<number> {
  const recent = await prisma.purchaseTransaction.findMany({
    where: { provider: 'RAZORPAY', createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  let reported = 0;
  for (const tx of recent) {
    const status = (tx.metadata as { google?: GoogleState } | null)?.google?.status;
    if (status === 'pending' || status === 'failed') {
      if ((await reportSale(tx.id)) === 'reported') reported++;
    }
  }
  return reported;
}
