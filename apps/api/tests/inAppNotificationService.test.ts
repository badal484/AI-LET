import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InAppNotificationService } from '../src/modules/notifications/services/InAppNotificationService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    inAppNotification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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

describe('Phase 14: InAppNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
  });

  describe('Inbox Creation & Pagination', () => {
    it('should create an in-app notification with proper category and optional expiry', async () => {
      const now = new Date();
      vi.mocked(prisma.inAppNotification.create).mockResolvedValue({
        id: 'inapp-1',
        userId: 'user-1',
        category: 'character_message',
        characterId: 'char-1',
        characterName: 'Elena',
        title: 'Elena Vance',
        body: 'I was thinking about you today.',
        deepLink: 'ai-companion://conversation/conv-1',
        isRead: false,
        readAt: null,
        metadata: { intent: 'CHECK_IN' },
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      } as any);

      const item = await InAppNotificationService.createNotification({
        userId: 'user-1',
        category: 'character_message',
        title: 'Elena Vance',
        body: 'I was thinking about you today.',
        deepLink: 'ai-companion://conversation/conv-1',
        data: { intent: 'CHECK_IN' },
      });

      expect(item.id).toBe('inapp-1');
      expect(item.category).toBe('character_message');
      expect(item.isRead).toBe(false);
      expect(redis.del).toHaveBeenCalledWith('notif:unread_count:user-1');
    });

    it('should query paginated inbox notifications with category and unread filters', async () => {
      const mockItems = [
        {
          id: 'inapp-1',
          userId: 'user-1',
          category: 'character_message',
          title: 'Elena Vance',
          body: 'Hello',
          deepLink: null,
          data: null,
          isRead: false,
          readAt: null,
          expiresAt: null,
          sourceType: null,
          sourceId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.inAppNotification.findMany).mockResolvedValue(mockItems as any);
      vi.mocked(prisma.inAppNotification.count)
        .mockResolvedValueOnce(1) // totalCount
        .mockResolvedValueOnce(1); // unreadCount for getUnreadCount

      const result = await InAppNotificationService.getInbox('user-1', {
        page: 1,
        limit: 20,
        category: 'character_message',
        unreadOnly: true,
      });

      expect(result.items.length).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.page).toBe(1);
      expect(prisma.inAppNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            category: 'character_message',
            isRead: false,
          }),
        }),
      );
    });
  });

  describe('Unread Count & Caching', () => {
    it('should return unread count from Redis cache when available', async () => {
      vi.mocked(redis.get).mockResolvedValue('5');

      const count = await InAppNotificationService.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(prisma.inAppNotification.count).not.toHaveBeenCalled();
    });

    it('should query database and set Redis cache when cache misses', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.inAppNotification.count).mockResolvedValue(3);

      const count = await InAppNotificationService.getUnreadCount('user-1');

      expect(count).toBe(3);
      expect(prisma.inAppNotification.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 'user-1', isRead: false }),
      });
      expect(redis.set).toHaveBeenCalledWith('notif:unread_count:user-1', '3', 'EX', 60);
    });
  });

  describe('Mark as Read & Dismiss', () => {
    it('should mark a specific notification as read and invalidate unread count cache', async () => {
      vi.mocked(prisma.inAppNotification.updateMany).mockResolvedValue({
        count: 1,
      });

      const res = await InAppNotificationService.markAsRead('user-1', ['inapp-1']);

      expect(res.updatedCount).toBe(1);
      expect(prisma.inAppNotification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            id: { in: ['inapp-1'] },
            isRead: false,
          }),
          data: expect.objectContaining({ isRead: true }),
        }),
      );
      expect(redis.del).toHaveBeenCalledWith('notif:unread_count:user-1');
    });

    it('should mark all notifications as read in bulk', async () => {
      vi.mocked(prisma.inAppNotification.updateMany).mockResolvedValue({ count: 7 });

      const updatedCount = await InAppNotificationService.markAllAsRead('user-1');

      expect(updatedCount.updatedCount).toBe(7);
      expect(prisma.inAppNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: expect.objectContaining({ isRead: true }),
      });
      expect(redis.del).toHaveBeenCalledWith('notif:unread_count:user-1');
    });

    it('should delete a notification', async () => {
      vi.mocked(prisma.inAppNotification.findUnique).mockResolvedValue({
        id: 'inapp-1',
        userId: 'user-1',
      } as any);
      vi.mocked(prisma.inAppNotification.delete).mockResolvedValue({} as any);

      await expect(
        InAppNotificationService.deleteNotification('user-1', 'inapp-1')
      ).resolves.toBeUndefined();

      expect(prisma.inAppNotification.delete).toHaveBeenCalledWith({ where: { id: 'inapp-1' } });
      expect(redis.del).toHaveBeenCalledWith('notif:unread_count:user-1');
    });

    it('should cleanup expired notifications', async () => {
      vi.mocked(prisma.inAppNotification.deleteMany).mockResolvedValue({ count: 12 });

      const cleaned = await InAppNotificationService.cleanupExpiredNotifications();

      expect(cleaned).toBe(12);
      expect(prisma.inAppNotification.deleteMany).toHaveBeenCalled();
    });
  });
});
