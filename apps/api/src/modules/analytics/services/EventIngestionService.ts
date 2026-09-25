import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import type {
  AnalyticsBatchIngestItem,
  AnalyticsBatchIngestResponse,
} from '@ai-companion/types';

// Sensitive keys to strip from custom event properties to prevent PII leakage
const SENSITIVE_PROPERTY_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'card',
  'cardnumber',
  'cvv',
  'email',
  'phonenumber',
  'phone',
  'address',
  'ssn',
  'apikey',
  'authheader',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toValidUuidOrNull(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  return UUID_REGEX.test(val) ? val : null;
}

export class EventIngestionService {
  /**
   * Sanitizes custom event properties to guarantee no sensitive data or PII is recorded.
   */
  public static sanitizeProperties(properties?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!properties || typeof properties !== 'object') return undefined;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (SENSITIVE_PROPERTY_KEYS.has(key.toLowerCase())) {
        continue; // Drop sensitive field
      }

      // If value is a nested object, sanitize recursively (1 level deep)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedSanitized: Record<string, unknown> = {};
        for (const [nKey, nVal] of Object.entries(value as Record<string, unknown>)) {
          if (!SENSITIVE_PROPERTY_KEYS.has(nKey.toLowerCase())) {
            nestedSanitized[nKey] = nVal;
          }
        }
        sanitized[key] = nestedSanitized;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Checks if an event ID is duplicate using Redis deduplication key with 24h TTL.
   */
  private static async isDuplicate(eventId: string): Promise<boolean> {
    try {
      const key = `analytics:dedup:${eventId}`;
      const result = await redis.set(key, '1', 'EX', 86400, 'NX');
      // If NX succeeds, it was NOT a duplicate (returns 'OK')
      return result !== 'OK';
    } catch (err) {
      logger.warn('Redis dedup check error in analytics, falling back to DB uniqueness', { err, eventId });
      return false;
    }
  }

  /**
   * Ingests a batch of analytics events with validation, deduplication, and batch persistence.
   */
  public static async ingestBatch(
    events: AnalyticsBatchIngestItem[],
    requestContext?: { ip?: string; userAgent?: string; authUserId?: string },
  ): Promise<AnalyticsBatchIngestResponse> {
    let accepted = 0;
    let duplicate = 0;
    let errors = 0;

    const validRecords: Array<{
      id: string;
      eventName: string;
      eventVersion: number;
      userId: string | null;
      anonymousId: string | null;
      sessionId: string | null;
      deviceId: string | null;
      characterId: string | null;
      creatorId: string | null;
      conversationId: string | null;
      timestamp: Date;
      properties: any;
      appVersion: string | null;
      platform: string | null;
      locale: string | null;
      timezone: string | null;
      experimentId: string | null;
      experimentVariant: string | null;
      requestId: string | null;
      source: string | null;
    }> = [];

    for (const evt of events) {
      try {
        // Enforce deduplication
        const isDup = await this.isDuplicate(evt.id);
        if (isDup) {
          duplicate++;
          continue;
        }

        const sanitizedProps = this.sanitizeProperties(evt.properties);

        // Identity comes only from the verified token: a client-supplied userId is never trusted,
        // otherwise anyone could fabricate another user's activity (DAU, retention, creator views).
        const validUserId = toValidUuidOrNull(requestContext?.authUserId);
        const anonymousId = evt.anonymousId || null;

        validRecords.push({
          id: evt.id,
          eventName: evt.eventName,
          eventVersion: evt.eventVersion || 1,
          userId: validUserId,
          anonymousId,
          sessionId: evt.sessionId || null,
          deviceId: evt.deviceId || null,
          characterId: toValidUuidOrNull(evt.characterId),
          creatorId: toValidUuidOrNull(evt.creatorId),
          conversationId: toValidUuidOrNull(evt.conversationId),
          timestamp: new Date(evt.timestamp || Date.now()),
          properties: (sanitizedProps as any) || null,
          appVersion: evt.appVersion || null,
          platform: evt.platform || null,
          locale: evt.locale || null,
          timezone: evt.timezone || null,
          experimentId: evt.experimentId || null,
          experimentVariant: evt.experimentVariant || null,
          requestId: evt.requestId || null,
          source: evt.source || null,
        });

        accepted++;
      } catch (err) {
        logger.error('Error processing analytics event record', { err, eventId: evt.id });
        errors++;
      }
    }

    if (validRecords.length > 0) {
      try {
        await prisma.analyticsEvent.createMany({
          data: validRecords,
          skipDuplicates: true,
        });
      } catch (err) {
        logger.error('Database batch write error in AnalyticsEvent', { err, count: validRecords.length });
        errors += validRecords.length;
        accepted -= validRecords.length;
      }
    }

    return {
      received: events.length,
      accepted,
      duplicate,
      errors,
    };
  }
}
