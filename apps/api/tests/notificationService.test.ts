import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../src/modules/notifications/services/notification.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';
import { IPushProvider, PushSendResult } from '../src/modules/notifications/services/pushProvider.interface.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    userDevice: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    userNotificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
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

describe('Phase 7: NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Device Registration & Management', () => {
    it('should register a new device and return clean device data', async () => {
      const now = new Date();
      vi.mocked(prisma.userDevice.upsert).mockResolvedValue({
        id: 'dev-1',
        userId: 'user-1',
        deviceId: 'device-xyz',
        pushToken: 'token-abc',
        platform: 'IOS',
        appVersion: '1.0.0',
        pushPermissionStatus: 'AUTHORIZED',
        isActive: true,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      } as any);

      const device = await NotificationService.registerDevice('user-1', {
        deviceId: 'device-xyz',
        pushToken: 'token-abc',
        platform: 'IOS',
        appVersion: '1.0.0',
        pushPermissionStatus: 'AUTHORIZED',
      });

      expect(device.id).toBe('dev-1');
      expect(device.platform).toBe('IOS');
      expect(device.pushToken).toBe('token-abc');
      expect(prisma.userDevice.upsert).toHaveBeenCalledTimes(1);
    });

    it('should deactivate a device on unregisterDevice', async () => {
      vi.mocked(prisma.userDevice.findUnique).mockResolvedValue({
        id: 'dev-1',
        userId: 'user-1',
        deviceId: 'device-xyz',
      } as any);
      vi.mocked(prisma.userDevice.update).mockResolvedValue({} as any);

      await NotificationService.unregisterDevice('user-1', 'device-xyz');

      expect(prisma.userDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dev-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('User Preferences & Cache Invalidation', () => {
    it('should retrieve preferences from Redis cache when available', async () => {
      const cachedData = {
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '08:00',
        timezone: 'UTC',
        maxDailyNotifications: 2,
        maxWeeklyNotifications: 10,
        showPreview: true,
        characterMessageCategoryEnabled: true,
        userReminderCategoryEnabled: true,
        marketingCategoryEnabled: false,
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const prefs = await NotificationService.getUserPreferences('user-1');

      expect(prefs.userId).toBe('user-1');
      expect(prefs.quietHoursStart).toBe('22:30');
      expect(prisma.userNotificationPreference.findUnique).not.toHaveBeenCalled();
    });

    it('should invalidate cache when updating user preferences', async () => {
      const updatedPref = {
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
        timezone: 'America/New_York',
        maxDailyNotifications: 3,
        maxWeeklyNotifications: 15,
        showPreview: false,
        characterMessageCategoryEnabled: true,
        userReminderCategoryEnabled: true,
        marketingCategoryEnabled: false,
        characterOverrides: null,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userNotificationPreference.upsert).mockResolvedValue(updatedPref as any);

      const res = await NotificationService.updateUserPreferences('user-1', {
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
        showPreview: false,
      });

      expect(res.showPreview).toBe(false);
      expect(redis.del).toHaveBeenCalledWith('notif:pref:user-1');
    });
  });

  describe('Multi-Device Push Dispatch & Token Invalidation', () => {
    it('should dispatch push with masked preview when showPreview is false', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        proactivityEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '08:00',
        timezone: 'UTC',
        maxDailyNotifications: 2,
        maxWeeklyNotifications: 10,
        showPreview: false, // Masked
        characterMessageCategoryEnabled: true,
        userReminderCategoryEnabled: true,
        marketingCategoryEnabled: false,
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.userDevice.findMany).mockResolvedValue([
        {
          id: 'dev-1',
          userId: 'user-1',
          pushToken: 'push-token-1',
          isActive: true,
          pushPermissionStatus: 'AUTHORIZED',
        },
      ] as any);

      let capturedPayload: any = null;
      const mockProvider: IPushProvider = {
        sendPush: vi.fn(async (payload) => {
          capturedPayload = payload;
          return { success: true, messageId: 'msg-1' };
        }),
      };

      NotificationService.setPushProvider(mockProvider);

      const result = await NotificationService.dispatchPushToUser({
        userId: 'user-1',
        characterName: 'Aria',
        messageContent: 'Hey! I was wondering if you finished that book.',
        category: 'character_message',
      });

      expect(result.sentCount).toBe(1);
      expect(capturedPayload.title).toBe('Aria');
      expect(capturedPayload.body).toBe('New message from Aria'); // Masked!
    });

    it('should invalidate device token when provider reports isInvalidToken: true (HTTP 410 simulation)', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userNotificationPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        pushEnabled: true,
        showPreview: true,
        characterMessageCategoryEnabled: true,
        userReminderCategoryEnabled: true,
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.userDevice.findMany).mockResolvedValue([
        {
          id: 'dev-expired',
          userId: 'user-1',
          pushToken: 'token_expired_999',
          isActive: true,
          pushPermissionStatus: 'AUTHORIZED',
        },
      ] as any);
      vi.mocked(prisma.userDevice.update).mockResolvedValue({} as any);

      const mockProvider: IPushProvider = {
        sendPush: vi.fn(async () => {
          return {
            success: false,
            error: 'BadDeviceToken',
            isInvalidToken: true,
          } as PushSendResult;
        }),
      };

      NotificationService.setPushProvider(mockProvider);

      const result = await NotificationService.dispatchPushToUser({
        userId: 'user-1',
        characterName: 'Aria',
        messageContent: 'Check in message',
        category: 'character_message',
      });

      expect(result.failedCount).toBe(1);
      expect(result.invalidatedTokensCount).toBe(1);
      expect(prisma.userDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dev-expired' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });
});
