import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  changeUsernameSchema,
  characterFollowSchema,
  characterSocialActionProposalSchema,
  characterSocialCapabilitiesSchema,
  communityInviteSchema,
  communityModerationSchema,
  createCommunitySchema,
  createSocialProfileSchema,
  joinCommunitySchema,
  scheduledSocialActionSchema,
  socialAppealSchema,
  socialBlockSchema,
  socialConsentUpdateSchema,
  socialCreateCommentSchema,
  socialCreatePostSchema,
  socialCreateShareSchema,
  socialCursorQuerySchema,
  socialEditCommentSchema,
  socialEditPostSchema,
  socialFeedFeedbackSchema,
  socialFeedQuerySchema,
  socialFollowRequestResponseSchema,
  socialMessageRequestSchema,
  socialMuteSchema,
  socialReactionSchema,
  socialReportSchema,
  socialRespondMessageRequestSchema,
  socialSearchQuerySchema,
  socialSendMessageSchema,
  socialSharePreviewSchema,
  socialUserTargetSchema,
  updateSocialPrivacySchema,
  updateSocialProfileSchema,
} from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialProfileService } from '../identity/SocialProfileService.js';
import { UsernameService } from '../identity/UsernameService.js';
import { PrivacyPolicyService } from '../identity/PrivacyPolicyService.js';
import { SocialConsentService } from '../consent/SocialConsentService.js';
import { SocialGraphService } from '../graph/SocialGraphService.js';
import { SocialContentService } from '../content/SocialContentService.js';
import { SocialCommentService, SocialReactionService } from '../content/SocialInteractionService.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { SocialMessagingService } from '../messaging/SocialMessagingService.js';
import { CommunityService } from '../communities/CommunityService.js';
import { SocialFeedService } from '../feed/SocialFeedService.js';
import { SocialDiscoveryService } from '../feed/SocialDiscoveryService.js';
import { CharacterSocialCapabilityService } from '../ai/CharacterSocialCapabilityService.js';
import { CharacterSocialActionGateway } from '../ai/CharacterSocialActionGateway.js';
import { ScheduledSocialActionService } from '../ai/ScheduledSocialActionService.js';
import { SocialEvents } from '../shared/SocialEvents.js';
import { requestIdOf } from './socialMiddleware.js';

const uid = (req: Request): string => req.user!.userId;
const viewer = (req: Request): string | null => req.user?.userId ?? null;
const param = (req: Request, name: string): string => String(req.params[name] ?? '');
const cursorQuery = (req: Request) => socialCursorQuerySchema.parse(req.query);

const impressionsSchema = z.object({ items: z.array(z.object({ contentId: z.string().min(8).max(32), position: z.number().int().min(0).max(1000) })).max(50) });
const unmuteSchema = z.object({
  targetType: z.enum(['USER', 'CREATOR', 'CHARACTER', 'COMMUNITY', 'TOPIC', 'NOTIFICATION_CATEGORY']),
  target: z.string().trim().min(1).max(100),
  scope: z.enum(['ALL', 'POSTS', 'COMMENTS', 'NOTIFICATIONS']).optional(),
});
const joinRequestResponseSchema = z.object({ target: z.string().min(8).max(32), approve: z.boolean() });
const scheduleStatusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']) });

/** Thin HTTP adapters: validation + delegation. All rules live in the services. */
export class SocialController {
  // --- Availability & identity ----------------------------------------------
  static async features(req: Request, res: Response) {
    ApiResponse.success(res, await SocialPolicyService.getAvailability(viewer(req)));
  }
  static async usernameAvailability(req: Request, res: Response) {
    ApiResponse.success(res, await UsernameService.checkAvailability(param(req, 'username'), viewer(req) ?? undefined));
  }
  static async createProfile(req: Request, res: Response) {
    ApiResponse.success(res, await SocialProfileService.create(uid(req), createSocialProfileSchema.parse(req.body)), 201);
  }
  static async getMe(req: Request, res: Response) {
    ApiResponse.success(res, await SocialProfileService.getMine(uid(req)));
  }
  static async updateMe(req: Request, res: Response) {
    ApiResponse.success(res, await SocialProfileService.update(uid(req), updateSocialProfileSchema.parse(req.body)));
  }
  static async changeUsername(req: Request, res: Response) {
    const { username } = changeUsernameSchema.parse(req.body);
    ApiResponse.success(res, { username: await UsernameService.changeUsername(uid(req), username) });
  }
  static async getPrivacy(req: Request, res: Response) {
    ApiResponse.success(res, PrivacyPolicyService.toDto(await PrivacyPolicyService.get(uid(req))));
  }
  static async updatePrivacy(req: Request, res: Response) {
    ApiResponse.success(res, PrivacyPolicyService.toDto(await PrivacyPolicyService.update(uid(req), updateSocialPrivacySchema.parse(req.body))));
  }
  static async getConsents(req: Request, res: Response) {
    ApiResponse.success(res, await SocialConsentService.list(uid(req)));
  }
  static async updateConsent(req: Request, res: Response) {
    const input = socialConsentUpdateSchema.parse(req.body);
    ApiResponse.success(res, await SocialConsentService.record(uid(req), input.consentType, input.granted));
  }
  static async getProfile(req: Request, res: Response) {
    const view = await SocialProfileService.getView(viewer(req), param(req, 'handle'));
    SocialEvents.emit('SocialProfileViewed', { actorUserId: viewer(req), surface: 'profile', requestId: requestIdOf(res) });
    ApiResponse.success(res, view);
  }

