import { SocialNotificationService } from './notifications/SocialNotificationService.js';
import { SocialFeedService } from './feed/SocialFeedService.js';
import { SocialRevocationService } from './lifecycle/SocialRevocationService.js';

/**
 * Phase 24 social layer. Domain-event handlers are registered once per process (API and worker)
 * so notifications, feed invalidation and revocation react to graph/content/moderation events.
 */
export function registerSocialEventHandlers(): void {
  SocialNotificationService.registerHandlers();
  SocialFeedService.registerHandlers();
  SocialRevocationService.registerHandlers();
}

registerSocialEventHandlers();

export { socialRouter } from './http/social.routes.js';
export { adminSocialRouter } from './http/adminSocial.routes.js';
export { SocialEvents } from './shared/SocialEvents.js';
export { SocialPolicyService } from './policy/SocialPolicyService.js';
export { SocialAccessService } from './access/SocialAccessService.js';
export { SocialDataLifecycleService } from './lifecycle/SocialDataLifecycleService.js';
export { CharacterSocialActionGateway } from './ai/CharacterSocialActionGateway.js';
export { ScheduledSocialActionService } from './ai/ScheduledSocialActionService.js';
export { SocialNotificationService } from './notifications/SocialNotificationService.js';
export { SocialMessagingService } from './messaging/SocialMessagingService.js';
