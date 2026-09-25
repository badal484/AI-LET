import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  InAppNotificationItem,
  NotificationInboxResponse,
  NotificationCategory,
} from '@ai-companion/types';
import type { InAppNotificationQueryInput } from '@ai-companion/validation';

export class InAppNotificationService {
  private static getUnreadCacheKey(userId: string): string {
    return `notif:unread_count:${userId}`;
  }

  /**
   * Creates an in-app notification item and updates unread cache.
   */
  public static async createNotification(params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    deepLink?: string | null;
    data?: Record<string, any> | null;
    sourceType?: string | null;
    sourceId?: string | null;
    expiresAt?: Date | null;
  }): Promise<InAppNotificationItem> {
    const { userId, category, title, body, deepLink, data, sourceType, sourceId, expiresAt } = params;

    const notif = await prisma.inAppNotification.create({
      data: {
        userId,
        category,
        title,
        body,
        deepLink: deepLink || null,
        data: (data as any) || undefined,
        sourceType: sourceType || null,
        sourceId: sourceId || null,
        expiresAt: expiresAt || null,
        isRead: false,
      },
    });

    // Invalidate unread cache
    try {
      await redis.del(this.getUnreadCacheKey(userId));
    } catch {
      // Non-fatal cache invalidation
    }

    return {
      id: notif.id,
      userId: notif.userId,
      category: notif.category as NotificationCategory,
      title: notif.title,
      body: notif.body,
      deepLink: notif.deepLink,
      data: (notif.data as any) || null,
      isRead: notif.isRead,
      readAt: notif.readAt?.toISOString() || null,
      expiresAt: notif.expiresAt?.toISOString() || null,
      sourceType: notif.sourceType,
      sourceId: notif.sourceId,
      createdAt: notif.createdAt ? (typeof notif.createdAt === 'string' ? notif.createdAt : notif.createdAt.toISOString()) : new Date().toISOString(),
      updatedAt: notif.updatedAt ? (typeof notif.updatedAt === 'string' ? notif.updatedAt : notif.updatedAt.toISOString()) : new Date().toISOString(),
    };
  }

  /**
   * Retrieves paginated in-app notifications for a user.
   */
  public static async getInbox(
    userId: string,
    query: InAppNotificationQueryInput,
  ): Promise<NotificationInboxResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      ...(query.category && { category: query.category }),
      ...(query.unreadOnly && { isRead: false }),
    };

    const [items, totalCount, unreadCount] = await Promise.all([
      prisma.inAppNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inAppNotification.count({ where }),
      this.getUnreadCount(userId),
    ]);

    const formatted: InAppNotificationItem[] = items.map(n => ({
      id: n.id,
      userId: n.userId,
      category: n.category as NotificationCategory,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      data: (n.data as any) || null,
      isRead: n.isRead,
      readAt: n.readAt?.toISOString() || null,
      expiresAt: n.expiresAt?.toISOString() || null,
      sourceType: n.sourceType,
      sourceId: n.sourceId,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    return {
      items: formatted,
      unreadCount,
      page,
      limit,
      totalCount,
      hasMore: skip + items.length < totalCount,
    };
  }

  /**
   * Returns the count of unread notifications for a user with Redis caching.
   */
  public static async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.getUnreadCacheKey(userId);
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined && cached !== '') {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {
      // Redis fallback
    }

    const count = await prisma.inAppNotification.count({
      where: { userId, isRead: false },
    });

    try {
      await redis.set(cacheKey, count.toString(), 'EX', 60); // 1 min TTL
    } catch {
      // Non-fatal
    }

    return count;
  }

  /**
   * Marks specified notification IDs as read.
   */
  public static async markAsRead(userId: string, notificationIds: string[]): Promise<{ updatedCount: number }> {
    const now = new Date();
    const result = await prisma.inAppNotification.updateMany({
      where: {
        userId,
        id: { in: notificationIds },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    try {
      await redis.del(this.getUnreadCacheKey(userId));
    } catch {
      // Cache invalidate
    }

    return { updatedCount: result.count };
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  public static async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const now = new Date();
    const result = await prisma.inAppNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    try {
      await redis.del(this.getUnreadCacheKey(userId));
    } catch {
      // Cache invalidate
    }

    return { updatedCount: result.count };
  }

  /**
   * Deletes an individual notification.
   */
  public static async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notif = await prisma.inAppNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notif || notif.userId !== userId) {
      throw new AppError('Notification not found', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.inAppNotification.delete({
      where: { id: notificationId },
    });

    try {
      await redis.del(this.getUnreadCacheKey(userId));
    } catch {
      // Cache invalidate
    }
  }

  /**
   * Cleans up expired notifications periodically.
   */
  public static async cleanupExpiredNotifications(): Promise<number> {
    const now = new Date();
    const result = await prisma.inAppNotification.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired in-app notifications`);
    }

    return result.count;
  }
}
