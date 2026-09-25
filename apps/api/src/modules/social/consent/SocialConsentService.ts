import { SOCIAL_CONSTANTS } from '@ai-companion/config';
import type { SocialConsentItem } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AuditService } from '../../audit/audit.service.js';
import { SocialEvents } from '../shared/SocialEvents.js';

export type SocialConsentType = (typeof SOCIAL_CONSTANTS.CONSENT_TYPES)[number];

/**
 * Consents that default to granted when never recorded. Everything else requires an explicit opt-in.
 * Social notifications are on by default (they are still governed by notification preferences and caps);
 * direct messaging, character social contact and AI public content are strictly opt-in.
 */
const DEFAULT_GRANTED: ReadonlySet<SocialConsentType> = new Set(['SOCIAL_NOTIFICATIONS', 'EXTERNAL_SHARING', 'COMMUNITY_PARTICIPATION']);

/**
 * Append-only, versioned, timestamped, revocable consent ledger (latest row per type wins).
 * Revocation is immediate: every permission check reads the ledger, and pending scheduled
 * actions re-check consent at execution time.
 */
export class SocialConsentService {
  public static async isGranted(userId: string, consentType: SocialConsentType): Promise<boolean> {
    const latest = await prisma.socialConsent.findFirst({
      where: { userId, consentType },
      orderBy: { createdAt: 'desc' },
      select: { granted: true },
    });
    return latest ? latest.granted : DEFAULT_GRANTED.has(consentType);
  }

  public static async list(userId: string): Promise<SocialConsentItem[]> {
    const rows = await prisma.socialConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { consentType: true, granted: true, policyVersion: true, createdAt: true },
    });
    return SOCIAL_CONSTANTS.CONSENT_TYPES.map((type) => {
      const latest = rows.find((r) => r.consentType === type);
      return {
        consentType: type,
        granted: latest ? latest.granted : DEFAULT_GRANTED.has(type),
        policyVersion: latest?.policyVersion ?? SOCIAL_CONSTANTS.CONSENT_POLICY_VERSION,
        updatedAt: latest?.createdAt.toISOString() ?? null,
      };
    });
  }

  public static async record(userId: string, consentType: SocialConsentType, granted: boolean, source = 'SETTINGS'): Promise<SocialConsentItem> {
    // The consent change and its event commit atomically: revocation can never be lost.
    const { row, eventId } = await prisma.$transaction(async (tx) => {
      const created = await tx.socialConsent.create({
        data: { userId, consentType, granted, policyVersion: SOCIAL_CONSTANTS.CONSENT_POLICY_VERSION, source },
      });
      return { row: created, eventId: await SocialEvents.record(tx, 'ConsentChanged', { actorUserId: userId, internal: { consentType, granted } }) };
    });
    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: granted ? 'SOCIAL_CONSENT_GRANTED' : 'SOCIAL_CONSENT_REVOKED',
      resourceType: 'social_consent',
      resourceId: row.id,
      metadata: { consentType, policyVersion: row.policyVersion, source },
    });
    SocialEvents.kickAfterCommit([eventId]);
    return { consentType, granted, policyVersion: row.policyVersion, updatedAt: row.createdAt.toISOString() };
  }
}
