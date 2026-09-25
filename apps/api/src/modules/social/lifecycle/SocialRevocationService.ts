import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { CharacterSocialActionGateway } from '../ai/CharacterSocialActionGateway.js';
import { ScheduledSocialActionService } from '../ai/ScheduledSocialActionService.js';
import { type SocialDomainEvent, SocialEvents } from '../shared/SocialEvents.js';

/**
 * Revocation propagation. When a permission disappears, anything pending that depended on it is
 * cancelled or paused immediately. (Execution paths ALSO re-check at run time, so this is defense in depth.)
 */
export class SocialRevocationService {
  private static registered = false;

  public static async onConsentRevoked(userId: string, consentType: string): Promise<void> {
    if (consentType === 'AI_GENERATED_PUBLIC_CONTENT') {
      const cancelled = await CharacterSocialActionGateway.cancelPendingFor({ creatorUserId: userId }, 'CONSENT_REVOKED');
      const paused = await ScheduledSocialActionService.pauseAll({ ownerUserId: userId }, 'Consent revoked: AI-generated public content');
      logger.info('[SocialRevocation] AI content consent revoked', { userId, cancelled, paused });
    } else if (consentType === 'DIRECT_MESSAGING') {
      await prisma.socialMessageRequest.updateMany({
        where: { status: 'PENDING', OR: [{ senderUserId: userId }, { recipientUserId: userId }] },
        data: { status: 'EXPIRED', pendingKey: null },
      });
    }
  }

  public static async onUserRestricted(userId: string, reason: string): Promise<void> {
    await CharacterSocialActionGateway.cancelPendingFor({ creatorUserId: userId }, reason);
    await ScheduledSocialActionService.pauseAll({ ownerUserId: userId }, reason);
  }

  public static registerHandlers(): void {
    const onEvent = (event: SocialDomainEvent, handler: Parameters<typeof SocialEvents.on>[1]) => SocialEvents.on(event, handler, `revocation:${event}`);
    if (this.registered) return;
    this.registered = true;
    onEvent('ConsentChanged', async (p) => {
      const internal = p.internal as { consentType?: string; granted?: boolean } | undefined;
      if (p.actorUserId && internal?.consentType && internal.granted === false) await this.onConsentRevoked(p.actorUserId, internal.consentType);
    });
    onEvent('ModerationActioned', async (p) => {
      const internal = p.internal as { decision?: string } | undefined;
      if (p.recipientUserId && (internal?.decision === 'RESTRICT_USER_SOCIAL' || internal?.decision === 'SUSPEND_USER')) {
        await this.onUserRestricted(p.recipientUserId, `MODERATION_${internal.decision}`);
      }
    });
  }
}
