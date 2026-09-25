import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitlementService } from '../src/modules/billing/entitlements/EntitlementService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

describe('EntitlementService', () => {
  const userId = 'usr_test_entitlement_123';

  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('resolves base chat_basic entitlement for user without paid subscription', async () => {
    vi.spyOn(redis, 'get').mockResolvedValue(null);
    vi.spyOn(redis, 'setex').mockResolvedValue('OK' as any);
    vi.spyOn(prisma.billingSubscription, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.userEntitlement, 'findMany').mockResolvedValue([]);

    const result = await EntitlementService.getEffectiveEntitlements(userId);

    expect(result.userId).toBe(userId);
    expect(result.planCode).toBe('FREE');
    expect(result.entitlements['chat_basic']).toBe(true);
    expect(result.entitlements['voice_access']).toBeFalsy();
    expect(result.entitlements['premium_characters']).toBeFalsy();
  });

  it('resolves plan entitlements for user with active PRO subscription', async () => {
    vi.spyOn(redis, 'get').mockResolvedValue(null);
    vi.spyOn(redis, 'setex').mockResolvedValue('OK' as any);
    vi.spyOn(prisma.billingSubscription, 'findFirst').mockResolvedValue({
      id: 'sub_pro_1',
      userId,
      planId: 'plan_pro',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      plan: {
        code: 'PRO',
        entitlements: [
          { entitlementKey: 'chat_basic' },
          { entitlementKey: 'chat_priority' },
          { entitlementKey: 'premium_characters' },
          { entitlementKey: 'voice_access' },
          { entitlementKey: 'image_generation' },
          { entitlementKey: 'advanced_memory' },
        ],
      },
    } as any);
    vi.spyOn(prisma.userEntitlement, 'findMany').mockResolvedValue([]);

    const result = await EntitlementService.getEffectiveEntitlements(userId);

    expect(result.planCode).toBe('PRO');
    expect(result.entitlements['voice_access']).toBe(true);
    expect(result.entitlements['premium_characters']).toBe(true);
    expect(result.entitlements['image_generation']).toBe(true);
    expect(result.activeEntitlementsList).toContain('voice_access');
  });

  it('combines direct admin grant with free plan entitlements', async () => {
    vi.spyOn(redis, 'get').mockResolvedValue(null);
    vi.spyOn(redis, 'setex').mockResolvedValue('OK' as any);
    vi.spyOn(prisma.billingSubscription, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.userEntitlement, 'findMany').mockResolvedValue([
      {
        id: 'ent_grant_1',
        userId,
        entitlementKey: 'voice_access',
        source: 'ADMIN_GRANT',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      } as any,
    ]);

    const result = await EntitlementService.getEffectiveEntitlements(userId);

    expect(result.planCode).toBe('FREE');
    expect(result.entitlements['chat_basic']).toBe(true);
    expect(result.entitlements['voice_access']).toBe(true); // granted directly
    expect(result.entitlements['premium_characters']).toBeFalsy();
  });

  it('enforces requireEntitlement with ForbiddenError on missing entitlement', async () => {
    vi.spyOn(redis, 'get').mockResolvedValue(null);
    vi.spyOn(redis, 'setex').mockResolvedValue('OK' as any);
    vi.spyOn(prisma.billingSubscription, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.userEntitlement, 'findMany').mockResolvedValue([]);

    await expect(
      EntitlementService.requireEntitlement(userId, 'voice_access'),
    ).rejects.toThrow(/Requires 'voice_access' entitlement/i);
  });

  it('invalidates cache when entitlement changes', async () => {
    const delSpy = vi.spyOn(redis, 'del').mockResolvedValue(1);
    await EntitlementService.invalidateUserCache(userId);
    expect(delSpy).toHaveBeenCalledWith(`entitlements:user:${userId}`);
  });
});
