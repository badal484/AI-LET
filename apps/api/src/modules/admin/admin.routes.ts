import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { AuditService } from '../audit/audit.service.js';
import { AdminController } from './admin.controller.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { adminLoginRateLimiter } from '../../shared/middleware/securityRateLimiter.js';
import {
  adminLoginRequestSchema,
  adminUpdateUserStatusSchema,
  adminAssignRoleSchema,
} from '@ai-companion/validation';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

const router = Router();

// Public Admin Login
router.post(
  '/login',
  adminLoginRateLimiter,
  validateRequest(adminLoginRequestSchema),
  AdminController.login,
);

// Privileged Authenticated Routes
router.use(authenticateAdmin);

router.post('/logout', AdminController.logout);
router.get('/me', AdminController.getMe);

// User Moderation & Management
router.get(
  '/users',
  requirePermission(ADMIN_PERMISSIONS.USERS_READ),
  AdminController.listUsers,
);

router.get(
  '/users/:userId',
  requirePermission(ADMIN_PERMISSIONS.USERS_READ),
  AdminController.getUserDetails,
);

router.patch(
  '/users/:userId/status',
  requirePermission(ADMIN_PERMISSIONS.USERS_SUSPEND),
  validateRequest(adminUpdateUserStatusSchema),
  AdminController.updateUserStatus,
);

// Admin Role Assignment
router.post(
  '/roles/assign',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS_WRITE),
  validateRequest(adminAssignRoleSchema),
  AdminController.assignRole,
);

// Audit Logs
router.get(
  '/audit-logs',
  requirePermission(ADMIN_PERMISSIONS.AUDIT_LOGS_READ),
  AdminController.getAuditLogs,
);

// Creator directory (real data; replaces the console's former hard-coded list)
router.get('/creators', requirePermission(ADMIN_PERMISSIONS.USERS_READ), async (req: Request, res: Response) => {
  const search = typeof req.query['search'] === 'string' ? req.query['search'].trim() : '';
  const verification = typeof req.query['verificationStatus'] === 'string' ? req.query['verificationStatus'].toUpperCase() : '';
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
  const creators = await prisma.creatorProfile.findMany({
    where: {
      ...(search
        ? { OR: [{ username: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] }
        : {}),
      ...(['UNVERIFIED', 'VERIFIED', 'PARTNER'].includes(verification) ? { verificationStatus: verification as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      status: true,
      verificationStatus: true,
      publishedCharactersCount: true,
      totalFollowersCount: true,
      totalMessagesCount: true,
      createdAt: true,
    },
  });
  res.json({ success: true, data: creators });
});

router.patch('/creators/:creatorId/verification', requirePermission(ADMIN_PERMISSIONS.MODERATION_WRITE), async (req: Request, res: Response) => {
  const { verificationStatus, reason } = req.body ?? {};
  if (!['UNVERIFIED', 'VERIFIED', 'PARTNER'].includes(verificationStatus)) {
    throw new BadRequestError('verificationStatus must be UNVERIFIED, VERIFIED or PARTNER');
  }
  const creatorId = String(req.params['creatorId']);
  const before = await prisma.creatorProfile.findUnique({ where: { id: creatorId }, select: { id: true, verificationStatus: true } });
  if (!before) throw new NotFoundError('Creator not found');
  const updated = await prisma.creatorProfile.update({
    where: { id: creatorId },
    data: { verificationStatus },
    select: { id: true, username: true, verificationStatus: true },
  });
  await AuditService.log({
    actorType: 'ADMIN',
    actorId: req.admin!.adminId,
    action: 'CREATOR_VERIFICATION_CHANGED',
    resourceType: 'creator_profile',
    resourceId: creatorId,
    metadata: { from: before.verificationStatus, to: verificationStatus, reason: typeof reason === 'string' ? reason.slice(0, 500) : null },
  });
  res.json({ success: true, data: updated });
});

export const adminRouter: Router = router;
