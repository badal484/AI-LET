import { Router, type Request, type Response } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { authenticateAdmin, requirePermission } from '../../../shared/middleware/adminAuth.middleware.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';

/**
 * Operator oversight of the developer platform. Read endpoints never return secrets: API keys are
 * shown by prefix only, webhook signing secrets and delivery payloads/response bodies are omitted.
 */
const router: Router = Router();
router.use(authenticateAdmin);

const read = requirePermission(ADMIN_PERMISSIONS.DEVELOPER_PLATFORM_READ);
const write = requirePermission(ADMIN_PERMISSIONS.DEVELOPER_PLATFORM_WRITE);

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

router.get('/overview', read, async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [projects, activeProjects, activeKeys, webhooks, deliveries24h, delivered24h, failed24h, spend] = await Promise.all([
    prisma.developerProject.count(),
    prisma.developerProject.count({ where: { status: 'ACTIVE' } }),
    prisma.developerApiKey.count({ where: { revokedAt: null } }),
    prisma.webhookEndpoint.count({ where: { active: true } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: since } } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: since }, status: 'DELIVERED' } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: since }, status: { in: ['FAILED', 'EXPIRED'] } } }),
    prisma.developerUsageRecord.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: monthStart() } } }),
  ]);
  res.json({
    success: true,
    data: {
      projects,
      activeProjects,
      activeKeys,
      activeWebhooks: webhooks,
      deliveries24h,
      delivered24h,
      failed24h,
      deliverySuccessRate24h: deliveries24h ? delivered24h / deliveries24h : null,
      monthToDateSpendUsd: spend._sum.costUsd ?? 0,
    },
  });
});

router.get('/projects', read, async (req: Request, res: Response) => {
  const status = typeof req.query['status'] === 'string' ? req.query['status'].toUpperCase() : undefined;
  const projects = await prisma.developerProject.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      status: true,
      environment: true,
      createdAt: true,
      _count: { select: { apiKeys: { where: { revokedAt: null } }, webhooks: { where: { active: true } }, oauthApps: true } },
    },
  });
  const spend = await prisma.developerUsageRecord.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projects.map((p) => p.id) }, createdAt: { gte: monthStart() } },
    _sum: { costUsd: true },
  });
  const spendBy = new Map(spend.map((s) => [s.projectId, s._sum.costUsd ?? 0]));
  res.json({
    success: true,
    data: projects.map(({ _count, ...p }) => ({
      ...p,
      activeKeys: _count.apiKeys,
      activeWebhooks: _count.webhooks,
      oauthApps: _count.oauthApps,
      monthToDateSpendUsd: spendBy.get(p.id) ?? 0,
    })),
  });
});

router.get('/projects/:id', read, async (req: Request, res: Response) => {
  const projectId = String(req.params['id']);
  const project = await prisma.developerProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      status: true,
      environment: true,
      allowedOrigins: true,
      createdAt: true,
      apiKeys: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, keyPrefix: true, keyType: true, scopes: true, environment: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true },
      },
      webhooks: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, url: true, description: true, eventTypes: true, environment: true, active: true, failureCount: true, createdAt: true },
      },
      oauthApps: { select: { id: true, name: true, clientId: true, clientType: true, isPublicClient: true, createdAt: true } },
    },
  });
  if (!project) throw new NotFoundError('Project not found');
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpoint: { projectId } },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, endpointId: true, eventType: true, status: true, statusCode: true, durationMs: true, attemptNumber: true, createdAt: true, deliveredAt: true },
  });
  res.json({ success: true, data: { ...project, recentDeliveries: deliveries } });
});

router.patch('/projects/:id/status', write, async (req: Request, res: Response) => {
  const { status, reason } = req.body ?? {};
  if (!['ACTIVE', 'RESTRICTED', 'SUSPENDED'].includes(status)) {
    throw new BadRequestError('status must be ACTIVE, RESTRICTED or SUSPENDED');
  }
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new BadRequestError('A reason is required');
  const projectId = String(req.params['id']);
  const before = await prisma.developerProject.findUnique({ where: { id: projectId }, select: { status: true } });
  if (!before) throw new NotFoundError('Project not found');
  const updated = await prisma.developerProject.update({
    where: { id: projectId },
    data: { status },
    select: { id: true, name: true, status: true },
  });
  await AuditService.log({
    actorType: 'ADMIN',
    actorId: req.admin!.adminId,
    action: 'DEVELOPER_PROJECT_STATUS_CHANGED',
    resourceType: 'developer_project',
    resourceId: projectId,
    metadata: { from: before.status, to: status, reason: reason.trim().slice(0, 500) },
  });
  res.json({ success: true, data: updated });
});

export { router as adminDeveloperPlatformRouter };
