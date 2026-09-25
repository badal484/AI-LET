import { Prisma } from '@prisma/client';
import {
  DEFAULT_SOCIAL_POLICY,
  ErrorCode,
  SOCIAL_FEATURES,
  type SocialFeatureKey,
  type SocialPolicyConfig,
  type SocialRolloutCohort,
} from '@ai-companion/config';
import type { SocialPolicyVersionItem } from '@ai-companion/types';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { AppError, BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { rolloutBucket } from '../shared/ids.js';

export interface SocialFeatureContext {
  userId?: string | null;
  cohorts?: SocialRolloutCohort[];
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  region?: string;
}

interface CachedPolicy {
  version: number;
  config: SocialPolicyConfig;
  loadedAt: number;
}

/** Local cache TTL. Kill switches bump the Redis epoch so other instances refresh on their next read. */
const LOCAL_TTL_MS = 5_000;
const EPOCH_KEY = 'social:policy:epoch';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Optional targeting keys a feature rollout may carry even though defaults omit them. */
const OPTIONAL_ROLLOUT_KEYS = new Set(['platforms', 'minAppVersion', 'deniedRegions']);

/** Deep merge where arrays and scalars in `patch` replace. Unknown keys are rejected (typos can't silently no-op). */
export function mergePolicy(base: SocialPolicyConfig, patch: Record<string, unknown>): SocialPolicyConfig {
  const merge = (a: unknown, b: unknown, path: string): unknown => {
    if (!isPlainObject(b)) return b;
    if (!isPlainObject(a)) throw new BadRequestError(`Unknown social policy key: ${path}`);
    const out: Record<string, unknown> = { ...a };
    const isRollout = /^features\.[a-z_]+$/.test(path);
    for (const [k, v] of Object.entries(b)) {
      if (!(k in a) && !(isRollout && OPTIONAL_ROLLOUT_KEYS.has(k))) throw new BadRequestError(`Unknown social policy key: ${path ? `${path}.` : ''}${k}`);
      out[k] = merge(a[k], v, path ? `${path}.${k}` : k);
    }
    return out;
  };
  return merge(base, patch, '') as SocialPolicyConfig;
}

/** Structural diff (path -> {from,to}) for audit and review. */
export function diffPolicy(a: unknown, b: unknown, path = ''): Record<string, { from: unknown; to: unknown }> {
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let out: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of keys) out = { ...out, ...diffPolicy(a[k], b[k], path ? `${path}.${k}` : k) };
    return out;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? {} : { [path]: { from: a, to: b } };
}

