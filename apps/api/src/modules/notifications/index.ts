// Phase 7 & 14: Proactive AI & Notification Intelligence Domain Module
export const NOTIFICATIONS_MODULE_NAME = 'notifications';

export * from './services/pushProvider.interface.js';
export * from './services/notification.service.js';
export * from './services/InAppNotificationService.js';
export * from './services/NotificationDeliveryEngine.js';
export * from './services/CampaignService.js';
export * from './services/proactiveEligibility.service.js';
export * from './services/proactiveDecisionEngine.service.js';
export * from './services/proactiveSafetyValidator.service.js';
export * from './services/proactiveGenerator.service.js';
export * from './services/proactiveScheduler.service.js';
export * from './services/proactiveSimulator.service.js';
export * from './services/userReminder.service.js';
export * from './controllers/notification.controller.js';
export * from './controllers/adminProactivity.controller.js';
export * from './controllers/adminNotification.controller.js';
export * from './routes/notification.routes.js';
export * from './routes/adminProactivity.routes.js';
export * from './routes/adminNotification.routes.js';
