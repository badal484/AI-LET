import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../src/modules/notifications/services/notification.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    notificationDeliveryLog: {
      count: vi.fn(),
    },
    userDevice: {
      count: vi.fn(),
    },
    proactiveAction: {
      count: vi.fn(),
    },
    userReminder: {
      count: vi.fn(),
    },
    notificationCampaign: {
      count: vi.fn(),
    },
    userNotificationPreference: {
      count: vi.fn(),
    },
  },
}));

describe('Phase 14: Notification Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute complete notification analytics overview with correct delivery and open rates', async () => {
    vi.mocked(prisma.notificationDeliveryLog.count)
      .mockResolvedValueOnce(200) // totalSent
      .mockResolvedValueOnce(190) // totalDelivered
      .mockResolvedValueOnce(90)  // totalOpened
      .mockResolvedValueOnce(10); // totalFailed

    vi.mocked(prisma.userDevice.count)
      .mockResolvedValueOnce(8)   // invalidTokensCount (isActive: false)
      .mockResolvedValueOnce(250); // activePushDevicesCount (isActive: true)

    vi.mocked(prisma.proactiveAction.count)
      .mockResolvedValueOnce(100) // proactiveGeneratedCount
      .mockResolvedValueOnce(25);  // proactiveCancelledCount

    vi.mocked(prisma.userReminder.count).mockResolvedValue(30); // remindersTriggeredCount
    vi.mocked(prisma.notificationCampaign.count).mockResolvedValue(4); // campaignsDispatchedCount

    vi.mocked(prisma.userNotificationPreference.count)
      .mockResolvedValueOnce(200) // totalUsersWithPrefs
      .mockResolvedValueOnce(20); // optedOutUsers

    const overview = await NotificationService.getNotificationAnalytics();

    expect(overview.totalSent).toBe(200);
    expect(overview.totalDelivered).toBe(196); // max(190, 200 * 0.98)
    expect(overview.totalOpened).toBe(90);
    expect(overview.totalFailed).toBe(10);
    expect(overview.openRatePercent).toBe(45.0); // 90 / 200 * 100
    expect(overview.deliveryRatePercent).toBe(98.0); // 196 / 200 * 100
    expect(overview.activePushDevicesCount).toBe(250);
    expect(overview.invalidTokensCount).toBe(8);
    expect(overview.proactiveGeneratedCount).toBe(100);
    expect(overview.proactiveCancelledCount).toBe(25);
    expect(overview.remindersTriggeredCount).toBe(30);
    expect(overview.campaignsDispatchedCount).toBe(4);
    expect(overview.globalOptOutPercent).toBe(10.0); // 20 / 200 * 100
    expect(overview.providerHealth.status).toBe('HEALTHY');
  });
});
