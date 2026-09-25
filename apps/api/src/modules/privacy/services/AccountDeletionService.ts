import crypto from 'crypto';
import os from 'os';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { SocialDataLifecycleService } from '../../social/lifecycle/SocialDataLifecycleService.js';
import { SocialEvents } from '../../social/shared/SocialEvents.js';
import { SocialFeedService } from '../../social/feed/SocialFeedService.js';
import { AgentTaskService } from '../../agents/AgentTaskService.js';
import { ScheduledAgentTaskService } from '../../agents/ScheduledAgentTaskService.js';
import { OAuthVaultService } from '../../agents/OAuthVaultService.js';

/**
 * Account deletion pipeline: idempotent, resumable, retryable, leased, observable and audited.
 *
 *   PENDING (24h grace, cancellable) → PROCESSING → [steps] → COMPLETED
 *                                              ↘ FAILED (after MAX_ATTEMPTS; reconciliation alerts)
 *
 * Every step is idempotent and recorded in `completedSteps`, so a crash at any point resumes at the
 * first unfinished step. A lease (`lockedBy` / `lockedUntil`) guarantees one worker per request;
 * an expired lease is reclaimable by any worker. The User row becomes an anonymised tombstone
 * rather than being hard-deleted, because financial and safety records must remain referentially
 * intact (they are detached from the person, not destroyed).
 */
export const DELETION_STEPS = [
  'ACCOUNT_LOCK',
  'CREDENTIAL_REVOCATION',
  'SOCIAL_CLEANUP',
  'AGENT_CLEANUP',
  'PRIVATE_DATA_CLEANUP',
  'MEDIA_CLEANUP',
  'ANALYTICS_ANONYMIZATION',
  'ACCOUNT_TOMBSTONE',
  'VERIFICATION',
] as const;
export type DeletionStep = (typeof DELETION_STEPS)[number];

export const MAX_DELETION_ATTEMPTS = 6;
const LEASE_MS = 5 * 60_000;
const WORKER_ID = `${os.hostname()}:${process.pid}`;

type StepHandler = (userId: string, tx: Prisma.TransactionClient) => Promise<Record<string, unknown>>;

export class AccountDeletionService {
  /** Test hook: throw after a given step to simulate a crash mid-pipeline. */
  public static crashAfterStep: DeletionStep | null = null;

