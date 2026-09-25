import { ApiClient } from './client.js';
import type {
  UserNotificationPreferenceData,
  UserDeviceData,
  UserReminderData,
  NotificationInboxResponse,
  NotificationCategory,
  ApiSuccessResponse,
  PushPlatform,
  PushPermissionStatus,
} from '@ai-companion/types';

export interface RegisterDevicePayload {
  deviceId: string;
  pushToken?: string;
  platform: PushPlatform;
  appVersion?: string;
  pushPermissionStatus: PushPermissionStatus;
}

export interface CreateReminderPayload {
  characterId: string;
  conversationId?: string;
  title: string;
  content: string;
  targetTime: string;
  timezone?: string;
}

export class NotificationApi {
  /**
   * Retrieves current user notification preferences
   */
  public static async getPreferences(): Promise<UserNotificationPreferenceData> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<UserNotificationPreferenceData>>(
      '/notifications/preferences',
    );
    return response.data.data;
  }

  /**
   * Updates user notification preferences (quiet hours, category toggles, daily limits, lock-screen privacy)
   */
  public static async updatePreferences(
    preferences: Partial<UserNotificationPreferenceData>,
  ): Promise<UserNotificationPreferenceData> {
    const client = ApiClient.getInstance();
    const response = await client.patch<ApiSuccessResponse<UserNotificationPreferenceData>>(
      '/notifications/preferences',
      preferences,
    );
    return response.data.data;
  }

  /**
   * Registers or updates current mobile device for push notifications
   */
  public static async registerDevice(payload: RegisterDevicePayload): Promise<UserDeviceData> {
    const client = ApiClient.getInstance();
    const response = await client.post<ApiSuccessResponse<UserDeviceData>>(
      '/notifications/devices',
      payload,
    );
    return response.data.data;
  }

  /**
   * Unregisters a device token (e.g. on logout or push permission revocation)
   */
  public static async unregisterDevice(deviceId: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/notifications/devices/${deviceId}`);
  }

  /**
   * Retrieves paginated in-app notification center inbox
   */
  public static async getInbox(params?: {
    page?: number;
    limit?: number;
    category?: NotificationCategory;
    unreadOnly?: boolean;
  }): Promise<NotificationInboxResponse> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<NotificationInboxResponse>>(
      '/notifications',
      { params },
    );
    return response.data.data;
  }

  /**
   * Retrieves live unread notification count
   */
  public static async getUnreadCount(): Promise<number> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<{ unreadCount: number }>>(
      '/notifications/unread-count',
    );
    return response.data.data.unreadCount;
  }

  /**
   * Marks specified or all in-app notifications as read
   */
  public static async markRead(params: {
    notificationIds?: string[];
    all?: boolean;
  }): Promise<{ updatedCount: number }> {
    const client = ApiClient.getInstance();
    const response = await client.post<ApiSuccessResponse<{ updatedCount: number }>>(
      '/notifications/read',
      params,
    );
    return response.data.data;
  }

  /**
   * Deletes an individual in-app notification
   */
  public static async deleteNotification(notificationId: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/notifications/${notificationId}`);
  }

  /**
   * Creates an explicit user reminder with a character
   */
  public static async createReminder(payload: CreateReminderPayload): Promise<UserReminderData> {
    const client = ApiClient.getInstance();
    const response = await client.post<ApiSuccessResponse<UserReminderData>>(
      '/notifications/reminders',
      payload,
    );
    return response.data.data;
  }

  /**
   * Lists user's reminders
   */
  public static async listReminders(params?: {
    characterId?: string;
    status?: string;
  }): Promise<UserReminderData[]> {
    const client = ApiClient.getInstance();
    const response = await client.get<ApiSuccessResponse<UserReminderData[]>>(
      '/notifications/reminders',
      { params },
    );
    return response.data.data || [];
  }

  /**
   * Cancels a pending user reminder
   */
  public static async cancelReminder(reminderId: string): Promise<UserReminderData> {
    const client = ApiClient.getInstance();
    const response = await client.post<ApiSuccessResponse<UserReminderData>>(
      `/notifications/reminders/${reminderId}/cancel`,
    );
    return response.data.data;
  }
}
