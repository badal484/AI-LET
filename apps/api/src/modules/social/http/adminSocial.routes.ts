import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ADMIN_PERMISSIONS, SOCIAL_FEATURES, type SocialFeatureKey } from '@ai-companion/config';
import {
  adminCharacterSocialApprovalSchema,
  adminPrivateContentAccessSchema,
  adminSocialAppealDecisionSchema,
  adminSocialCaseDecisionSchema,
  adminSocialKillSwitchSchema,
  adminSocialPolicyRollbackSchema,
  adminSocialPolicyUpdateSchema,
  adminSocialSimulationSchema,
  socialCursorQuerySchema,
} from '@ai-companion/validation';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { BadRequestError } from '../../../shared/errors/AppError.js';
import { SocialPolicyService } from '../policy/SocialPolicyService.js';
import { SocialModerationService } from '../moderation/SocialModerationService.js';
import { SocialMessagingService } from '../messaging/SocialMessagingService.js';
import { SocialAdminService } from '../admin/SocialAdminService.js';
import { SocialGraphService } from '../graph/SocialGraphService.js';
import { CharacterSocialCapabilityService } from '../ai/CharacterSocialCapabilityService.js';
import { handle as h } from './socialMiddleware.js';

const adminId = (req: Request): string => req.admin!.adminId;
const P = ADMIN_PERMISSIONS;

const queueSchema = z.enum(['PROFILES', 'USER_CONTENT', 'COMMENTS', 'MESSAGES', 'COMMUNITIES', 'CREATORS', 'AI_SOCIAL_CONTENT', 'MEDIA']).optional();
const restrictSchema = z.object({
  type: z.enum(['SOCIAL_RESTRICTED', 'CANNOT_COMMENT', 'CANNOT_DIRECT_MESSAGE', 'CANNOT_SHARE_CONTENT', 'CANNOT_CREATE_COMMUNITIES']),
  hours: z.number().int().min(1).max(24 * 365).optional(),
  reason: z.string().trim().min(5).max(1000),
  confirm: z.literal(true),
});

export const adminSocialRouter: Router = Router();
adminSocialRouter.use(authenticateAdmin);

// Overview, health, configuration ------------------------------------------------
adminSocialRouter.get('/overview', requirePermission(P.SOCIAL_READ), h(async (req: Request, res: Response) => {
  const days = z.coerce.number().int().min(1).max(90).default(7).parse(req.query['days']);
  ApiResponse.success(res, await SocialAdminService.overview(days));
}));
adminSocialRouter.get('/graph-health', requirePermission(P.SOCIAL_READ), h(async (_req, res) => ApiResponse.success(res, await SocialAdminService.graphHealth())));
adminSocialRouter.get('/policy', requirePermission(P.SOCIAL_READ), h(async (_req, res) => ApiResponse.success(res, await SocialPolicyService.getActive())));
adminSocialRouter.get('/policy/versions', requirePermission(P.SOCIAL_READ), h(async (_req, res) => ApiResponse.success(res, await SocialPolicyService.listVersions())));
adminSocialRouter.get('/policy/versions/:version', requirePermission(P.SOCIAL_READ), h(async (req, res) => {
  ApiResponse.success(res, await SocialPolicyService.getVersion(z.coerce.number().int().min(1).parse(req.params['version'])));
}));
adminSocialRouter.patch('/policy', requirePermission(P.SOCIAL_CONFIG_WRITE), h(async (req, res) => {
  const input = adminSocialPolicyUpdateSchema.parse(req.body);
  ApiResponse.success(res, await SocialPolicyService.applyPatch({ patch: input.patch, changeReason: input.changeReason, adminId: adminId(req) }));
}));
adminSocialRouter.post('/policy/rollback', requirePermission(P.SOCIAL_CONFIG_WRITE), h(async (req, res) => {
  const input = adminSocialPolicyRollbackSchema.parse(req.body);
  ApiResponse.success(res, await SocialPolicyService.rollback(input.toVersion, input.changeReason, adminId(req)));
}));
adminSocialRouter.post('/kill-switches', requirePermission(P.SOCIAL_KILL_SWITCH_WRITE), h(async (req, res) => {
  const input = adminSocialKillSwitchSchema.parse(req.body);
  if (!(SOCIAL_FEATURES as readonly string[]).includes(input.feature)) throw new BadRequestError('Unknown social feature');
  ApiResponse.success(res, await SocialPolicyService.setKillSwitch(input.feature as SocialFeatureKey, input.active, input.reason, adminId(req)));
}));