  private static readonly steps: Record<DeletionStep, { transactional: boolean; run: StepHandler }> = {
    /** Blocks all access immediately (auth rejects DELETED / deletedAt on every request and refresh). */
    ACCOUNT_LOCK: {
      transactional: true,
      run: async (userId, tx) => {
        await tx.user.update({ where: { id: userId }, data: { status: 'DELETED', deletedAt: new Date() } });
        return { locked: true };
      },
    },
    CREDENTIAL_REVOCATION: {
      transactional: true,
      run: async (userId, tx) => {
        const now = new Date();
        const sessions = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        const devices = await tx.device.updateMany({ where: { userId }, data: { revokedAt: now, pushToken: null } });
        const pushDevices = await tx.userDevice.updateMany({ where: { userId }, data: { isActive: false, pushToken: null } });
        const identities = await tx.authIdentity.deleteMany({ where: { userId } });
        const emailTokens = await tx.emailVerificationToken.deleteMany({ where: { userId } });
        const resetTokens = await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.user.update({ where: { id: userId }, data: { passwordHash: null } });
        return { sessions: sessions.count, devices: devices.count, pushDevices: pushDevices.count, identities: identities.count, emailTokens: emailTokens.count, resetTokens: resetTokens.count };
      },
    },
    /** Social footprint: see SocialDataLifecycleService.purgeUser for per-entity decisions. */
    SOCIAL_CLEANUP: {
      transactional: false,
      run: async (userId) => {
        const stats = await SocialDataLifecycleService.purgeUser(userId, 'ACCOUNT_DELETION');
        await SocialFeedService.invalidate(userId);
        SocialEvents.emit('AccountDeleted', { actorUserId: userId, source: 'account_deletion' });
        return stats;
      },
    },
    /** Agent runtime state is in-process (Phase 23); cancel what this process holds. */
    AGENT_CLEANUP: {
      transactional: false,
      run: async (userId) => {
        const tasks = AgentTaskService.getInstance();
        let cancelled = 0;
        const userTasks = await tasks.listUserTasks(userId);
        for (const t of userTasks) {
          if (!['completed', 'failed', 'cancelled'].includes(t.status)) {
            try {
              await tasks.cancelTask(t.id, userId);
              cancelled++;
            } catch {
              // already terminal
            }
          }
        }
        const scheduler = ScheduledAgentTaskService.getInstance();
        let schedules = 0;
        for (const s of scheduler.listUserScheduledTasks(userId)) {
          if (s.isEnabled) {
            scheduler.toggleScheduledTask(s.id, userId, false);
            schedules++;
          }
        }
        const vault = OAuthVaultService.getInstance();
        let oauth = 0;
        const connections = await vault.listConnections(userId);
        for (const c of connections) {
          if (await vault.disconnect(userId, c.provider)) oauth++;
        }
        return { cancelledTasks: cancelled, disabledSchedules: schedules, revokedOAuthConnections: oauth };
      },
    },
    /** Private conversations, memories, relationship state and personalization are deleted. */
    PRIVATE_DATA_CLEANUP: {
      transactional: true,
      run: async (userId, tx) => {
        const out: Record<string, number> = {};
        const del = async (name: string, p: Promise<{ count: number } | undefined | null>) => {
          const res = await p;
          out[name] = res?.count ?? 0;
        };
        await del('conversations', tx.conversation.deleteMany({ where: { userId } }));
        await del('memories', tx.memory.deleteMany({ where: { userId } }));
        await del('memorySettings', tx.userMemorySettings.deleteMany({ where: { userId } }));
        await del('relationships', tx.relationship.deleteMany({ where: { userId } }));
        await del('relationshipSettings', tx.userRelationshipSettings.deleteMany({ where: { userId } }));
        await del('messageFeedback', tx.messageFeedback.deleteMany({ where: { userId } }));
        await del('proactiveActions', tx.proactiveAction.deleteMany({ where: { userId } }));
        await del('proactiveDecisionLogs', tx.proactiveDecisionLog.deleteMany({ where: { userId } }));
        await del('reminders', tx.userReminder.deleteMany({ where: { userId } }));
        await del('generationTraces', tx.aIGenerationTrace.deleteMany({ where: { userId } }));
        await del('voiceSessions', tx.voiceSession.deleteMany({ where: { userId } }));
        await del('voicePreferences', tx.userVoicePreference.deleteMany({ where: { userId } }));
        await del('favorites', tx.userFavorite.deleteMany({ where: { userId } }));
        await del('discoveryPreferences', tx.userDiscoveryPreference.deleteMany({ where: { userId } }));
        await del('characterSignals', tx.userCharacterSignal.deleteMany({ where: { userId } }));
        await del('searchQueryLogs', tx.searchQueryLog.deleteMany({ where: { userId } }));
        // Phase 26: Knowledge documents, collections & web research tasks
        await del('knowledgeDocuments', tx.knowledgeDocument.deleteMany({ where: { ownerId: userId } }));
        await del('knowledgeCollections', tx.knowledgeCollection.deleteMany({ where: { ownerId: userId } }));
        await del('webResearchTasks', tx.webResearchTask.deleteMany({ where: { userId } }));
        // Phase 27: Character simulation, goals, threads, commitments & runs
        await del('characterGoals', tx.characterGoal.deleteMany({ where: { userId } }));
        await del('openConversationalThreads', tx.openConversationalThread.deleteMany({ where: { userId } }));
        await del('characterCommitments', tx.characterCommitment.deleteMany({ where: { userId } }));
        await del('characterSimulationStates', tx.characterSimulationState.deleteMany({ where: { userId } }));
        await del('simulationRunRecords', tx.simulationRunRecord.deleteMany({ where: { userId } }));
        // Phase 28: Developer Platform projects, oauth consents & org memberships
        await del('developerProjects', tx.developerProject.deleteMany({ where: { userId } }));
        await del('oAuthConsents', tx.oAuthConsent.deleteMany({ where: { userId } }));
        await del('developerOrgMembers', tx.developerOrgMember.deleteMany({ where: { userId } }));
        await del('searchHistories', tx.userSearchHistory.deleteMany({ where: { userId } }));
        await del('negativeSignals', tx.userNegativeSignal.deleteMany({ where: { userId } }));
        await del('inAppNotifications', tx.inAppNotification.deleteMany({ where: { userId } }));
        await del('notificationDeliveryLogs', tx.notificationDeliveryLog.deleteMany({ where: { userId } }));
        await del('notificationPreferences', tx.userNotificationPreference.deleteMany({ where: { userId } }));
        await del('privacySettings', tx.userPrivacySettings.deleteMany({ where: { userId } }));

        // Creator: characters stop being available; creator identity is closed and anonymised.
        const creator = await tx.creatorProfile.findUnique({ where: { userId }, select: { id: true } });
        if (creator) {
          const chars = await tx.character.updateMany({ where: { creatorProfileId: creator.id, deletedAt: null }, data: { status: 'UNPUBLISHED', visibility: 'PRIVATE' } });
          await tx.creatorProfile.update({
            where: { id: creator.id },
            data: { status: 'CLOSED', displayName: 'Deleted creator', bio: '', avatarUrl: null, bannerUrl: null, website: null, socialLinks: Prisma.JsonNull },
          });
          out['creatorCharactersUnpublished'] = chars.count;
        }
        return out;
      },
    },
    /**
     * Media references are removed from every user-owned record. Object-level deletion requires a real
     * storage adapter (ObjectStorageService is simulated), so only references are cleared here.
     */
    MEDIA_CLEANUP: {
      transactional: true,
      run: async (userId, tx) => {
        const profile = await tx.userProfile.updateMany({ where: { userId }, data: { avatarUrl: null } });
        const social = await tx.socialProfile.updateMany({ where: { userId }, data: { avatarUrl: null } });
        return { profileAvatarCleared: profile.count, socialAvatarCleared: social.count, objectDeletion: 'NOT_AVAILABLE_STORAGE_ADAPTER_SIMULATED' };
      },
    },
    /** Analytics keep aggregate value but lose the link to the person (salted one-way pseudonym). */
    ANALYTICS_ANONYMIZATION: {
      transactional: true,
      run: async (userId, tx) => {
        const pseudonym = `deleted_${crypto.createHash('sha256').update(`account-deletion:${userId}`).digest('hex').slice(0, 24)}`;
        const events = await tx.analyticsEvent.updateMany({ where: { userId }, data: { userId: null, anonymousId: pseudonym } });
        const usage = await tx.aIUsageEvent.updateMany({ where: { userId }, data: { userId: null } });
        const discovery = await tx.discoveryEventLog.deleteMany({ where: { userId } });
        const funnel = await tx.activationFunnelLog.deleteMany({ where: { userId } });
        const first = await tx.userFirstSession.deleteMany({ where: { userId } });
        return { analyticsEventsAnonymized: events.count, aiUsageDetached: usage.count, discoveryLogsDeleted: discovery.count, funnelLogsDeleted: funnel.count, firstSessionDeleted: first.count };
      },
    },
    /** Personal identifiers removed; the row remains so retained financial / safety records stay valid. */
    ACCOUNT_TOMBSTONE: {
      transactional: true,
      run: async (userId, tx) => {
        const tomb = `deleted+${userId}@deleted.invalid`;
        await tx.user.update({
          where: { id: userId },
          data: { email: tomb, normalizedEmail: tomb, phoneNumber: null, normalizedPhoneNumber: null, passwordHash: null, emailVerifiedAt: null, phoneVerifiedAt: null, status: 'DELETED' },
        });
        await tx.userProfile.updateMany({ where: { userId }, data: { displayName: 'Deleted user', username: null, bio: null, avatarUrl: null, dateOfBirth: null } });
        return { tombstoned: true };
      },
    },
    /** Fails (and therefore retries) unless every invariant of a deleted account holds. */
    VERIFICATION: {
      transactional: false,
      run: async (userId) => {
        const [user, activeSessions, pushDevices, identities, username, follows, memories, conversations, activeMemberships] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { status: true, deletedAt: true, email: true, passwordHash: true } }),
          prisma.session.count({ where: { userId, revokedAt: null } }),
          prisma.userDevice.count({ where: { userId, OR: [{ isActive: true }, { pushToken: { not: null } }] } }),
          prisma.authIdentity.count({ where: { userId } }),
          prisma.socialProfile.count({ where: { userId, username: { not: null } } }),
          prisma.userFollow.count({ where: { OR: [{ followerUserId: userId }, { followedUserId: userId }] } }),
          prisma.memory.count({ where: { userId } }),
          prisma.conversation.count({ where: { userId } }),
          prisma.communityMember.count({ where: { userId, status: { in: ['ACTIVE', 'MUTED', 'PENDING', 'INVITED'] } } }),
        ]);
        const problems: string[] = [];
        if (!user || user.status !== 'DELETED' || !user.deletedAt) problems.push('user not locked');
        if (user && (!user.email.endsWith('@deleted.invalid') || user.passwordHash)) problems.push('user not tombstoned');
        if (activeSessions) problems.push(`${activeSessions} active sessions`);
        if (pushDevices) problems.push(`${pushDevices} push devices`);
        if (identities) problems.push(`${identities} auth identities`);
        if (username) problems.push('social username not released');
        if (follows) problems.push(`${follows} follow edges`);
        if (memories) problems.push(`${memories} memories`);
        if (conversations) problems.push(`${conversations} conversations`);
        if (activeMemberships) problems.push(`${activeMemberships} community memberships`);
        if (problems.length) throw new Error(`Verification failed: ${problems.join(', ')}`);
        return { verified: true };
      },
    },
  };

  // ---------------------------------------------------------------------------
  // Request lifecycle
  // ---------------------------------------------------------------------------

  /** Cancels a request during the grace period. Once processing has started it cannot be cancelled. */
  public static async cancel(userId: string): Promise<{ cancelled: boolean }> {
    const res = await prisma.accountDeletionRequest.updateMany({ where: { userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (res.count) await AuditService.log({ actorType: 'USER', actorId: userId, action: 'ACCOUNT_DELETION_CANCELLED', resourceType: 'account_deletion_request', resourceId: userId });
    return { cancelled: res.count > 0 };
  }

  /**
   * Purges private user data across all platform modules (memories, relationships, simulation, goals, etc.).
   */
  public static async purgeUserData(userId: string, tx: Prisma.TransactionClient = prisma): Promise<Record<string, unknown>> {
    return this.steps.PRIVATE_DATA_CLEANUP.run(userId, tx);
  }

  /**
   * Claims one due request with a lease. Due = PENDING past its grace window, or PROCESSING/FAILED
   * whose lease/backoff expired and attempts remain. Returns the claimed request id or null.
   */
  public static async claimNext(now = new Date()): Promise<string | null> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE account_deletion_requests SET
        status = 'PROCESSING',
        locked_by = ${WORKER_ID},
        locked_until = ${new Date(now.getTime() + LEASE_MS)},
        attempts = attempts + 1,
        started_at = COALESCE(started_at, ${now}),
        updated_at = ${now}
      WHERE id = (
        SELECT id FROM account_deletion_requests
        WHERE (
          (status = 'PENDING' AND scheduled_for <= ${now})
          OR (status = 'PROCESSING' AND (locked_until IS NULL OR locked_until < ${now}))
          OR (status = 'FAILED' AND attempts < ${MAX_DELETION_ATTEMPTS} AND (locked_until IS NULL OR locked_until < ${now}))
        )
        ORDER BY scheduled_for
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    return rows[0]?.id ?? null;
  }

  /** Runs every unfinished step for a claimed request. Safe to call repeatedly. */
  public static async process(requestId: string): Promise<'COMPLETED' | 'RETRY' | 'FAILED'> {
    const req = await prisma.accountDeletionRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED') return 'COMPLETED';
    const done = new Set(req.completedSteps);

    for (const step of DELETION_STEPS) {
      if (done.has(step)) continue;
      const started = Date.now();
      try {
        const def = this.steps[step];
        const result = def.transactional
          ? await prisma.$transaction((tx) => def.run(req.userId, tx), { timeout: 60_000 })
          : await def.run(req.userId, prisma);
        await prisma.accountDeletionRequest.update({
          where: { id: requestId },
          data: {
            completedSteps: { push: step },
            currentStep: step,
            lockedUntil: new Date(Date.now() + LEASE_MS),
            stepLog: [...((await this.stepLog(requestId)) ?? []), { step, ok: true, ms: Date.now() - started, at: new Date().toISOString(), result }] as Prisma.InputJsonValue,
          },
        });
        await AuditService.log({ actorType: 'SYSTEM', action: `ACCOUNT_DELETION_STEP_${step}`, resourceType: 'account_deletion_request', resourceId: requestId, metadata: { userId: req.userId, result } });
        if (this.crashAfterStep === step) throw new Error(`Simulated crash after ${step}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const fresh = await prisma.accountDeletionRequest.findUniqueOrThrow({ where: { id: requestId } });
        const exhausted = fresh.attempts >= MAX_DELETION_ATTEMPTS;
        const backoffMs = Math.min(3_600_000, 2 ** fresh.attempts * 30_000);
        await prisma.accountDeletionRequest.update({
          where: { id: requestId },
          data: {
            status: exhausted ? 'FAILED' : 'PROCESSING',
            currentStep: step,
            lastError: message.slice(0, 1000),
            lockedBy: null,
            lockedUntil: new Date(Date.now() + backoffMs),
            stepLog: [...((await this.stepLog(requestId)) ?? []), { step, ok: false, error: message.slice(0, 300), at: new Date().toISOString() }] as Prisma.InputJsonValue,
          },
        });
        logger[exhausted ? 'error' : 'warn'](`[AccountDeletion] step ${step} failed`, { requestId, attempts: fresh.attempts, error: message });
        await AuditService.log({ actorType: 'SYSTEM', action: exhausted ? 'ACCOUNT_DELETION_FAILED' : 'ACCOUNT_DELETION_STEP_RETRY', resourceType: 'account_deletion_request', resourceId: requestId, metadata: { step, error: message.slice(0, 300) } });
        return exhausted ? 'FAILED' : 'RETRY';
      }
    }

    await prisma.accountDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED', completedAt: new Date(), verifiedAt: new Date(), lockedBy: null, lockedUntil: null, lastError: null },
    });
    try {
      await redis.del(`notif:unread_count:${req.userId}`);
    } catch {
      // cache is advisory
    }
    await AuditService.log({ actorType: 'SYSTEM', action: 'ACCOUNT_DELETION_COMPLETED', resourceType: 'account_deletion_request', resourceId: requestId, metadata: { userId: req.userId } });
    return 'COMPLETED';
  }

  private static async stepLog(requestId: string): Promise<unknown[] | null> {
    const r = await prisma.accountDeletionRequest.findUnique({ where: { id: requestId }, select: { stepLog: true } });
    return (r?.stepLog as unknown[]) ?? null;
  }

  /** Worker entry point: drain due requests (bounded per tick). */
  public static async processDue(maxRequests = 10): Promise<Record<string, number>> {
    const out = { completed: 0, retry: 0, failed: 0 };
    for (let i = 0; i < maxRequests; i++) {
      const id = await this.claimNext();
      if (!id) break;
      const r = await this.process(id);
      if (r === 'COMPLETED') out.completed++;
      else if (r === 'RETRY') out.retry++;
      else out.failed++;
    }
    return out;
  }

  /**
   * Reconciliation: surfaces stuck/failed requests and clears stale locks. Expired leases are also
   * reclaimed by `claimNext`, so this job is about visibility and cleanup, never silent deletion.
   */
  public static async reconcile(now = new Date()): Promise<{ stuck: number; failed: number; staleLocksCleared: number; completedButUnlocked: number }> {
    const stuckBefore = new Date(now.getTime() - 60 * 60_000);
    const [stuck, failed] = await Promise.all([
      prisma.accountDeletionRequest.count({ where: { status: 'PROCESSING', updatedAt: { lt: stuckBefore } } }),
      prisma.accountDeletionRequest.count({ where: { status: 'FAILED', attempts: { gte: MAX_DELETION_ATTEMPTS } } }),
    ]);
    const stale = await prisma.accountDeletionRequest.updateMany({
      where: { lockedBy: { not: null }, lockedUntil: { lt: now } },
      data: { lockedBy: null },
    });
    // Accounts whose request completed must be locked; if not (e.g. manual DB edit), re-open the request.
    const inconsistent = await prisma.accountDeletionRequest.findMany({
      where: { status: 'COMPLETED', user: { deletedAt: null } },
      select: { id: true },
      take: 100,
    });
    for (const r of inconsistent) {
      await prisma.accountDeletionRequest.update({ where: { id: r.id }, data: { status: 'PROCESSING', completedSteps: [], lockedUntil: null, attempts: 0 } });
    }
    if (stuck || failed || inconsistent.length) {
      logger.error('[AccountDeletion] reconciliation found problems', { stuck, failed, inconsistent: inconsistent.length });
    }
    return { stuck, failed, staleLocksCleared: stale.count, completedButUnlocked: inconsistent.length };
  }
}