  // --- Graph -----------------------------------------------------------------
  static async listFollowers(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialGraphService.listFollows(viewer(req), param(req, 'handle'), 'followers', q.cursor, q.limit));
  }
  static async listFollowing(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialGraphService.listFollows(viewer(req), param(req, 'handle'), 'following', q.cursor, q.limit));
  }
  static async follow(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.follow(uid(req), socialUserTargetSchema.parse(req.body).target));
  }
  static async unfollow(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.unfollow(uid(req), param(req, 'handle')));
  }
  static async removeFollower(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.removeFollower(uid(req), param(req, 'handle')));
  }
  static async listFollowRequests(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialGraphService.listIncomingRequests(uid(req), q.cursor, q.limit));
  }
  static async respondFollowRequest(req: Request, res: Response) {
    const input = socialFollowRequestResponseSchema.parse(req.body);
    ApiResponse.success(res, await SocialGraphService.respondToFollowRequest(uid(req), input.target, input.action));
  }
  static async block(req: Request, res: Response) {
    const input = socialBlockSchema.parse(req.body);
    ApiResponse.success(res, await SocialGraphService.block(uid(req), input.target, input.reason));
  }
  static async unblock(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.unblock(uid(req), param(req, 'handle')));
  }
  static async listBlocks(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialGraphService.listBlocked(uid(req), q.cursor, q.limit));
  }
  static async mute(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.mute(uid(req), socialMuteSchema.parse(req.body)), 201);
  }
  static async unmute(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.unmute(uid(req), unmuteSchema.parse(req.body)));
  }
  static async listMutes(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.listMutes(uid(req)));
  }
  static async characterFollowState(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.characterFollowState(viewer(req), param(req, 'slug')));
  }
  static async followCharacter(req: Request, res: Response) {
    const input = characterFollowSchema.parse(req.body ?? {});
    ApiResponse.success(res, await SocialGraphService.followCharacter(uid(req), param(req, 'slug'), input.notificationsEnabled));
  }
  static async unfollowCharacter(req: Request, res: Response) {
    ApiResponse.success(res, await SocialGraphService.unfollowCharacter(uid(req), param(req, 'slug')));
  }
  static async listFollowedCharacters(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialGraphService.listFollowedCharacters(uid(req), q.cursor, q.limit));
  }

  // --- Content ---------------------------------------------------------------
  static async previewShare(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.previewShare(uid(req), socialSharePreviewSchema.parse(req.body)));
  }
  static async createShare(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.createShare(uid(req), socialCreateShareSchema.parse(req.body), requestIdOf(res)), 201);
  }
  static async createPost(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.createPost(uid(req), socialCreatePostSchema.parse(req.body), requestIdOf(res)), 201);
  }
  static async editPost(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.editPost(uid(req), param(req, 'publicId'), socialEditPostSchema.parse(req.body)));
  }
  static async getContent(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.getView(viewer(req), param(req, 'publicId')));
  }
  static async getContentMetadata(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    ApiResponse.success(res, await SocialContentService.getShareMetadata(param(req, 'publicId')));
  }
  static async revokeContent(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.revoke(uid(req), param(req, 'publicId')));
  }
  static async deleteContent(req: Request, res: Response) {
    ApiResponse.success(res, await SocialContentService.deleteOwn(uid(req), param(req, 'publicId')));
  }
  static async listUserContent(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialContentService.listByAuthor(viewer(req), param(req, 'handle'), q.cursor, q.limit));
  }
  static async listCharacterContent(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialContentService.listByCharacter(viewer(req), param(req, 'slug'), q.cursor, q.limit));
  }
  static async react(req: Request, res: Response) {
    const { reactionType } = socialReactionSchema.parse({ reactionType: param(req, 'type') });
    ApiResponse.success(res, await SocialReactionService.react(uid(req), param(req, 'publicId'), reactionType, requestIdOf(res)));
  }
  static async unreact(req: Request, res: Response) {
    const { reactionType } = socialReactionSchema.parse({ reactionType: param(req, 'type') });
    ApiResponse.success(res, await SocialReactionService.unreact(uid(req), param(req, 'publicId'), reactionType));
  }
  static async listComments(req: Request, res: Response) {
    const q = cursorQuery(req);
    const parentId = typeof req.query['parentId'] === 'string' ? z.string().uuid().parse(req.query['parentId']) : undefined;
    ApiResponse.success(res, await SocialCommentService.list(viewer(req), param(req, 'publicId'), { parentId, cursor: q.cursor, limit: q.limit }));
  }
  static async createComment(req: Request, res: Response) {
    ApiResponse.success(res, await SocialCommentService.create(uid(req), param(req, 'publicId'), socialCreateCommentSchema.parse(req.body), requestIdOf(res)), 201);
  }
  static async editComment(req: Request, res: Response) {
    ApiResponse.success(res, await SocialCommentService.edit(uid(req), z.string().uuid().parse(param(req, 'id')), socialEditCommentSchema.parse(req.body).body));
  }
  static async deleteComment(req: Request, res: Response) {
    ApiResponse.success(res, await SocialCommentService.delete(uid(req), z.string().uuid().parse(param(req, 'id'))));
  }

  // --- Reports / enforcement -------------------------------------------------
  static async report(req: Request, res: Response) {
    ApiResponse.success(res, await SocialModerationService.report(uid(req), socialReportSchema.parse(req.body), requestIdOf(res)), 202);
  }
  static async myEnforcement(req: Request, res: Response) {
    ApiResponse.success(res, await SocialModerationService.myEnforcements(uid(req)));
  }
  static async appeal(req: Request, res: Response) {
    const input = socialAppealSchema.parse(req.body);
    ApiResponse.success(res, await SocialModerationService.submitAppeal(uid(req), input.caseId, input.reason), 201);
  }

  // --- Feed / discovery ------------------------------------------------------
  static async feed(req: Request, res: Response) {
    const q = socialFeedQuerySchema.parse(req.query);
    ApiResponse.success(res, await SocialFeedService.getFeed(uid(req), q.tab, q.cursor, q.limit));
  }
  static async feedFeedback(req: Request, res: Response) {
    ApiResponse.success(res, await SocialFeedService.recordFeedback(uid(req), socialFeedFeedbackSchema.parse(req.body)));
  }
  static async feedImpressions(req: Request, res: Response) {
    ApiResponse.success(res, await SocialFeedService.recordImpressions(uid(req), impressionsSchema.parse(req.body).items), 202);
  }
  static async search(req: Request, res: Response) {
    const q = socialSearchQuerySchema.parse(req.query);
    if (q.type === 'COMMUNITIES') ApiResponse.success(res, await CommunityService.discover(viewer(req), { q: q.q, cursor: q.cursor, limit: q.limit }));
    else ApiResponse.success(res, await SocialDiscoveryService.searchUsers(viewer(req), q.q, q.cursor, q.limit));
  }
  static async recommendations(req: Request, res: Response) {
    ApiResponse.success(res, await SocialDiscoveryService.recommendations(uid(req)));
  }

  // --- Messaging -------------------------------------------------------------
  static async startConversation(req: Request, res: Response) {
    ApiResponse.success(res, await SocialMessagingService.startConversation(uid(req), socialMessageRequestSchema.parse(req.body), requestIdOf(res)), 201);
  }
  static async listThreads(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialMessagingService.listThreads(uid(req), q.cursor, q.limit));
  }
  static async listMessages(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await SocialMessagingService.listMessages(uid(req), z.string().uuid().parse(param(req, 'id')), q.cursor, q.limit));
  }
  static async sendMessage(req: Request, res: Response) {
    ApiResponse.success(res, await SocialMessagingService.send(uid(req), z.string().uuid().parse(param(req, 'id')), socialSendMessageSchema.parse(req.body), requestIdOf(res)), 201);
  }
  static async markRead(req: Request, res: Response) {
    ApiResponse.success(res, await SocialMessagingService.markRead(uid(req), z.string().uuid().parse(param(req, 'id'))));
  }
  static async typing(req: Request, res: Response) {
    await SocialMessagingService.setTyping(uid(req), z.string().uuid().parse(param(req, 'id')));
    ApiResponse.success(res, { ok: true }, 202);
  }
  static async deleteMessage(req: Request, res: Response) {
    ApiResponse.success(res, await SocialMessagingService.deleteMessage(uid(req), z.string().uuid().parse(param(req, 'id'))));
  }
  static async listMessageRequests(req: Request, res: Response) {
    const q = cursorQuery(req);
    const direction = req.query['direction'] === 'outgoing' ? 'outgoing' : 'incoming';
    ApiResponse.success(res, await SocialMessagingService.listRequests(uid(req), direction, q.cursor, q.limit));
  }
  static async respondMessageRequest(req: Request, res: Response) {
    const { action } = socialRespondMessageRequestSchema.parse(req.body);
    ApiResponse.success(res, await SocialMessagingService.respondToRequest(uid(req), z.string().uuid().parse(param(req, 'id')), action));
  }
  static async unreadMessages(req: Request, res: Response) {
    ApiResponse.success(res, { unread: await SocialMessagingService.unreadTotal(uid(req)) });
  }

  // --- Communities -----------------------------------------------------------
  static async discoverCommunities(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await CommunityService.discover(viewer(req), { cursor: q.cursor, limit: q.limit }));
  }
  static async createCommunity(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.create(uid(req), createCommunitySchema.parse(req.body)), 201);
  }
  static async getCommunity(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.get(viewer(req), param(req, 'slug')));
  }
  static async communityPosts(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await CommunityService.listPosts(viewer(req), param(req, 'slug'), q.cursor, q.limit));
  }
  static async communityMembers(req: Request, res: Response) {
    const q = cursorQuery(req);
    ApiResponse.success(res, await CommunityService.listMembers(viewer(req), param(req, 'slug'), q.cursor, q.limit));
  }
  static async joinCommunity(req: Request, res: Response) {
    joinCommunitySchema.parse(req.body);
    ApiResponse.success(res, await CommunityService.join(uid(req), param(req, 'slug')));
  }
  static async leaveCommunity(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.leave(uid(req), param(req, 'slug')));
  }
  static async inviteToCommunity(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.invite(uid(req), param(req, 'slug'), communityInviteSchema.parse(req.body).target));
  }
  static async communityJoinRequests(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.listJoinRequests(uid(req), param(req, 'slug')));
  }
  static async respondCommunityJoinRequest(req: Request, res: Response) {
    const input = joinRequestResponseSchema.parse(req.body);
    ApiResponse.success(res, await CommunityService.respondToJoinRequest(uid(req), param(req, 'slug'), input.target, input.approve));
  }
  static async moderateCommunity(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.moderate(uid(req), param(req, 'slug'), communityModerationSchema.parse(req.body)));
  }
  static async communityModerationLog(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.moderationLog(uid(req), param(req, 'slug')));
  }
  static async communityAnalytics(req: Request, res: Response) {
    ApiResponse.success(res, await CommunityService.analytics(uid(req), param(req, 'slug')));
  }

  // --- Creator AI social controls -------------------------------------------
  static async getCharacterCapabilities(req: Request, res: Response) {
    const ch = await CharacterSocialCapabilityService.resolveOwnedCharacter(uid(req), param(req, 'slug'));
    ApiResponse.success(res, await CharacterSocialCapabilityService.effective(ch.id, ch.slug));
  }
  static async updateCharacterCapabilities(req: Request, res: Response) {
    ApiResponse.success(res, await CharacterSocialCapabilityService.updateByCreator(uid(req), param(req, 'slug'), characterSocialCapabilitiesSchema.parse(req.body)));
  }
  /**
   * Creator-initiated character proposal (e.g. "draft a lore post"). The model output is submitted
   * as a PROPOSAL only; the gateway decides. Creators may only propose for their own characters.
   */
  static async proposeCharacterAction(req: Request, res: Response) {
    const proposal = characterSocialActionProposalSchema.parse(req.body);
    await CharacterSocialCapabilityService.resolveOwnedCharacter(uid(req), proposal.characterSlug);
    ApiResponse.success(res, await CharacterSocialActionGateway.propose(proposal, { actorType: 'AI_CHARACTER', requestId: requestIdOf(res) }), 202);
  }
  static async pendingActions(req: Request, res: Response) {
    ApiResponse.success(res, await CharacterSocialActionGateway.listPending(uid(req)));
  }
  static async approveAction(req: Request, res: Response) {
    ApiResponse.success(res, await CharacterSocialActionGateway.approve(uid(req), z.string().uuid().parse(param(req, 'id'))));
  }
  static async rejectAction(req: Request, res: Response) {
    ApiResponse.success(res, await CharacterSocialActionGateway.reject(uid(req), z.string().uuid().parse(param(req, 'id'))));
  }
  static async listSchedules(req: Request, res: Response) {
    ApiResponse.success(res, await ScheduledSocialActionService.list(uid(req)));
  }
  static async createSchedule(req: Request, res: Response) {
    ApiResponse.success(res, await ScheduledSocialActionService.create(uid(req), scheduledSocialActionSchema.parse(req.body)), 201);
  }
  static async setScheduleStatus(req: Request, res: Response) {
    const { status } = scheduleStatusSchema.parse(req.body);
    ApiResponse.success(res, await ScheduledSocialActionService.setStatus(uid(req), z.string().uuid().parse(param(req, 'id')), status));
  }
}