function validatePolicy(config: SocialPolicyConfig): void {
  for (const f of SOCIAL_FEATURES) {
    const r = config.features[f];
    if (!r || typeof r.enabled !== 'boolean' || r.rolloutPercent < 0 || r.rolloutPercent > 100) {
      throw new BadRequestError(`Invalid rollout for feature ${f}`);
    }
    if (typeof config.killSwitches[f] !== 'boolean') throw new BadRequestError(`Invalid kill switch for ${f}`);
  }
  for (const [action, rule] of Object.entries(config.rateLimits)) {
    if (!Number.isInteger(rule.limit) || rule.limit < 0 || !Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1) {
      throw new BadRequestError(`Invalid rate limit for ${action}`);
    }
  }
  if (config.comments.maxThreadDepth !== 1) throw new BadRequestError('Comment thread depth is fixed at 1 reply level');
  if (config.aiSocial.minScheduleIntervalHours < 1) throw new BadRequestError('AI schedule interval must be >= 1h');
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export class SocialPolicyService {
  private static cache: CachedPolicy | null = null;
  private static cacheEpoch: string | null = null;

  /** Test/ops hook. */
  public static clearCache(): void {
    this.cache = null;
    this.cacheEpoch = null;
  }

  public static async getActive(): Promise<{ version: number; config: SocialPolicyConfig }> {
    const now = Date.now();
    if (this.cache && now - this.cache.loadedAt < LOCAL_TTL_MS) {
      return this.cache;
    }

    // Cheap epoch check lets kill switches propagate across instances without waiting for full TTL.
    let epoch: string | null = null;
    try {
      epoch = await redis.get(EPOCH_KEY);
    } catch {
      // Redis unavailable: fall through to DB.
    }
    if (this.cache && epoch !== null && epoch === this.cacheEpoch) {
      this.cache.loadedAt = now;
      return this.cache;
    }

    try {
      let row = await prisma.socialPolicyVersion.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } });
      if (!row) row = await this.seedDefault();
      const config = mergePolicy(DEFAULT_SOCIAL_POLICY, (row.config ?? {}) as Record<string, unknown>);
      this.cache = { version: row.version, config, loadedAt: now };
      this.cacheEpoch = epoch;
      return this.cache;
    } catch (err) {
      // Social must never take down the core app: serve last known policy, else safe defaults.
      logger.error('[SocialPolicy] Failed to load active policy, serving cached/default', { error: err });
      if (this.cache) return this.cache;
      return { version: 0, config: DEFAULT_SOCIAL_POLICY };
    }
  }

  public static async getConfig(): Promise<SocialPolicyConfig> {
    return (await this.getActive()).config;
  }

  private static async seedDefault() {
    try {
      return await prisma.socialPolicyVersion.create({
        data: {
          version: 1,
          config: DEFAULT_SOCIAL_POLICY as unknown as Prisma.InputJsonValue,
          changeReason: 'Initial default social policy',
          isActive: true,
        },
      });
    } catch {
      // Concurrent seed: another instance won the unique(version) race.
      const row = await prisma.socialPolicyVersion.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } });
      if (!row) throw new AppError('Unable to seed social policy', 500);
      return row;
    }
  }

  /**
   * Evaluates whether a feature is available for this subject.
   * Kill switch wins over everything; then enabled flag; then platform/version/region; then cohort or bucket.
   */
  public static async isFeatureEnabled(feature: SocialFeatureKey, ctx: SocialFeatureContext = {}): Promise<boolean> {
    const config = await this.getConfig();
    return this.evaluateFeature(config, feature, ctx);
  }

  public static evaluateFeature(config: SocialPolicyConfig, feature: SocialFeatureKey, ctx: SocialFeatureContext): boolean {
    if (config.killSwitches[feature]) return false;
    const rollout = config.features[feature];
    if (!rollout?.enabled) return false;
    if (rollout.platforms?.length && ctx.platform && !rollout.platforms.includes(ctx.platform)) return false;
    if (rollout.minAppVersion && ctx.appVersion && compareVersions(ctx.appVersion, rollout.minAppVersion) < 0) return false;
    if (rollout.deniedRegions?.length && ctx.region && rollout.deniedRegions.includes(ctx.region.toUpperCase())) return false;
    if (ctx.cohorts?.some((c) => rollout.cohorts.includes(c))) return true;
    if (rollout.rolloutPercent >= 100) return true;
    if (rollout.rolloutPercent <= 0 || !ctx.userId) return false;
    return rolloutBucket(ctx.userId, `social:${feature}`) < rollout.rolloutPercent;
  }

  public static async assertFeature(feature: SocialFeatureKey, ctx: SocialFeatureContext = {}): Promise<void> {
    if (!(await this.isFeatureEnabled(feature, ctx))) {
      throw new AppError('This feature is not available right now.', 403, ErrorCode.SOCIAL_FEATURE_DISABLED);
    }
  }

  /** Resolves cohorts for a user (internal staff flag lives on the admin side; creator beta = verified creators). */
  public static async resolveCohorts(userId: string): Promise<SocialRolloutCohort[]> {
    const cohorts: SocialRolloutCohort[] = ['general'];
    const creator = await prisma.creatorProfile.findUnique({
      where: { userId },
      select: { status: true, verificationStatus: true },
    });
    if (creator && creator.status === 'ACTIVE' && creator.verificationStatus !== 'UNVERIFIED') cohorts.push('creator_beta');
    // Internal cohort = a verified app account whose email belongs to an active staff admin account.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { normalizedEmail: true, emailVerifiedAt: true } });
    if (user?.emailVerifiedAt) {
      const staff = await prisma.adminUser.findFirst({
        where: { normalizedEmail: user.normalizedEmail, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (staff) cohorts.push('internal');
    }
    return cohorts;
  }

  public static async getAvailability(userId: string | null): Promise<{ features: Record<string, boolean>; policyVersion: number }> {
    const { version, config } = await this.getActive();
    const cohorts = userId ? await this.resolveCohorts(userId) : [];
    const features: Record<string, boolean> = {};
    for (const f of SOCIAL_FEATURES) features[f] = this.evaluateFeature(config, f, { userId, cohorts });
    return { features, policyVersion: version };
  }

  // ---------------------------------------------------------------------------
  // Versioned changes (admin)
  // ---------------------------------------------------------------------------

  public static async listVersions(limit = 50): Promise<SocialPolicyVersionItem[]> {
    const rows = await prisma.socialPolicyVersion.findMany({ orderBy: { version: 'desc' }, take: limit });
    return rows.map((r) => ({
      version: r.version,
      isActive: r.isActive,
      changeReason: r.changeReason,
      authorAdminId: r.authorAdminId,
      rolledBackFrom: r.rolledBackFrom,
      diff: (r.diff as Record<string, unknown>) ?? null,
      effectiveAt: r.effectiveAt.toISOString(),
    }));
  }

  public static async getVersion(version: number) {
    const row = await prisma.socialPolicyVersion.findUnique({ where: { version } });
    if (!row) throw new NotFoundError(`Social policy version ${version} not found`);
    return { version: row.version, config: mergePolicy(DEFAULT_SOCIAL_POLICY, row.config as Record<string, unknown>), isActive: row.isActive };
  }

  /** Creates a new active version from a patch. Serializable so two admins cannot fork the history. */
  public static async applyPatch(params: {
    patch: Record<string, unknown>;
    changeReason: string;
    adminId: string;
    rolledBackFrom?: number | null;
    replaceWith?: SocialPolicyConfig;
  }): Promise<SocialPolicyVersionItem> {
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.socialPolicyVersion.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } });
        const base = current ? mergePolicy(DEFAULT_SOCIAL_POLICY, current.config as Record<string, unknown>) : DEFAULT_SOCIAL_POLICY;
        const next = params.replaceWith ?? mergePolicy(base, params.patch);
        validatePolicy(next);
        const diff = diffPolicy(base, next);
        if (Object.keys(diff).length === 0) throw new BadRequestError('Policy change has no effect');

        const latest = await tx.socialPolicyVersion.findFirst({ orderBy: { version: 'desc' }, select: { version: true } });
        await tx.socialPolicyVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
        return tx.socialPolicyVersion.create({
          data: {
            version: (latest?.version ?? 0) + 1,
            config: next as unknown as Prisma.InputJsonValue,
            diff: diff as unknown as Prisma.InputJsonValue,
            changeReason: params.changeReason,
            authorAdminId: params.adminId,
            rolledBackFrom: params.rolledBackFrom ?? null,
            isActive: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.bumpEpoch();
    await AuditService.log({
      actorType: 'ADMIN',
      actorId: params.adminId,
      action: params.rolledBackFrom ? 'SOCIAL_POLICY_ROLLED_BACK' : 'SOCIAL_POLICY_UPDATED',
      resourceType: 'social_policy',
      resourceId: String(result.version),
      metadata: { changeReason: params.changeReason, diff: result.diff, rolledBackFrom: params.rolledBackFrom ?? null },
    });

    return {
      version: result.version,
      isActive: true,
      changeReason: result.changeReason,
      authorAdminId: result.authorAdminId,
      rolledBackFrom: result.rolledBackFrom,
      diff: result.diff as Record<string, unknown>,
      effectiveAt: result.effectiveAt.toISOString(),
    };
  }

  /** Rollback = new version whose content equals an older version (history is never rewritten). */
  public static async rollback(toVersion: number, changeReason: string, adminId: string): Promise<SocialPolicyVersionItem> {
    const target = await this.getVersion(toVersion);
    const active = await this.getActive();
    return this.applyPatch({
      patch: {},
      replaceWith: target.config,
      changeReason,
      adminId,
      rolledBackFrom: active.version,
    });
  }

  public static async setKillSwitch(feature: SocialFeatureKey, active: boolean, reason: string, adminId: string) {
    if (!SOCIAL_FEATURES.includes(feature)) throw new BadRequestError(`Unknown social feature: ${feature}`);
    return this.applyPatch({
      patch: { killSwitches: { [feature]: active } },
      changeReason: `[KILL SWITCH ${active ? 'ON' : 'OFF'}] ${reason}`,
      adminId,
    });
  }

  private static async bumpEpoch(): Promise<void> {
    this.clearCache();
    try {
      await redis.set(EPOCH_KEY, String(Date.now()));
    } catch (err) {
      logger.warn('[SocialPolicy] Failed to bump policy epoch; other instances will refresh within TTL', { error: err });
    }
  }
}
