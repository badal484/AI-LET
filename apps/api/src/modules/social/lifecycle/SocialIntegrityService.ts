import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { SocialGraphService } from '../graph/SocialGraphService.js';
import { SocialMessagingService } from '../messaging/SocialMessagingService.js';
import { SocialEvents } from '../shared/SocialEvents.js';

export interface SocialIntegrityReport {
  checkedAt: string;
  findings: Record<string, number>;
  repaired: Record<string, number>;
  /** Anomalies left for humans: never auto-deleted because the correct action is ambiguous. */
  needsReview: Record<string, number>;
}

const n = (rows: Array<{ n: bigint | number }>) => Number(rows[0]?.n ?? 0);

/**
 * Periodic social graph / content integrity checks. Only unambiguous, idempotent repairs are
 * applied automatically (counter recomputation, expiring stale requests, finishing cleanup for
 * accounts whose deletion already COMPLETED). Everything else is reported and audited.
 */
export class SocialIntegrityService {
  public static async run(opts: { repair: boolean } = { repair: true }): Promise<SocialIntegrityReport> {
    const findings: Record<string, number> = {};
    const repaired: Record<string, number> = {};
    const needsReview: Record<string, number> = {};

    findings['followerCounterDrift'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM social_profiles sp
      WHERE sp.followers_count <> (SELECT COUNT(*) FROM user_follows f WHERE f.followed_user_id = sp.user_id AND f.status = 'ACTIVE')
         OR sp.following_count <> (SELECT COUNT(*) FROM user_follows f WHERE f.follower_user_id = sp.user_id AND f.status = 'ACTIVE')`);
    findings['communityMemberCountDrift'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM communities c
      WHERE c.member_count <> (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status IN ('ACTIVE','MUTED'))`);
    findings['contentCounterDrift'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM social_contents sc
      WHERE sc.reaction_count <> (SELECT COUNT(*) FROM social_reactions r WHERE r.content_id = sc.id)
         OR sc.comment_count <> (SELECT COUNT(*) FROM social_comments cm WHERE cm.content_id = sc.id AND cm.status = 'PUBLISHED')`);
    findings['expiredPendingMessageRequests'] = await prisma.socialMessageRequest.count({ where: { status: 'PENDING', expiresAt: { lt: new Date() } } });
    findings['edgesOfCompletedDeletions'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM user_follows f
      WHERE EXISTS (SELECT 1 FROM account_deletion_requests d WHERE d.status = 'COMPLETED' AND d.user_id IN (f.follower_user_id, f.followed_user_id))`);
    findings['followsWithBlocks'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM user_follows f JOIN user_blocks b
        ON (b.user_id = f.follower_user_id AND b.blocked_user_id = f.followed_user_id)
        OR (b.user_id = f.followed_user_id AND b.blocked_user_id = f.follower_user_id)`);
    needsReview['publishedButRejected'] = await prisma.socialContent.count({ where: { status: 'PUBLISHED', moderationStatus: 'REJECTED' } });
    needsReview['liveContentOfDeletedAuthors'] = await prisma.socialContent.count({ where: { deletedAt: null, author: { deletedAt: { not: null } } } });
    needsReview['openCasesForDeletedContent'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM social_moderation_cases c JOIN social_contents sc ON c.target_type = 'CONTENT' AND c.target_id = sc.id::text
      WHERE c.open_key IS NOT NULL AND sc.deleted_at IS NOT NULL`);
    needsReview['orphanedCaseTargets'] = n(await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS n FROM social_moderation_cases c
      WHERE c.open_key IS NOT NULL AND c.target_type = 'CONTENT'
        AND NOT EXISTS (SELECT 1 FROM social_contents sc WHERE sc.id::text = c.target_id)`);
    const outbox = await SocialEvents.stats();
    needsReview['deadLetteredEvents'] = outbox.dead;
    findings['outboxPending'] = outbox.pending;

    if (opts.repair) {
      if (findings['followerCounterDrift']) repaired['followerCounters'] = await SocialGraphService.reconcileCounters();
      if (findings['communityMemberCountDrift']) {
        repaired['communityMemberCounts'] = await prisma.$executeRaw`
          UPDATE communities c SET member_count = (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status IN ('ACTIVE','MUTED'))
          WHERE c.member_count <> (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status IN ('ACTIVE','MUTED'))`;
      }
      if (findings['contentCounterDrift']) {
        repaired['contentCounters'] = await prisma.$executeRaw`
          UPDATE social_contents sc SET
            reaction_count = (SELECT COUNT(*) FROM social_reactions r WHERE r.content_id = sc.id),
            comment_count = (SELECT COUNT(*) FROM social_comments cm WHERE cm.content_id = sc.id AND cm.status = 'PUBLISHED')
          WHERE sc.reaction_count <> (SELECT COUNT(*) FROM social_reactions r WHERE r.content_id = sc.id)
             OR sc.comment_count <> (SELECT COUNT(*) FROM social_comments cm WHERE cm.content_id = sc.id AND cm.status = 'PUBLISHED')`;
      }
      if (findings['expiredPendingMessageRequests']) repaired['expiredMessageRequests'] = await SocialMessagingService.expireStaleRequests();
      // A block must never coexist with a follow: remove the follow (the block is authoritative).
      if (findings['followsWithBlocks']) {
        repaired['followsWithBlocks'] = await prisma.$executeRaw`
          DELETE FROM user_follows f USING user_blocks b
          WHERE (b.user_id = f.follower_user_id AND b.blocked_user_id = f.followed_user_id)
             OR (b.user_id = f.followed_user_id AND b.blocked_user_id = f.follower_user_id)`;
        await SocialGraphService.reconcileCounters();
      }
      if (findings['edgesOfCompletedDeletions']) {
        repaired['edgesOfCompletedDeletions'] = await prisma.$executeRaw`
          DELETE FROM user_follows f
          WHERE EXISTS (SELECT 1 FROM account_deletion_requests d WHERE d.status = 'COMPLETED' AND d.user_id IN (f.follower_user_id, f.followed_user_id))`;
        await SocialGraphService.reconcileCounters();
      }
    }

    const report: SocialIntegrityReport = { checkedAt: new Date().toISOString(), findings, repaired, needsReview };
    const anomalies = Object.values(findings).some((v) => v > 0) || Object.values(needsReview).some((v) => v > 0);
    if (anomalies) {
      logger.warn('[SocialIntegrity] anomalies detected', report);
      await AuditService.log({ actorType: 'SYSTEM', action: 'SOCIAL_INTEGRITY_CHECK', resourceType: 'social_integrity', metadata: report as unknown as Record<string, unknown> });
    }
    return report;
  }
}
