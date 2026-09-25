import { prisma } from '../../../infrastructure/database/prisma.js';
import { BillingProviderType } from '@ai-companion/types';
import { BillingProviderFactory } from '../providers/BillingProviderFactory.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { EntitlementService } from '../entitlements/EntitlementService.js';
import { logger } from '../../../config/logger.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';

export class WebhookIngestionService {
  /**
   * Ingest and process an incoming provider webhook idempotently.
   */
  public static async ingestWebhook(params: {
    provider: BillingProviderType;
    rawBody: string | Buffer;
    signature?: string;
    headers?: Record<string, string | string[] | undefined>;
  }) {
    const providerAdapter = BillingProviderFactory.getProvider(params.provider);

    // 1. Verify signature and parse provider payload
    const parsed = await providerAdapter.verifyAndParseWebhook({
      eventId: `evt_${Date.now()}`,
      eventType: 'webhook',
      provider: params.provider,
      rawBody: params.rawBody,
      signature: params.signature,
      headers: params.headers,
    });

    if (!parsed.isValidSignature) {
      logger.warn(`Invalid signature for webhook from ${params.provider}`);
      return { status: 'INVALID_SIGNATURE' };
    }

    // 2. Check for duplicate event
    const existingEvent = await prisma.billingWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: params.provider.toUpperCase() as any,
          providerEventId: parsed.providerEventId,
        },
      },
    });

    if (existingEvent && existingEvent.status === 'PROCESSED') {
      logger.info(`Webhook event ${parsed.providerEventId} from ${params.provider} already processed`);
      return { status: 'ALREADY_PROCESSED', eventId: existingEvent.id };
    }

    // 3. Persist webhook event record
    const webhookRecord = existingEvent || (await prisma.billingWebhookEvent.create({
      data: {
        provider: params.provider.toUpperCase() as any,
        providerEventId: parsed.providerEventId,
        eventType: parsed.eventType,
        status: 'RECEIVED',
        payload: (parsed.metadata || {}) as any,
        signature: params.signature,
      },
    }));

    // 4. Process event state changes
    try {
      await prisma.billingWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'PROCESSING' },
      });

      await this.processEvent(parsed);

      await prisma.billingWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return { status: 'PROCESSED', eventId: webhookRecord.id };
    } catch (err: any) {
      logger.error(`Webhook processing error for event ${webhookRecord.id}:`, err);
      const isDeadLetter = webhookRecord.retryCount >= 4;

      await prisma.billingWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          status: isDeadLetter ? 'FAILED' : 'FAILED',
          retryCount: { increment: 1 },
          failureReason: err?.message || 'Unknown processing error',
        },
      });

      throw err;
    }
  }

  /**
   * Apply domain state changes based on parsed webhook event.
   */
  private static async processEvent(parsed: {
    eventType: string;
    providerSubscriptionId?: string;
    currentPeriodEnd?: Date;
    subscriptionStatus?: string;
    userId?: string;
  }) {
    if (!parsed.providerSubscriptionId) return;

    if (parsed.eventType.includes('RENEW') || parsed.eventType.includes('invoice.payment_succeeded')) {
      if (parsed.currentPeriodEnd) {
        await SubscriptionService.handleSubscriptionRenewal(
          parsed.providerSubscriptionId,
          parsed.currentPeriodEnd
        );
      }
    } else if (parsed.eventType.includes('FAIL') || parsed.eventType.includes('payment_failed')) {
      await SubscriptionService.handlePaymentFailure(parsed.providerSubscriptionId);
    } else if (parsed.eventType.includes('EXPIRE') || parsed.eventType.includes('subscription.deleted')) {
      await SubscriptionService.handleSubscriptionExpiration(parsed.providerSubscriptionId);
    }

    if (parsed.userId) {
      await EntitlementService.invalidateUserEntitlementsCache(parsed.userId);
    }
  }

  /**
   * Admin: Retry processing a failed webhook event.
   */
  public static async retryWebhook(webhookEventId: string) {
    const event = await prisma.billingWebhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      throw new NotFoundError(`Webhook event '${webhookEventId}' not found`);
    }

    return await this.ingestWebhook({
      provider: event.provider.toLowerCase() as BillingProviderType,
      rawBody: JSON.stringify(event.payload),
      signature: event.signature || undefined,
    });
  }
}
