import { Router } from 'express';
import { authenticateUser, optionalAuth } from '../../../shared/middleware/auth.middleware.js';
import { SocialController as C } from './social.controller.js';
import { handle as h, requireIdempotencyKey as idem, requireSocialFeature as feature, socialReadLimit } from './socialMiddleware.js';

/**
 * /api/v1/social — every primitive is independently feature-gated; every mutation needs an
 * Idempotency-Key; every list is cursor-paginated; people are addressed by public id/username only.
 */
export const socialRouter: Router = Router();

// ----------------------------------------------------------------------------
// Public / optional-auth reads (block & privacy aware when authenticated)
// ----------------------------------------------------------------------------
socialRouter.get('/features', optionalAuth, h(C.features));
socialRouter.get('/users/:handle', optionalAuth, feature('social_identity'), socialReadLimit('profile_read'), h(C.getProfile));
socialRouter.get('/users/:handle/followers', optionalAuth, feature('user_following'), socialReadLimit('profile_read'), h(C.listFollowers));
socialRouter.get('/users/:handle/following', optionalAuth, feature('user_following'), socialReadLimit('profile_read'), h(C.listFollowing));
socialRouter.get('/users/:handle/content', optionalAuth, socialReadLimit('profile_read'), h(C.listUserContent));
socialRouter.get('/content/:publicId', optionalAuth, socialReadLimit('share_read'), h(C.getContent));
socialRouter.get('/content/:publicId/metadata', socialReadLimit('share_read'), h(C.getContentMetadata));
socialRouter.get('/content/:publicId/comments', optionalAuth, feature('comments'), socialReadLimit('share_read'), h(C.listComments));
socialRouter.get('/characters/:slug/content', optionalAuth, socialReadLimit('share_read'), h(C.listCharacterContent));
socialRouter.get('/characters/:slug/follow', optionalAuth, feature('character_following'), h(C.characterFollowState));
socialRouter.get('/communities', optionalAuth, feature('communities'), h(C.discoverCommunities));
socialRouter.get('/communities/:slug', optionalAuth, feature('communities'), h(C.getCommunity));
socialRouter.get('/communities/:slug/posts', optionalAuth, feature('communities'), h(C.communityPosts));
socialRouter.get('/communities/:slug/members', optionalAuth, feature('communities'), h(C.communityMembers));
socialRouter.get('/search', optionalAuth, feature('social_search'), socialReadLimit('profile_read'), h(C.search));

// ----------------------------------------------------------------------------
// Authenticated
// ----------------------------------------------------------------------------
socialRouter.use(authenticateUser);

// Identity, privacy, consent
socialRouter.get('/usernames/:username/availability', feature('social_identity'), h(C.usernameAvailability));
socialRouter.get('/me', h(C.getMe));
socialRouter.post('/me', feature('social_identity'), idem, h(C.createProfile));
socialRouter.patch('/me', idem, h(C.updateMe));
socialRouter.put('/me/username', idem, h(C.changeUsername));
socialRouter.get('/me/privacy', h(C.getPrivacy));
socialRouter.patch('/me/privacy', idem, h(C.updatePrivacy));
socialRouter.get('/me/consents', h(C.getConsents));
socialRouter.put('/me/consents', idem, h(C.updateConsent));
socialRouter.get('/me/enforcement', h(C.myEnforcement));
socialRouter.get('/me/followed-characters', h(C.listFollowedCharacters));

// Graph
socialRouter.post('/follows', feature('user_following'), idem, h(C.follow));
socialRouter.delete('/follows/:handle', idem, h(C.unfollow));
socialRouter.delete('/followers/:handle', idem, h(C.removeFollower));
socialRouter.get('/follow-requests', h(C.listFollowRequests));
socialRouter.post('/follow-requests/respond', idem, h(C.respondFollowRequest));
socialRouter.get('/blocks', h(C.listBlocks));
socialRouter.post('/blocks', idem, h(C.block)); // Blocking is never feature-gated: safety tools always work.
socialRouter.delete('/blocks/:handle', idem, h(C.unblock));
socialRouter.get('/mutes', h(C.listMutes));
socialRouter.post('/mutes', idem, h(C.mute));
socialRouter.delete('/mutes', idem, h(C.unmute));
socialRouter.post('/characters/:slug/follow', feature('character_following'), idem, h(C.followCharacter));
socialRouter.delete('/characters/:slug/follow', idem, h(C.unfollowCharacter));

