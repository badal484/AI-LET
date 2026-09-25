import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService } from '../src/modules/notifications/services/CampaignService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { NotificationDeliveryEngine } from '../src/modules/notifications/services/NotificationDeliveryEngine.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    notificationCampaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/notifications/services/NotificationDeliveryEngine.js', () => ({
  NotificationDeliveryEngine: {
    dispatchNotification: vi.fn(),
    isWithinQuietHours: vi.fn(),
  },
}));

describe('Phase 14: CampaignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Audience Dry Run Estimation', () => {
    it('should compute dry run breakdown for INACTIVE_USERS with quiet hour and opt-out exclusions', async () => {
      const mockUsers = [
        // User 1: Eligible
        {
          id: 'user-1',
          displayName: 'Alice',
          email: 'alice@example.com',
          profile: { displayName: 'Alice' },
          notificationPreferences: {
            pushEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            timezone: 'America/New_York',
            marketingCategoryEnabled: true,
          },
          userDevices: [{ id: 'dev-1', isActive: true, pushToken: 'tok-1' }],
        },
        // User 2: Excluded by Quiet Hours
        {
          id: 'user-2',
          displayName: 'Bob',
          email: 'bob@example.com',
          profile: { displayName: 'Bob' },
          notificationPreferences: {
            pushEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            timezone: 'Asia/Tokyo',
            marketingCategoryEnabled: true,
          },
          userDevices: [{ id: 'dev-2', isActive: true, pushToken: 'tok-2' }],
        },
        // User 3: Excluded by Push Disabled Opt-Out
        {
          id: 'user-3',
          displayName: 'Charlie',
          email: 'charlie@example.com',
          profile: { displayName: 'Charlie' },
          notificationPreferences: {
            pushEnabled: false, // Opted out
            quietHoursEnabled: false,
            timezone: 'UTC',
            marketingCategoryEnabled: true,
          },
          userDevices: [{ id: 'dev-3', isActive: true, pushToken: 'tok-3' }],
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
      vi.mocked(NotificationDeliveryEngine.isWithinQuietHours)
        .mockReturnValueOnce(false) // User 1: not in quiet hours
        .mockReturnValueOnce(true); // User 2: in quiet hours

      const dryRun = await CampaignService.executeDryRun({
        targetAudience: 'INACTIVE_USERS',
      });

      expect(dryRun.totalMatchedUsers).toBe(3);
      expect(dryRun.ineligibleQuietHoursCount).toBe(1);
      expect(dryRun.ineligibleOptOutCount).toBe(1);
      expect(dryRun.sampleRecipients.length).toBe(3);
      expect(dryRun.sampleRecipients[0].userId).toBe('user-1');
    });
  });

  describe('Campaign Lifecycle & Dispatch', () => {
    it('should create campaign with default DRAFT status', async () => {
      const now = new Date();
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.notificationCampaign.create).mockResolvedValue({
        id: 'camp-1',
        title: 'Weekly Feature Spotlight',
        description: null,
        category: 'product_update',
        targetAudience: 'ALL',
        targetCriteria: null,
        messageTitle: 'New Companions',
        messageBody: 'Explore our latest companions!',
        deepLink: 'ai-companion://explore',
        status: 'DRAFT',
        estimatedAudience: 0,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        failedCount: 0,
        scheduledFor: null,
        expiresAt: null,
        createdByAdminId: null,
        createdAt: now,
        updatedAt: now,
      } as any);

      const campaign = await CampaignService.createOrUpdateCampaign({
        title: 'Weekly Feature Spotlight',
        targetAudience: 'ALL',
        messageTitle: 'New Companions',
        messageBody: 'Explore our latest companions!',
        deepLink: 'ai-companion://explore',
      });

      expect(campaign.id).toBe('camp-1');
      expect(campaign.status).toBe('DRAFT');
    });

    it('should dispatch campaign to audience recipients and track sent/failed counts', async () => {
      const campaign = {
        id: 'camp-1',
        title: 'Re-engagement Blast',
        targetAudience: 'INACTIVE_USERS',
        messageTitle: 'We miss you',
        messageBody: 'Come say hi to Elena',
        deepLink: 'ai-companion://home',
        status: 'APPROVED',
      };

      vi.mocked(prisma.notificationCampaign.findUnique).mockResolvedValue(campaign as any);
      vi.mocked(prisma.notificationCampaign.update).mockResolvedValue({} as any);

      const mockUsers = [
        {
          id: 'user-1',
          email: 'u1@example.com',
          notificationPreferences: { pushEnabled: true },
          userDevices: [{ id: 'd-1', isActive: true, pushToken: 'tok-1' }],
        },
        {
          id: 'user-2',
          email: 'u2@example.com',
          notificationPreferences: { pushEnabled: true },
          userDevices: [{ id: 'd-2', isActive: true, pushToken: 'tok-2' }],
        },
      ];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

      vi.mocked(NotificationDeliveryEngine.dispatchNotification)
        .mockResolvedValueOnce({ success: true, status: 'SENT', sentDevicesCount: 1 } as any)
        .mockResolvedValueOnce({ success: false, status: 'SKIPPED_PREFERENCE', sentDevicesCount: 0 } as any);

      const result = await CampaignService.dispatchCampaign('camp-1');

      expect(result.sentCount).toBe(1);
      expect(prisma.notificationCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'camp-1' },
          data: expect.objectContaining({ status: 'COMPLETED', sentCount: 1 }),
        }),
      );
    });
  });
});
