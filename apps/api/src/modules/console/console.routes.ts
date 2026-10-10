import { Router, type NextFunction, type Request, type Response } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { getOverview } from './overview.service.js';
import {
  addMessages, cancelDeletion, deleteMemory, getMemories, getUser, grantPremium, listUsers, removePremium, requestDeletion, resetToday,
  setBlocked, signOutEverywhere, usersCsv, type ListParams,
} from './users.service.js';
import { addGalleryImage, getAiCost, getCharacter, getMoney, listCharacters, setCharacterImage, setGallery, transactionsCsv, updateCharacter } from './insights.service.js';
import express from 'express';
import { allSettings, setSetting } from './appSettings.js';
import { AuditService } from '../audit/audit.service.js';
import {
  changeOwnPassword, createPromo, resolveAllMoments, getSafety, getSystem, inviteAdmin, listAudit, listPromos, listSupport, listTeam,
  replySupport, resolveMoment, reviewChat, setAdminActive, setPromoActive, setReportStatus,
} from './ops.service.js';

/**
 * The admin console (apps/admin): one compact API made for its 9 screens.
 * Every route needs an admin session and a permission; changes are written to the audit log.
 */
export const consoleRouter: Router = Router();
consoleRouter.use(authenticateAdmin);

const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await fn(req) });
    } catch (err) {
      next(err);
    }
  };

consoleRouter.get('/overview', requirePermission(ADMIN_PERMISSIONS.ANALYTICS_READ), handle(() => getOverview()));

const P = ADMIN_PERMISSIONS;
const adminId = (req: Request) => req.admin!.adminId;
const idOf = (req: Request) => String(req.params['id']);
const reasonOf = (req: Request) => String(req.body?.reason ?? '').slice(0, 300) || 'no reason given';