// Content
socialRouter.post('/shares/preview', h(C.previewShare));
socialRouter.post('/shares', idem, h(C.createShare));
socialRouter.post('/posts', idem, h(C.createPost));
socialRouter.patch('/posts/:publicId', idem, h(C.editPost));
socialRouter.post('/content/:publicId/revoke', idem, h(C.revokeContent));
socialRouter.delete('/content/:publicId', idem, h(C.deleteContent));
socialRouter.put('/content/:publicId/reactions/:type', feature('reactions'), idem, h(C.react));
socialRouter.delete('/content/:publicId/reactions/:type', idem, h(C.unreact));
socialRouter.post('/content/:publicId/comments', feature('comments'), idem, h(C.createComment));
socialRouter.patch('/comments/:id', feature('comments'), idem, h(C.editComment));
socialRouter.delete('/comments/:id', idem, h(C.deleteComment));

// Reports & appeals (never feature-gated)
socialRouter.post('/reports', idem, h(C.report));
socialRouter.post('/appeals', idem, h(C.appeal));

// Feed & discovery
socialRouter.get('/feed', feature('social_feed'), h(C.feed));
socialRouter.post('/feed/feedback', idem, h(C.feedFeedback));
socialRouter.post('/feed/impressions', h(C.feedImpressions));
socialRouter.get('/recommendations', feature('social_recommendations'), h(C.recommendations));

// Messaging (human ↔ human)
socialRouter.get('/messages/unread-count', feature('messaging'), h(C.unreadMessages));
socialRouter.get('/conversations', feature('messaging'), h(C.listThreads));
socialRouter.post('/conversations', feature('messaging'), idem, h(C.startConversation));
socialRouter.get('/conversations/:id/messages', feature('messaging'), h(C.listMessages));
socialRouter.post('/conversations/:id/messages', feature('messaging'), idem, h(C.sendMessage));
socialRouter.post('/conversations/:id/read', feature('messaging'), h(C.markRead));
socialRouter.post('/conversations/:id/typing', feature('messaging'), h(C.typing));
socialRouter.delete('/messages/:id', idem, h(C.deleteMessage));
socialRouter.get('/message-requests', feature('message_requests'), h(C.listMessageRequests));
socialRouter.post('/message-requests/:id/respond', feature('message_requests'), idem, h(C.respondMessageRequest));

// Communities
socialRouter.post('/communities', feature('communities'), idem, h(C.createCommunity));
socialRouter.post('/communities/:slug/join', feature('communities'), idem, h(C.joinCommunity));
socialRouter.post('/communities/:slug/leave', idem, h(C.leaveCommunity));
socialRouter.post('/communities/:slug/invites', feature('communities'), idem, h(C.inviteToCommunity));
socialRouter.get('/communities/:slug/requests', feature('communities'), h(C.communityJoinRequests));
socialRouter.post('/communities/:slug/requests', feature('communities'), idem, h(C.respondCommunityJoinRequest));
socialRouter.post('/communities/:slug/moderation', idem, h(C.moderateCommunity));
socialRouter.get('/communities/:slug/moderation-log', h(C.communityModerationLog));
socialRouter.get('/communities/:slug/analytics', h(C.communityAnalytics));

// Creator controls for character social presence
socialRouter.get('/creator/characters/:slug/social-capabilities', h(C.getCharacterCapabilities));
socialRouter.patch('/creator/characters/:slug/social-capabilities', idem, h(C.updateCharacterCapabilities));
socialRouter.post('/creator/social-actions', feature('character_social_actions'), h(C.proposeCharacterAction));
socialRouter.get('/creator/social-actions/pending', h(C.pendingActions));
socialRouter.post('/creator/social-actions/:id/approve', idem, h(C.approveAction));
socialRouter.post('/creator/social-actions/:id/reject', idem, h(C.rejectAction));
socialRouter.get('/creator/schedules', h(C.listSchedules));
socialRouter.post('/creator/schedules', idem, h(C.createSchedule));
socialRouter.post('/creator/schedules/:id/status', idem, h(C.setScheduleStatus));
