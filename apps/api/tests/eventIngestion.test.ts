import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { EventIngestionService } from '../src/modules/analytics/services/EventIngestionService.js';
import { randomUUID } from 'crypto';

describe('EventIngestionService Tests', () => {
  beforeEach(async () => {
    await prisma.analyticsEvent.deleteMany();
  });

  it('sanitizes PII and sensitive keys from properties', () => {
    const rawProps = {
      action: 'onboarding_step_completed',
      stepNumber: 3,
      email: 'user@example.com',
      password: 'SuperSecretPassword!',
      apiKey: 'sk-1234567890',
      token: 'jwt.token.here',
      userProfile: {
        preferredName: 'Alice',
        phoneNumber: '+15551234567',
        address: '123 Main St',
        theme: 'dark',
      },
    };

    const sanitized = EventIngestionService.sanitizeProperties(rawProps);
    expect(sanitized).toBeDefined();
    expect(sanitized?.['action']).toBe('onboarding_step_completed');
    expect(sanitized?.['stepNumber']).toBe(3);
    // Sensitive keys stripped
    expect(sanitized?.['email']).toBeUndefined();
    expect(sanitized?.['password']).toBeUndefined();
    expect(sanitized?.['apiKey']).toBeUndefined();
    expect(sanitized?.['token']).toBeUndefined();

    // Nested object sanitized
    const nested = sanitized?.['userProfile'] as Record<string, unknown>;
    expect(nested).toBeDefined();
    expect(nested['preferredName']).toBe('Alice');
    expect(nested['theme']).toBe('dark');
    expect(nested['phoneNumber']).toBeUndefined();
    expect(nested['address']).toBeUndefined();
  });

  it('ingests a batch of valid analytics events into the database', async () => {
    const eventId1 = randomUUID();
    const eventId2 = randomUUID();

    const result = await EventIngestionService.ingestBatch([
      {
        id: eventId1,
        eventName: 'welcome_viewed',
        eventVersion: 1,
        userId: null,
        anonymousId: 'anon-abc-123',
        sessionId: 'session-xyz',
        timestamp: new Date().toISOString(),
        properties: { referralSource: 'organic' },
        platform: 'ios',
        appVersion: '1.2.0',
      },
      {
        id: eventId2,
        eventName: 'first_chat_started',
        eventVersion: 1,
        userId: 'test-user-id',
        timestamp: new Date().toISOString(),
        properties: { characterCategory: 'Science' },
        platform: 'android',
        appVersion: '1.2.0',
      },
    ]);

    expect(result.received).toBe(2);
    expect(result.accepted).toBe(2);
    expect(result.duplicate).toBe(0);
    expect(result.errors).toBe(0);

    const saved = await prisma.analyticsEvent.findMany();
    expect(saved.length).toBe(2);
    expect(saved.map(s => s.eventName)).toContain('welcome_viewed');
    expect(saved.map(s => s.eventName)).toContain('first_chat_started');
  });

  it('enforces deduplication for duplicate event IDs', async () => {
    const duplicateEventId = randomUUID();

    // First ingestion
    const firstResult = await EventIngestionService.ingestBatch([
      {
        id: duplicateEventId,
        eventName: 'activation_completed',
        eventVersion: 1,
        userId: 'user-dedup-1',
        timestamp: new Date().toISOString(),
        properties: { step: 'activation' },
      },
    ]);
    expect(firstResult.accepted).toBe(1);
    expect(firstResult.duplicate).toBe(0);

    // Re-send same event ID
    const secondResult = await EventIngestionService.ingestBatch([
      {
        id: duplicateEventId,
        eventName: 'activation_completed',
        eventVersion: 1,
        userId: 'user-dedup-1',
        timestamp: new Date().toISOString(),
        properties: { step: 'activation' },
      },
    ]);
    expect(secondResult.accepted).toBe(0);
    expect(secondResult.duplicate).toBe(1);

    const eventsInDb = await prisma.analyticsEvent.findMany({
      where: { id: duplicateEventId },
    });
    expect(eventsInDb.length).toBe(1);
  });
});