// Users
const listParams = (req: Request): ListParams => ({
  search: req.query['search'] as string | undefined,
  page: Number(req.query['page'] ?? 1),
  filter: req.query['filter'] as string | undefined,
  sort: req.query['sort'] as string | undefined,
  dir: req.query['dir'] as string | undefined,
  showTest: req.query['test'] === '1',
});
consoleRouter.get('/users', requirePermission(P.USERS_READ), handle((req) => listUsers(listParams(req))));
consoleRouter.get('/users.csv', requirePermission(P.USERS_READ), async (req, res, next) => {
  try {
    const csv = await usersCsv(listParams(req));
    await AuditService.log({ actorType: 'ADMIN', actorId: adminId(req), action: 'console.users.exported', resourceType: 'USER', resourceId: null, metadata: { filter: req.query['filter'] ?? null } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
consoleRouter.get('/users/:id', requirePermission(P.USERS_READ), handle((req) => getUser(idOf(req))));
consoleRouter.post('/users/:id/premium', requirePermission(P.BILLING_WRITE), handle((req) => grantPremium(adminId(req), idOf(req), Number(req.body?.days), reasonOf(req))));
consoleRouter.post('/users/:id/premium/remove', requirePermission(P.BILLING_WRITE), handle((req) => removePremium(adminId(req), idOf(req), reasonOf(req))));
consoleRouter.post('/users/:id/messages', requirePermission(P.BILLING_CREDITS_GRANT), handle((req) => addMessages(adminId(req), idOf(req), Number(req.body?.amount), reasonOf(req))));
consoleRouter.post('/users/:id/reset-today', requirePermission(P.BILLING_CREDITS_GRANT), handle((req) => resetToday(adminId(req), idOf(req), reasonOf(req))));
consoleRouter.post('/users/:id/block', requirePermission(P.USERS_SUSPEND), handle((req) => setBlocked(adminId(req), idOf(req), Boolean(req.body?.blocked), reasonOf(req))));
consoleRouter.post('/users/:id/sign-out', requirePermission(P.USERS_SUSPEND), handle((req) => signOutEverywhere(adminId(req), idOf(req), reasonOf(req))));
consoleRouter.post('/users/:id/delete', requirePermission(P.USERS_DELETE), handle((req) => requestDeletion(adminId(req), idOf(req), reasonOf(req))));
consoleRouter.post('/users/:id/delete/cancel', requirePermission(P.USERS_DELETE), handle((req) => cancelDeletion(adminId(req), idOf(req))));
// Memories are private: opening them needs a reason and is written to the audit log.
consoleRouter.post('/users/:id/memories', requirePermission(P.MEMORIES_READ), handle((req) => getMemories(adminId(req), idOf(req), reasonOf(req))));
consoleRouter.delete('/users/:id/memories/:memoryId', requirePermission(P.MEMORIES_DELETE), handle((req) =>
  deleteMemory(adminId(req), idOf(req), String(req.params['memoryId']), String(req.query['reason'] ?? '').slice(0, 300) || 'no reason given'),
));

// Characters
consoleRouter.get('/characters', requirePermission(P.CHARACTERS_READ), handle(() => listCharacters()));
consoleRouter.get('/characters/:id', requirePermission(P.CHARACTERS_READ), handle((req) => getCharacter(idOf(req))));
consoleRouter.patch('/characters/:id', requirePermission(P.CHARACTERS_PUBLISH), handle((req) =>
  updateCharacter(adminId(req), idOf(req), { live: req.body?.live, featured: req.body?.featured, name: req.body?.name, tagline: req.body?.tagline }),
));

// A photo is sent as the raw request body (image/*), up to 10 MB.
consoleRouter.post(
  '/characters/:id/image',
  requirePermission(P.CHARACTERS_UPDATE),
  express.raw({ type: 'image/*', limit: '10mb' }),
  handle((req) => setCharacterImage(adminId(req), idOf(req), req.query['kind'] === 'cover' ? 'cover' : 'avatar', req.body as Buffer)),
);
consoleRouter.post(
  '/characters/:id/gallery',
  requirePermission(P.CHARACTERS_UPDATE),
  express.raw({ type: 'image/*', limit: '10mb' }),
  handle((req) => addGalleryImage(adminId(req), idOf(req), req.body as Buffer)),
);
consoleRouter.put('/characters/:id/gallery', requirePermission(P.CHARACTERS_UPDATE), handle((req) => setGallery(adminId(req), idOf(req), req.body?.images)));

// Money
consoleRouter.get('/money', requirePermission(P.BILLING_READ), handle(() => getMoney()));
consoleRouter.get('/money/transactions.csv', requirePermission(P.BILLING_READ), async (req, res, next) => {
  try {
    const csv = await transactionsCsv(req.query['from'] as string | undefined, req.query['to'] as string | undefined);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// AI cost
consoleRouter.get('/ai-cost', requirePermission(P.AI_COST_READ), handle((req) => getAiCost(Number(req.query['days'] ?? 30))));

// Safety
consoleRouter.get('/safety', requirePermission(P.MODERATION_READ), handle(() => getSafety()));
consoleRouter.post('/safety/moments/:id/resolve', requirePermission(P.MODERATION_WRITE), handle((req) => resolveMoment(adminId(req), idOf(req), String(req.body?.note ?? ''))));
consoleRouter.post('/safety/moments/resolve-all', requirePermission(P.MODERATION_WRITE), handle((req) =>
  resolveAllMoments(adminId(req), typeof req.body?.kind === 'string' && req.body.kind ? req.body.kind : null, String(req.body?.note ?? '')),
));
consoleRouter.post('/safety/reports/:id/status', requirePermission(P.MODERATION_WRITE), handle((req) => setReportStatus(adminId(req), idOf(req), String(req.body?.status ?? ''))));
consoleRouter.post('/safety/review', requirePermission(P.MODERATION_WRITE), handle((req) =>
  reviewChat(adminId(req), { messageId: req.body?.messageId, momentId: req.body?.momentId }, reasonOf(req)),
));

// Support
consoleRouter.get('/support', requirePermission(P.SUPPORT_READ), handle((req) => listSupport(String(req.query['status'] ?? 'open'), String(req.query['search'] ?? ''))));
consoleRouter.post('/support/:id/reply', requirePermission(P.SUPPORT_WRITE), handle((req) => replySupport(adminId(req), idOf(req), String(req.body?.reply ?? ''), Boolean(req.body?.close))));

// System
consoleRouter.get('/system', requirePermission(P.SETTINGS_READ), handle(() => getSystem()));

// Settings: switches and limits, promo codes, team, audit log
consoleRouter.get('/settings', requirePermission(P.SETTINGS_READ), handle(() => allSettings()));
consoleRouter.put('/settings/:key', requirePermission(P.SETTINGS_WRITE), handle((req) => setSetting(adminId(req), String(req.params['key']), req.body?.value)));
consoleRouter.get('/promos', requirePermission(P.BILLING_READ), handle(() => listPromos()));
consoleRouter.post('/promos', requirePermission(P.BILLING_PROMOTIONS_WRITE), handle((req) => createPromo(adminId(req), req.body ?? {})));
consoleRouter.post('/promos/:id/active', requirePermission(P.BILLING_PROMOTIONS_WRITE), handle((req) => setPromoActive(adminId(req), idOf(req), Boolean(req.body?.active))));
consoleRouter.get('/team', requirePermission(P.SETTINGS_READ), handle(() => listTeam()));
consoleRouter.post('/team', requirePermission(P.SETTINGS_WRITE), handle((req) => inviteAdmin(adminId(req), String(req.body?.email ?? ''), String(req.body?.name ?? ''), String(req.body?.role ?? ''))));
consoleRouter.post('/team/:id/active', requirePermission(P.SETTINGS_WRITE), handle((req) => setAdminActive(adminId(req), idOf(req), Boolean(req.body?.active))));
consoleRouter.post('/me/password', handle((req) => changeOwnPassword(adminId(req), String(req.body?.current ?? ''), String(req.body?.next ?? ''))));
consoleRouter.get('/audit', requirePermission(P.AUDIT_LOGS_READ), handle((req) => listAudit({ page: Number(req.query['page'] ?? 1), action: req.query['action'] as string | undefined })));
