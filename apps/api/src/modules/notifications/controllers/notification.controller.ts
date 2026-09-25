import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { NotificationService } from '../services/notification.service.js';
import { UserReminderService } from '../services/userReminder.service.js';
import { InAppNotificationService } from '../services/InAppNotificationService.js';
import {
  registerPushDeviceSchema,
  updateNotificationPreferencesSchema,
  createReminderSchema,
  inAppNotificationQuerySchema,
  markNotificationsReadSchema,
} from '@ai-companion/validation';
import { AuthenticationError, ValidationError } from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications/preferences
   */
  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const prefs = await NotificationService.getUserPreferences(userId);
      ApiResponse.success(res, prefs, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/preferences
   */
  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = updateNotificationPreferencesSchema.parse(req.body);
      const updated = await NotificationService.updateUserPreferences(userId, body);

      await AuditService.logEvent({
        actorType: 'USER',
        actorId: userId,
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        resourceType: 'user_notification_preferences',
        resourceId: userId,
        metadata: body,
      });

      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/devices
   */
  public static async registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = registerPushDeviceSchema.parse(req.body);
      const device = await NotificationService.registerDevice(userId, body);

      ApiResponse.success(res, device, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/notifications/devices/:deviceId
   */
  public static async unregisterDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const deviceId = req.params['deviceId'] as string;
      if (!deviceId) {
        throw new ValidationError('deviceId param is required');
      }

      await NotificationService.unregisterDevice(userId, deviceId);
      ApiResponse.success(res, { success: true }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications
   * Paginated in-app notification inbox
   */
  public static async getInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const query = inAppNotificationQuerySchema.parse(req.query);
      const inbox = await InAppNotificationService.getInbox(userId, query);

      ApiResponse.success(res, inbox, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  public static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const unreadCount = await InAppNotificationService.getUnreadCount(userId);
      ApiResponse.success(res, { unreadCount }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/read
   * Mark specific or all notifications as read
   */
  public static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = markNotificationsReadSchema.parse(req.body);
      let result;
      if (body.all) {
        result = await InAppNotificationService.markAllAsRead(userId);
      } else if (body.notificationIds && body.notificationIds.length > 0) {
        result = await InAppNotificationService.markAsRead(userId, body.notificationIds);
      } else {
        result = { updatedCount: 0 };
      }

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   */
  public static async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const id = req.params['id'] as string;
      await InAppNotificationService.deleteNotification(userId, id);
      ApiResponse.success(res, { success: true }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/reminders
   */
  public static async createReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const body = createReminderSchema.parse(req.body);
      const reminder = await UserReminderService.createReminder(userId, body);

      ApiResponse.success(res, reminder, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/reminders
   */
  public static async listReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const reminders = await UserReminderService.listReminders(userId);
      ApiResponse.success(res, reminders, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/reminders/:reminderId/cancel
   */
  public static async cancelReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const reminderId = req.params['reminderId'] as string;
      if (!reminderId) {
        throw new ValidationError('reminderId param is required');
      }

      const cancelled = await UserReminderService.cancelReminder(userId, reminderId);
      ApiResponse.success(res, cancelled, 200);
    } catch (err) {
      next(err);
    }
  }
}
