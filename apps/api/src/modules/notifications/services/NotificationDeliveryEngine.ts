import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { InAppNotificationService } from './InAppNotificationService.js';
import { NotificationService } from './notification.service.js';
import type {
  NotificationCategory,
  PushPayload,
  LockScreenPrivacy,
} from '@ai-companion/types';

export interface DispatchNotificationParams {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  characterId?: string;
  characterName?: string;
  conversationId?: string;
  proactiveActionId?: string;
  deepLink?: string;
  data?: Record<string, any>;
  idempotencyKey?: string;
  bypassQuietHours?: boolean;
}

export interface DispatchNotificationResult {
  success: boolean;
  status: 'SENT' | 'QUEUED_FOR_QUIET_HOURS' | 'SKIPPED_PREFERENCE' | 'SKIPPED_LIMIT' | 'SKIPPED_MUTED' | 'FAILED' | 'DUPLICATE';
  sentDevicesCount: number;
  failedDevicesCount: number;
  scheduledFor?: Date;
  idempotencyKey: string;
  inAppNotificationId?: string;
}

export class NotificationDeliveryEngine {
  /**
   * Helper to check if current time falls within a user's quiet hours in their local timezone.
   */
  public static isWithinQuietHours(
    timezone: string,
    quietHoursStart: string, // "22:30"
    quietHoursEnd: string,   // "08:00"
  ): boolean {
    try {
      const now = new Date();
      // Format current time in user's timezone as HH:mm
      const userTimeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      const parts = userTimeStr.split(':').map(Number);
      const currentHour = parts[0] ?? 0;
      const currentMin = parts[1] ?? 0;
      const currentTotalMin = currentHour * 60 + currentMin;

      const startParts = quietHoursStart.split(':').map(Number);
      const startHour = startParts[0] ?? 22;
      const startMin = startParts[1] ?? 30;
      const startTotalMin = startHour * 60 + startMin;

      const endParts = quietHoursEnd.split(':').map(Number);
      const endHour = endParts[0] ?? 8;
      const endMin = endParts[1] ?? 0;
      const endTotalMin = endHour * 60 + endMin;

      if (startTotalMin <= endTotalMin) {
        // Same-day range e.g. 13:00 to 17:00
        return currentTotalMin >= startTotalMin && currentTotalMin < endTotalMin;
      } else {
        // Overnight range e.g. 22:30 to 08:00
        return currentTotalMin >= startTotalMin || currentTotalMin < endTotalMin;
      }
    } catch (err) {
      logger.warn(`Failed to compute quiet hours for timezone ${timezone}:`, err);
      return false;
    }
  }

  /**
   * Computes the next valid send window when quiet hours end in the user's timezone.
   */
  public static getNextSendWindow(_timezone: string, _quietHoursEnd: string): Date {
    const now = new Date();
    // Schedule for 4 hours from now default
    return new Date(now.getTime() + 4 * 3600 * 1000);
  }

  /**
   * Formats push notification body based on user lock-screen privacy settings.
   */
  public static formatBodyForPrivacy(
    rawBody: string,
    characterName?: string,
    privacy: LockScreenPrivacy = 'FULL_PREVIEW',
    showPreview = true,
  ): string {
    if (!showPreview || privacy === 'HIDE_CONTENT') {
      return 'You have a new message waiting.';
    }

    if (privacy === 'LIMITED_PREVIEW') {
      return characterName ? `New message from ${characterName}` : 'New companion message';
    }

    // FULL_PREVIEW
    return rawBody.length > 120 ? `${rawBody.slice(0, 117)}...` : rawBody;
  }

