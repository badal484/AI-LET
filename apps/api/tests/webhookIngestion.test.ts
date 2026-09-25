import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookIngestionService } from '../src/modules/billing/webhooks/WebhookIngestionService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

describe('WebhookIngestionService & Deduplication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates duplicate webhook events with status ALREADY_PROCESSED', async () => {
    const duplicateEvent = {
      id: 'wh_evt_existing_123',
      provider: 'MOCK',
      providerEventId: 'evt_stripe_charge_succeeded_999',
      eventType: 'payment_intent.succeeded',
      status: 'PROCESSED',
      rawPayload: {},
      receivedAt: new Date(),
    };

    vi.spyOn(prisma.billingWebhookEvent, 'findUnique').mockResolvedValue(duplicateEvent as any);

    const result = await WebhookIngestionService.ingestWebhook({
      provider: 'mock',
      rawBody: JSON.stringify({ id: 'evt_stripe_charge_succeeded_999' }),
      headers: {},
    });

    expect(result.status).toBe('ALREADY_PROCESSED');
    expect(result.eventId).toBe(duplicateEvent.id);
  });

  it('successfully creates new webhook event and dispatches processing', async () => {
    vi.spyOn(prisma.billingWebhookEvent, 'findUnique').mockResolvedValue(null);

    const createdEvent = {
      id: 'wh_evt_new_456',
      provider: 'MOCK',
      providerEventId: 'evt_new_sub_created_101',
      eventType: 'customer.subscription.created',
      status: 'RECEIVED',
      payload: { id: 'evt_new_sub_created_101', type: 'customer.subscription.created' },
      receivedAt: new Date(),
      retryCount: 0,
    };

    vi.spyOn(prisma.billingWebhookEvent, 'create').mockResolvedValue(createdEvent as any);
    vi.spyOn(prisma.billingWebhookEvent, 'update').mockResolvedValue({
      ...createdEvent,
      status: 'PROCESSED',
    } as any);

    const result = await WebhookIngestionService.ingestWebhook({
      provider: 'mock',
      rawBody: JSON.stringify({ id: 'evt_new_sub_created_101', type: 'customer.subscription.created' }),
      headers: {},
    });

    expect(result.eventId).toBe(createdEvent.id);
    expect(result.status).toBe('PROCESSED');
  });

  it('marks webhook as failed if processing encounters an error', async () => {
    vi.spyOn(prisma.billingWebhookEvent, 'findUnique').mockResolvedValue(null);

    const createdEvent = {
      id: 'wh_evt_fail_789',
      provider: 'MOCK',
      providerEventId: 'evt_broken_payload_000',
      eventType: 'invoice.payment_failed',
      status: 'RECEIVED',
      payload: { id: 'evt_broken_payload_000' },
      receivedAt: new Date(),
      retryCount: 0,
    };

    vi.spyOn(prisma.billingWebhookEvent, 'create').mockResolvedValue(createdEvent as any);

    let updatedFailedStatus: string | null = null;
    vi.spyOn(prisma.billingWebhookEvent, 'update').mockImplementation(async (args: any) => {
      if (args.data.status === 'FAILED') {
        updatedFailedStatus = 'FAILED';
      }
      return { ...createdEvent, ...args.data };
    });

    vi.spyOn(WebhookIngestionService as any, 'processEvent').mockRejectedValue(
      new Error('Database transaction lock error'),
    );

    await expect(
      WebhookIngestionService.ingestWebhook({
        provider: 'mock',
        rawBody: JSON.stringify({ id: 'evt_broken_payload_000', type: 'invoice.payment_failed' }),
        headers: {},
      }),
    ).rejects.toThrow(/Database transaction lock error/i);

    expect(updatedFailedStatus).toBe('FAILED');
  });
});
