import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';
import { inAppMessagesFor, recordCampaignAction } from '../../console/campaigns.service.js';

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

// Admin campaigns shown inside the app (popup card / top banner), and what the person did with them.
notificationRouter.get('/in-app', async (req, res, next) => {
  try {
    res.json({ success: true, data: await inAppMessagesFor(req.user!.userId) });
  } catch (err) {
    next(err);
  }
});
notificationRouter.post('/campaigns/:campaignId/:action', async (req, res, next) => {
  try {
    const action = req.params['action'];
    if (action !== 'open' && action !== 'click' && action !== 'dismiss') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Unknown action' } });
      return;
    }
    res.json({ success: true, data: await recordCampaignAction(req.user!.userId, String(req.params['campaignId']), action) });
  } catch (err) {
    next(err);
  }
});
