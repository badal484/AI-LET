import { Router, type Request, type Response } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { KnowledgeController } from './knowledge.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { HybridRetrievalEngine } from './services/HybridRetrievalEngine.js';
import { WebResearchService } from './services/WebResearchService.js';

const router: Router = Router();
const controller = new KnowledgeController();

// Knowledge documents, collections, research and QA are private to the authenticated user.
router.use(authenticateUser);

// Documents
router.post('/documents', controller.ingestDocument);
router.get('/documents', controller.listDocuments);
router.get('/documents/:id', controller.getDocument);
router.delete('/documents/:id', controller.deleteDocument);

// Collections
router.post('/collections', controller.createCollection);
router.get('/collections', controller.listCollections);
router.post('/collections/:id/members', controller.addDocumentToCollection);
router.delete('/collections/:id/members/:docId', controller.removeDocumentFromCollection);

// Hybrid Search
router.post('/search', controller.hybridSearch);

// Web Research
router.post('/research', controller.initiateWebResearch);
router.get('/research/:id', controller.getResearchTask);

// Grounded Q&A with Citations
router.post('/qa', controller.groundedQa);

export const knowledgeRouter: Router = router;

// -----------------------------------------------------------------------------
// Operator view. Admins are not users: they see document/collection *metadata* only (never content),
// and the search/research harness runs as the admin's own sandbox principal, so it can only ever
// retrieve documents that sandbox principal owns — never a user's private knowledge.
// -----------------------------------------------------------------------------
const adminRouter: Router = Router();
adminRouter.use(authenticateAdmin);

const sandboxPrincipal = (req: Request) => `admin-sandbox:${req.admin!.adminId}`;

adminRouter.get('/documents', requirePermission(ADMIN_PERMISSIONS.AI_READ), async (_req: Request, res: Response) => {
  const docs = await prisma.knowledgeDocument.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      ownerType: true,
      title: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      status: true,
      failureReason: true,
      currentVersion: true,
      totalChunks: true,
      totalTokens: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({ success: true, data: docs });
});

adminRouter.get('/collections', requirePermission(ADMIN_PERMISSIONS.AI_READ), async (_req: Request, res: Response) => {
  const collections = await prisma.knowledgeCollection.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, visibility: true, createdAt: true, updatedAt: true, _count: { select: { members: true } } },
  });
  res.json({
    success: true,
    data: collections.map(({ _count, ...c }) => ({ ...c, documentCount: _count.members })),
  });
});

adminRouter.post('/search', requirePermission(ADMIN_PERMISSIONS.AI_PLAYGROUND), async (req: Request, res: Response) => {
  const { query, maxCandidates } = req.body ?? {};
  if (typeof query !== 'string' || !query.trim()) throw new BadRequestError('query is required');
  const results = await HybridRetrievalEngine.getInstance().search({
    query: query.trim(),
    userId: sandboxPrincipal(req),
    maxCandidates: Math.min(Number(maxCandidates) || 5, 20),
  });
  res.json({ success: true, data: { query, candidatesCount: results.length, candidates: results, scope: 'admin_sandbox' } });
});

adminRouter.post('/research', requirePermission(ADMIN_PERMISSIONS.AI_PLAYGROUND), async (req: Request, res: Response) => {
  const { query, maxSources } = req.body ?? {};
  if (typeof query !== 'string' || !query.trim()) throw new BadRequestError('query is required');
  await AuditService.log({
    actorType: 'ADMIN',
    actorId: req.admin!.adminId,
    action: 'KNOWLEDGE_RESEARCH_TEST',
    resourceType: 'web_research',
    resourceId: null,
    metadata: { queryLength: query.length },
  });
  const task = await WebResearchService.getInstance().executeResearch({
    userId: sandboxPrincipal(req),
    query: query.trim(),
    maxSources: Math.min(Number(maxSources) || 4, 8),
  });
  res.status(201).json({ success: true, data: task });
});

export { adminRouter as adminKnowledgeRouter };
