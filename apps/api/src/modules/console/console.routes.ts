import { Router, type NextFunction, type Request, type Response } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { getOverview } from './overview.service.js';
import { addMessages, getUser, grantPremium, listUsers, setBlocked } from './users.service.js';
import { getAiCost, getMoney, listCharacters, transactionsCsv, updateCharacter } from './insights.service.js';

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
consoleRouter.get('/users', requirePermission(P.USERS_READ), handle((req) =>
  listUsers({ search: req.query['search'] as string | undefined, page: Number(req.query['page'] ?? 1), filter: req.query['filter'] as string | undefined }),
));
consoleRouter.get('/users/:id', requirePermission(P.USERS_READ), handle((req) => getUser(idOf(req))));
consoleRouter.post('/users/:id/premium', requirePermission(P.BILLING_WRITE), handle((req) => grantPremium(adminId(req), idOf(req), Number(req.body?.days), reasonOf(req))));
consoleRouter.post('/users/:id/messages', requirePermission(P.BILLING_CREDITS_GRANT), handle((req) => addMessages(adminId(req), idOf(req), Number(req.body?.amount), reasonOf(req))));
consoleRouter.post('/users/:id/block', requirePermission(P.USERS_SUSPEND), handle((req) => setBlocked(adminId(req), idOf(req), Boolean(req.body?.blocked), reasonOf(req))));

// Characters
consoleRouter.get('/characters', requirePermission(P.CHARACTERS_READ), handle(() => listCharacters()));
consoleRouter.patch('/characters/:id', requirePermission(P.CHARACTERS_PUBLISH), handle((req) =>
  updateCharacter(adminId(req), idOf(req), { live: req.body?.live, featured: req.body?.featured }),
));

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
