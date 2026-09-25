import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { AgentsController } from './agents.controller.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';

export const adminAgentsRouter: Router = Router();
const controller = new AgentsController();

// All agent admin routes require active admin authentication
adminAgentsRouter.use(authenticateAdmin);

// Tool Registry Management
adminAgentsRouter.get(
  '/tools',
  requirePermission(ADMIN_PERMISSIONS.TOOLS_READ),
  asyncHandler(controller.adminListTools)
);
adminAgentsRouter.post(
  '/tools',
  requirePermission(ADMIN_PERMISSIONS.TOOLS_WRITE),
  asyncHandler(controller.adminRegisterTool)
);

// Skill Registry Management
adminAgentsRouter.get(
  '/skills',
  requirePermission(ADMIN_PERMISSIONS.SKILLS_READ),
  asyncHandler(controller.adminListSkills)
);
adminAgentsRouter.post(
  '/skills',
  requirePermission(ADMIN_PERMISSIONS.SKILLS_WRITE),
  asyncHandler(controller.adminRegisterSkill)
);

// Character Capability Management
adminAgentsRouter.get(
  '/characters/:characterId/capabilities',
  requirePermission(ADMIN_PERMISSIONS.CAPABILITIES_READ),
  asyncHandler(controller.adminGetCharacterCapabilities)
);
adminAgentsRouter.post(
  '/characters/:characterId/capabilities',
  requirePermission(ADMIN_PERMISSIONS.CAPABILITIES_WRITE),
  asyncHandler(controller.adminSetCharacterCapability)
);

// Agent Execution Traces
adminAgentsRouter.get(
  '/traces',
  requirePermission(ADMIN_PERMISSIONS.AGENTS_READ),
  asyncHandler(controller.adminListTraces)
);
adminAgentsRouter.get(
  '/traces/:taskId',
  requirePermission(ADMIN_PERMISSIONS.AGENTS_READ),
  asyncHandler(controller.adminGetTrace)
);

// Skill experiences catalogue and generation explainability for operators
adminAgentsRouter.get(
  '/experiences',
  requirePermission(ADMIN_PERMISSIONS.AGENTS_READ),
  asyncHandler(controller.listExperiences)
);
adminAgentsRouter.get(
  '/generations/:messageId/explain',
  requirePermission(ADMIN_PERMISSIONS.AGENTS_READ),
  asyncHandler(controller.explainGeneration)
);

// Persisted agent task lifecycle (traces above are per-process and short-lived).
adminAgentsRouter.get(
  '/tasks',
  requirePermission(ADMIN_PERMISSIONS.AGENTS_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const status = typeof req.query['status'] === 'string' ? req.query['status'].toUpperCase() : undefined;
    const tasks = await prisma.agentTaskRecord.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        userId: true,
        characterId: true,
        taskType: true,
        objective: true,
        status: true,
        currentStepIndex: true,
        bounds: true,
        estimatedCostUsd: true,
        actualCostUsd: true,
        failureCode: true,
        createdAt: true,
        completedAt: true,
      },
    });
    res.json({
      success: true,
      data: tasks.map(({ bounds, ...t }) => ({
        ...t,
        maxSteps: typeof (bounds as { maxSteps?: unknown })?.maxSteps === 'number' ? (bounds as { maxSteps: number }).maxSteps : null,
      })),
    });
  })
);
