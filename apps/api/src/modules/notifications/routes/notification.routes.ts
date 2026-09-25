import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const notificationRouter: Router = Router();

// All user notification endpoints require authentication
notificationRouter.use(authenticateUser);

// In-app Notification Center / Inbox
notificationRouter.get('/', NotificationController.getInbox);
notificationRouter.get('/unread-count', NotificationController.getUnreadCount);
notificationRouter.post('/read', NotificationController.markRead);
notificationRouter.delete('/:id', NotificationController.deleteNotification);

// User notification preferences
notificationRouter.get('/preferences', NotificationController.getPreferences);
notificationRouter.patch('/preferences', NotificationController.updatePreferences);

// User client device registration
notificationRouter.post('/devices', NotificationController.registerDevice);
notificationRouter.delete('/devices/:deviceId', NotificationController.unregisterDevice);

// Explicit user reminders
notificationRouter.post('/reminders', NotificationController.createReminder);
notificationRouter.get('/reminders', NotificationController.listReminders);
notificationRouter.post('/reminders/:reminderId/cancel', NotificationController.cancelReminder);