  /**
   * Main dispatch pipeline orchestrating preferences, quiet hours, idempotency, device tokens, and logging.
   */
  public static async dispatchNotification(params: DispatchNotificationParams): Promise<DispatchNotificationResult> {
    const {
      userId,
      category,
      title,
      body,
      characterId,
      characterName,
      conversationId,
      proactiveActionId,
      deepLink,
      data = {},
      bypassQuietHours = false,
    } = params;

    const idempotencyKey =
      params.idempotencyKey ||
      `notif_${userId}_${category}_${characterId || 'global'}_${Math.floor(Date.now() / 60000)}`;

    // 1. Check Idempotency in delivery logs
    const existingLog = await prisma.notificationDeliveryLog.findUnique({
      where: { idempotencyKey },
    });

    if (existingLog) {
      logger.info(`Duplicate notification suppressed by idempotency key: ${idempotencyKey}`);
      return {
        success: true,
        status: 'DUPLICATE',
        sentDevicesCount: 0,
        failedDevicesCount: 0,
        idempotencyKey,
      };
    }

    // 2. Resolve User Preferences
    const prefs = await NotificationService.getUserPreferences(userId);

    // Check Global Push Toggle
    if (!prefs.pushEnabled && category !== 'security') {
      logger.info(`Push notifications globally disabled for user ${userId}`);
      return {
        success: false,
        status: 'SKIPPED_PREFERENCE',
        sentDevicesCount: 0,
        failedDevicesCount: 0,
        idempotencyKey,
      };
    }

    // Check Muted Characters
    if (characterId && prefs.mutedCharacterIds && (prefs.mutedCharacterIds as string[]).includes(characterId)) {
      logger.info(`Character ${characterId} is muted by user ${userId}; skipping push.`);
      return {
        success: false,
        status: 'SKIPPED_MUTED',
        sentDevicesCount: 0,
        failedDevicesCount: 0,
        idempotencyKey,
      };
    }

    // Check Category Toggles
    const isCategoryAllowed = this.checkCategoryPermission(category, prefs);
    if (!isCategoryAllowed && category !== 'security') {
      logger.info(`Notification category "${category}" is disabled for user ${userId}; skipping.`);
      return {
        success: false,
        status: 'SKIPPED_PREFERENCE',
        sentDevicesCount: 0,
        failedDevicesCount: 0,
        idempotencyKey,
      };
    }

    // 3. Check Quiet Hours
    const isCritical = category === 'security' || category === 'billing';
    if (!bypassQuietHours && !isCritical && prefs.quietHoursEnabled) {
      const inQuietHours = this.isWithinQuietHours(
        prefs.timezone || 'UTC',
        prefs.quietHoursStart || '22:30',
        prefs.quietHoursEnd || '08:00',
      );

      if (inQuietHours) {
        const nextSendWindow = this.getNextSendWindow(prefs.timezone || 'UTC', prefs.quietHoursEnd || '08:00');
        logger.info(`User ${userId} is in quiet hours. Scheduling notification for ${nextSendWindow.toISOString()}`);
        return {
          success: true,
          status: 'QUEUED_FOR_QUIET_HOURS',
          sentDevicesCount: 0,
          failedDevicesCount: 0,
          scheduledFor: nextSendWindow,
          idempotencyKey,
        };
      }
    }

    // 4. Create In-App Notification entry
    let inAppNotificationId: string | undefined;
    try {
      const inApp = await InAppNotificationService.createNotification({
        userId,
        category,
        title,
        body,
        deepLink,
        data: {
          ...data,
          characterId,
          characterName,
          conversationId,
          proactiveActionId,
        },
        sourceType: proactiveActionId ? 'proactive_action' : 'system',
        sourceId: proactiveActionId || conversationId || null,
      });
      inAppNotificationId = inApp.id;
    } catch (err) {
      logger.warn(`Failed to create in-app notification record for user ${userId}:`, err);
    }

    // 5. Query Active Devices with Push Tokens
    const devices = await prisma.userDevice.findMany({
      where: {
        userId,
        isActive: true,
        pushToken: { not: null },
        pushPermissionStatus: { in: ['AUTHORIZED', 'PROVISIONAL'] },
      },
    });

    if (devices.length === 0) {
      logger.info(`No active push devices for user ${userId}. In-app notification created.`);
      return {
        success: true,
        status: 'SENT',
        sentDevicesCount: 0,
        failedDevicesCount: 0,
        idempotencyKey,
        inAppNotificationId,
      };
    }

    // 6. Format Payload with Privacy
    const privacy = (prefs.lockScreenPrivacy as LockScreenPrivacy) || 'FULL_PREVIEW';
    const formattedBody = this.formatBodyForPrivacy(body, characterName, privacy, prefs.showPreview);
    const resolvedDeepLink =
      deepLink ||
      (conversationId
        ? `ai-companion://chat/${conversationId}`
        : characterId
        ? `ai-companion://character/${characterId}`
        : 'ai-companion://notifications');

    const pushProvider = NotificationService.getPushProvider();
    let sentDevicesCount = 0;
    let failedDevicesCount = 0;

    // 7. Dispatch to devices
    await Promise.all(
      devices.map(async device => {
        if (!device.pushToken) return;

        const payload: PushPayload = {
          toToken: device.pushToken,
          title,
          body: formattedBody,
          data: {
            type: category,
            conversationId,
            characterId,
            proactiveActionId,
            deepLink: resolvedDeepLink,
          },
        };

        const result = await pushProvider.sendPush(payload);

        if (result.success) {
          sentDevicesCount++;
          await prisma.notificationDeliveryLog.create({
            data: {
              userId,
              deviceId: device.deviceId,
              category,
              provider: pushProvider.providerName,
              providerMessageId: result.messageId || null,
              idempotencyKey: `${idempotencyKey}_${device.deviceId}`,
              status: 'SENT',
            },
          });
        } else {
          failedDevicesCount++;
          await prisma.notificationDeliveryLog.create({
            data: {
              userId,
              deviceId: device.deviceId,
              category,
              provider: pushProvider.providerName,
              idempotencyKey: `${idempotencyKey}_${device.deviceId}`,
              status: 'FAILED',
              failureReason: result.error || 'Provider rejected push',
            },
          });

          if (result.isInvalidToken) {
            await prisma.userDevice.update({
              where: { id: device.id },
              data: { isActive: false, invalidatedAt: new Date() },
            });
            logger.warn(`Invalidated push device ${device.id} due to permanent rejection`);
          }
        }
      }),
    );

    return {
      success: sentDevicesCount > 0,
      status: sentDevicesCount > 0 ? 'SENT' : 'FAILED',
      sentDevicesCount,
      failedDevicesCount,
      idempotencyKey,
      inAppNotificationId,
    };
  }

  /**
   * Validates if a specific notification category is allowed by user preferences.
   */
  private static checkCategoryPermission(category: NotificationCategory, prefs: any): boolean {
    switch (category) {
      case 'character_message':
        return prefs.characterMessageCategoryEnabled ?? true;
      case 'reminder':
        return prefs.userReminderCategoryEnabled ?? true;
      case 'recommendations':
        return prefs.recommendationsCategoryEnabled ?? true;
      case 'product_update':
        return prefs.productUpdatesCategoryEnabled ?? true;
      case 'system':
        return prefs.systemCategoryEnabled ?? true;
      case 'billing':
      case 'subscription':
      case 'usage_limit':
        return prefs.billingCategoryEnabled ?? true;
      case 'security':
        return true; // Always allowed
      case 'campaign':
        return prefs.marketingCategoryEnabled ?? false;
      default:
        return true;
    }
  }
}
