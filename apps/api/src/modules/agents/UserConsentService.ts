import { ErrorCode } from '@ai-companion/config';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { HARD_DISABLED_TOOLS } from './toolSafety.js';
import { UserToolConsentItem } from '@ai-companion/types';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import crypto from 'crypto';

export class UserConsentService {
  private static instance: UserConsentService;

  private readonly consents: Map<string, UserToolConsentItem[]> = new Map();

  private constructor() {}

  public static getInstance(): UserConsentService {
    if (!UserConsentService.instance) {
      UserConsentService.instance = new UserConsentService();
    }
    return UserConsentService.instance;
  }

  /**
   * Retrieves all active consents for a user
   */
  public getUserConsents(userId: string): UserToolConsentItem[] {
    const list = this.consents.get(userId) || [];
    const now = Date.now();
    return list.filter((c) => !c.revokedAt && (!c.expiresAt || new Date(c.expiresAt).getTime() > now));
  }

  /**
   * Checks if user has granted active, unexpired consent for a capability
   */
  public hasConsent(userId: string, capabilitySlug: string, provider?: string): boolean {
    const active = this.getUserConsents(userId);
    return active.some(
      (c) =>
        c.capabilitySlug === capabilitySlug &&
        (!provider || c.provider.toLowerCase() === provider.toLowerCase())
    );
  }

  /**
   * Grants or updates a scoped user tool consent
   */
  public grantConsent(
    userId: string,
    capabilitySlug: string,
    provider: string,
    scope: string,
    durationDays: number = 90
  ): UserToolConsentItem {
    const disabled = HARD_DISABLED_TOOLS.get(capabilitySlug);
    if (disabled) throw new ForbiddenError(disabled.message, ErrorCode.PAYMENT_TOOL_DISABLED);

    const list = this.consents.get(userId) || [];
    const now = Date.now();
    const expiresAt = new Date(now + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const consentItem: UserToolConsentItem = {
      id: `consent_${crypto.randomUUID()}`,
      userId,
      capabilitySlug,
      provider,
      scope,
      grantedAt: new Date(now).toISOString(),
      expiresAt,
      revokedAt: null,
      consentVersion: 'v1.0',
    };

    list.push(consentItem);
    this.consents.set(userId, list);

    prisma.userToolConsentRecord
      .create({
        data: {
          id: consentItem.id,
          userId,
          capabilitySlug,
          provider,
          scope,
          consentVersion: 'v1.0',
          grantedAt: new Date(now),
          expiresAt: new Date(expiresAt),
        },
      })
      .catch((err: any) => {
        logger.warn(`UserConsentService: DB write warning: ${err.message}`);
      });

    logger.info(`Granted tool consent to user '${userId}' for capability '${capabilitySlug}' (Provider: ${provider})`);
    return consentItem;
  }

  /**
   * Revokes an existing consent
   */
  public revokeConsent(userId: string, capabilitySlug: string): boolean {
    const list = this.consents.get(userId) || [];
    let revoked = false;

    for (const c of list) {
      if (c.capabilitySlug === capabilitySlug && !c.revokedAt) {
        c.revokedAt = new Date().toISOString();
        revoked = true;
      }
    }

    if (revoked) {
      this.consents.set(userId, list);
      prisma.userToolConsentRecord
        .updateMany({
          where: { userId, capabilitySlug, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch((err: any) => {
          logger.warn(`UserConsentService: DB revoke warning: ${err.message}`);
        });
      logger.info(`Revoked tool consent for user '${userId}' on capability '${capabilitySlug}'`);
    }

    return revoked;
  }
}