// Moderation queues -------------------------------------------------------------
adminSocialRouter.get('/cases', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  const q = socialCursorQuerySchema.parse(req.query);
  ApiResponse.success(res, await SocialModerationService.listCases({ queue: queueSchema.parse(req.query['queue']), status: typeof req.query['status'] === 'string' ? req.query['status'] : undefined, cursor: q.cursor, limit: q.limit }));
}));
adminSocialRouter.get('/cases/:id', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  ApiResponse.success(res, await SocialModerationService.getCase(z.string().uuid().parse(req.params['id']), adminId(req)));
}));
adminSocialRouter.post('/cases/:id/decision', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  ApiResponse.success(res, await SocialModerationService.decide(z.string().uuid().parse(req.params['id']), adminId(req), adminSocialCaseDecisionSchema.parse(req.body)));
}));
adminSocialRouter.post('/cases/:id/private-content', requirePermission(P.SOCIAL_PRIVATE_CONTENT_READ), h(async (req, res) => {
  const input = adminPrivateContentAccessSchema.parse({ ...req.body, caseId: req.params['id'] });
  ApiResponse.success(res, await SocialMessagingService.breakGlassRead(adminId(req), input));
}));
adminSocialRouter.get('/appeals', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  ApiResponse.success(res, await SocialModerationService.listAppeals(typeof req.query['status'] === 'string' ? req.query['status'] : undefined));
}));
adminSocialRouter.post('/appeals/:id/decision', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  const input = adminSocialAppealDecisionSchema.parse(req.body);
  ApiResponse.success(res, await SocialModerationService.decideAppeal(z.string().uuid().parse(req.params['id']), adminId(req), input.decision, input.notes));
}));

// Users, AI actions, simulator ------------------------------------------------------
adminSocialRouter.get('/users/:handle', requirePermission(P.SOCIAL_READ), h(async (req, res) => {
  ApiResponse.success(res, await SocialAdminService.investigateUser(adminId(req), String(req.params['handle'])));
}));
adminSocialRouter.post('/users/:userId/restrictions', requirePermission(P.SOCIAL_MODERATE), h(async (req, res) => {
  const input = restrictSchema.parse(req.body);
  ApiResponse.success(res, await SocialAdminService.restrictUser(adminId(req), z.string().uuid().parse(req.params['userId']), input), 201);
}));
adminSocialRouter.get('/action-logs', requirePermission(P.SOCIAL_READ), h(async (req, res) => {
  ApiResponse.success(res, await SocialAdminService.listActionLogs({
    characterId: typeof req.query['characterId'] === 'string' ? z.string().uuid().parse(req.query['characterId']) : undefined,
    actorType: typeof req.query['actorType'] === 'string' ? req.query['actorType'] : undefined,
    limit: z.coerce.number().int().min(1).max(200).default(50).parse(req.query['limit']),
  }));
}));
adminSocialRouter.post('/characters/:slug/social-approval', requirePermission(P.SOCIAL_WRITE), h(async (req, res) => {
  const input = adminCharacterSocialApprovalSchema.parse(req.body);
  ApiResponse.success(res, await CharacterSocialCapabilityService.setPlatformApproval(adminId(req), String(req.params['slug']), input.approved, input.reason));
}));
adminSocialRouter.post('/simulate', requirePermission(P.SOCIAL_READ), h(async (req, res) => {
  ApiResponse.success(res, await SocialAdminService.simulate(adminSocialSimulationSchema.parse(req.body)));
}));
adminSocialRouter.post('/maintenance/reconcile-counters', requirePermission(P.SOCIAL_WRITE), h(async (_req, res) => {
  ApiResponse.success(res, { updated: await SocialGraphService.reconcileCounters() });
}));
