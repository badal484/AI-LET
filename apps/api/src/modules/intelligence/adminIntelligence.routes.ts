import { Router } from 'express';
import { IntelligenceController } from './intelligence.controller.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import {
  createFailureCaseSchema,
  evaluateFailureCaseSchema,
  replayGenerationSchema,
  circuitBreakerUpdateSchema,
} from '@ai-companion/validation';

export const adminIntelligenceRouter: Router = Router();
const controller = new IntelligenceController();

adminIntelligenceRouter.use(authenticateAdmin);

// Intelligence & Quality Overview
adminIntelligenceRouter.get(
  '/overview',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getOverview
);

// Generation Trace & Attribution Debugger
adminIntelligenceRouter.get(
  '/debugger/:generationId',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getDebuggerSnapshot
);

// Context Replay Engine (Safe sandbox without mutations)
adminIntelligenceRouter.post(
  '/replay',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_REPLAY),
  validateRequest(replayGenerationSchema),
  controller.replayGeneration
);

// Failure Datasets & Regression Suite
adminIntelligenceRouter.get(
  '/failures',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getFailureCases
);

adminIntelligenceRouter.post(
  '/failures',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_WRITE),
  validateRequest(createFailureCaseSchema),
  controller.createFailureCase
);

adminIntelligenceRouter.post(
  '/failures/:caseId/evaluate',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_WRITE),
  validateRequest(evaluateFailureCaseSchema),
  controller.evaluateFailureCase
);

// Cost, Quality & Safety Circuit Breakers
adminIntelligenceRouter.get(
  '/circuit-breakers',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getCircuitBreakers
);

adminIntelligenceRouter.post(
  '/circuit-breakers/override',
  requirePermission(ADMIN_PERMISSIONS.CIRCUIT_BREAKER_OVERRIDE),
  validateRequest(circuitBreakerUpdateSchema),
  controller.updateCircuitBreaker
);

// Metric Registry & Data Lineage
adminIntelligenceRouter.get(
  '/metrics-registry',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getMetricRegistry
);

adminIntelligenceRouter.get(
  '/data-lineage',
  requirePermission(ADMIN_PERMISSIONS.INTELLIGENCE_READ),
  controller.getDataLineage
);
