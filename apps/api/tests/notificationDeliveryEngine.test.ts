import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationDeliveryEngine } from '../src/modules/notifications/services/NotificationDeliveryEngine.js';
import { NotificationService } from '../src/modules/notifications/services/notification.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';
import { IPushProvider, PushSendResult } from '../src/modules/notifications/services/pushProvider.interface.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    userDevice: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    userNotificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notificationDeliveryLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    inAppNotification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/infrastructure/redis/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Phase 14: NotificationDeliveryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Quiet Hours & Timezone Calculation', () => {
    it('should correctly evaluate quiet hours in user timezone', () => {
      // Test quiet hours evaluation
      const inQuiet = NotificationDeliveryEngine.isWithinQuietHours('UTC', '00:00', '23:59');
      expect(inQuiet).toBe(true);

      const notInQuiet = NotificationDeliveryEngine.isWithinQuietHours('UTC', '01:00', '01:01');
      expect(typeof notInQuiet).toBe('boolean');
    });

    it('should compute valid next send window outside quiet hours', () => {
      const nextWindow = NotificationDeliveryEngine.getNextSendWindow('America/New_York', '08:00');
      expect(nextWindow).toBeInstanceOf(Date);
      expect(nextWindow.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Lock Screen Privacy Previews', () => {
    it('should format full preview with original body for FULL_PREVIEW', () => {
      const body = NotificationDeliveryEngine.formatBodyForPrivacy(
        'Hey! I found the research paper we discussed.',
        'Elena',
        'FULL_PREVIEW',
        true,
      );
      expect(body).toBe('Hey! I found the research paper we discussed.');
    });

    it('should format limited preview masking body for LIMITED_PREVIEW', () => {
      const body = NotificationDeliveryEngine.formatBodyForPrivacy(
        'Hey! I found the research paper we discussed.',
        'Elena',
        'LIMITED_PREVIEW',
        true,
      );
      expect(body).toBe('New message from Elena');
    });

    it('should format generic preview for HIDE_CONTENT or showPreview=false', () => {
      const body = NotificationDeliveryEngine.formatBodyForPrivacy(
        'Hey! I found the research paper we discussed.',
        'Elena',
        'HIDE_CONTENT',
        true,
      );
      expect(body).toBe('You have a new message waiting.');

      const body2 = NotificationDeliveryEngine.formatBodyForPrivacy(
        'Hey! I found the research paper we discussed.',
        'Elena',
        'FULL_PREVIEW',
        false,
      );
      expect(body2).toBe('You have a new message waiting.');
    });
  });

  describe('Delivery Intent Enforcement', () => {
    it('should return SKIPPED_PREFERENCE when user has push notifications globally disabled', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: false, // Global opt-out
        proactivityEnabled: true,
        quietHoursEnabled: false,
        characterMessageCategoryEnabled: true,
        recommendationsCategoryEnabled: true,
        productUpdatesCategoryEnabled: true,
        systemCategoryEnabled: true,
        billingCategoryEnabled: true,
        securityCategoryEnabled: true,
        mutedCharacterIds: [],
        lockScreenPrivacy: 'FULL_PREVIEW',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue(null);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'character_message',
        title: 'Marcus',
        body: 'Good morning!',
      });

      expect(result.status).toBe('SKIPPED_PREFERENCE');
      expect(result.sentDevicesCount).toBe(0);
    });

    it('should return SKIPPED_PREFERENCE when category is disabled (e.g. recommendations)', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: false,
        characterMessageCategoryEnabled: true,
        recommendationsCategoryEnabled: false, // Disabled category
        productUpdatesCategoryEnabled: true,
        systemCategoryEnabled: true,
        billingCategoryEnabled: true,
        securityCategoryEnabled: true,
        mutedCharacterIds: [],
        lockScreenPrivacy: 'FULL_PREVIEW',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue(null);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'recommendations',
        title: 'New Companion Alert',
        body: 'Meet our new philosophy companion.',
      });

      expect(result.status).toBe('SKIPPED_PREFERENCE');
    });

    it('should return SKIPPED_MUTED when character is in mutedCharacterIds', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: false,
        characterMessageCategoryEnabled: true,
        recommendationsCategoryEnabled: true,
        productUpdatesCategoryEnabled: true,
        systemCategoryEnabled: true,
        billingCategoryEnabled: true,
        securityCategoryEnabled: true,
        mutedCharacterIds: ['char-marcus-999'], // Muted
        lockScreenPrivacy: 'FULL_PREVIEW',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue(null);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'character_message',
        characterId: 'char-marcus-999',
        title: 'Marcus',
        body: 'Hello there!',
      });

      expect(result.status).toBe('SKIPPED_MUTED');
    });

    it('should return DUPLICATE if idempotencyKey already exists in delivery logs', async () => {
      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue({
        id: 'log-existing-1',
        idempotencyKey: 'proactive-msg-msg-12345',
        status: 'DELIVERED',
      } as any);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'character_message',
        idempotencyKey: 'proactive-msg-msg-12345',
        title: 'Elena',
        body: 'Duplicate test',
      });

      expect(result.status).toBe('DUPLICATE');
      expect(result.sentDevicesCount).toBe(0);
    });

    it('should successfully deliver push to active devices and record delivery log and in-app notification', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: false,
        characterMessageCategoryEnabled: true,
        recommendationsCategoryEnabled: true,
        productUpdatesCategoryEnabled: true,
        systemCategoryEnabled: true,
        billingCategoryEnabled: true,
        securityCategoryEnabled: true,
        mutedCharacterIds: [],
        lockScreenPrivacy: 'FULL_PREVIEW',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.notificationDeliveryLog.create).mockResolvedValue({ id: 'log-new-1' } as any);
      vi.mocked(prisma.inAppNotification.create).mockResolvedValue({
        id: 'inapp-new-1',
        userId: 'user-1',
        category: 'character_message',
        title: 'Elena Vance',
        body: 'I was thinking about the concept of time dilation.',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.userDevice.findMany).mockResolvedValue([
        {
          id: 'device-ios-1',
          deviceId: 'device-xyz',
          userId: 'user-1',
          pushToken: 'apns-token-111',
          platform: 'IOS',
          isActive: true,
          pushPermissionStatus: 'AUTHORIZED',
        },
      ] as any);

      const mockProvider: IPushProvider = {
        sendPush: vi.fn(async () => ({
          success: true,
          messageId: 'apns-msg-id-777',
        })),
      };
      NotificationService.setPushProvider(mockProvider);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'character_message',
        characterId: 'char-elena-1',
        characterName: 'Elena Vance',
        title: 'Elena Vance',
        body: 'I was thinking about the concept of time dilation.',
        deepLink: 'ai-companion://conversation/conv-123',
      });

      expect(result.status).toBe('SENT');
      expect(result.sentDevicesCount).toBe(1);
      expect(result.inAppNotificationId).toBe('inapp-new-1');
      expect(prisma.notificationDeliveryLog.create).toHaveBeenCalled();
      expect(prisma.inAppNotification.create).toHaveBeenCalled();
    });

    it('should invalidate device token when push provider returns isInvalidToken: true', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: false,
        characterMessageCategoryEnabled: true,
        recommendationsCategoryEnabled: true,
        productUpdatesCategoryEnabled: true,
        systemCategoryEnabled: true,
        billingCategoryEnabled: true,
        securityCategoryEnabled: true,
        mutedCharacterIds: [],
        lockScreenPrivacy: 'FULL_PREVIEW',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notificationDeliveryLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.notificationDeliveryLog.create).mockResolvedValue({ id: 'log-new-2' } as any);
      vi.mocked(prisma.inAppNotification.create).mockResolvedValue({
        id: 'inapp-new-2',
        userId: 'user-1',
        category: 'character_message',
        title: 'Elena Vance',
        body: 'Check-in message',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.userDevice.findMany).mockResolvedValue([
        {
          id: 'device-dead-1',
          deviceId: 'device-dead-xyz',
          userId: 'user-1',
          pushToken: 'dead-token-000',
          platform: 'IOS',
          isActive: true,
          pushPermissionStatus: 'AUTHORIZED',
        },
      ] as any);
      vi.mocked(prisma.userDevice.update).mockResolvedValue({} as any);

      const mockProvider: IPushProvider = {
        sendPush: vi.fn(async () => ({
          success: false,
          error: 'BadDeviceToken',
          isInvalidToken: true,
        } as PushSendResult)),
      };
      NotificationService.setPushProvider(mockProvider);

      const result = await NotificationDeliveryEngine.dispatchNotification({
        userId: 'user-1',
        category: 'character_message',
        title: 'Elena Vance',
        body: 'Check-in message',
      });

      expect(result.failedDevicesCount).toBe(1);
      expect(prisma.userDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'device-dead-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });
});
