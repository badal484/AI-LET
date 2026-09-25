import { Router } from 'express';
import { OperationsController } from './operations.controller.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import {
  supportTicketUpdateSchema,
  betaInvitationCreateSchema,
  opsIncidentCreateSchema,
  opsIncidentUpdateSchema,
  killSwitchUpdateSchema,
  twoPersonApprovalCreateSchema,
} from '@ai-companion/validation';

export const adminOperationsRouter: Router = Router();

// Protect all admin operation endpoints
adminOperationsRouter.use(authenticateAdmin);

// Support Desk
adminOperationsRouter.get(
  '/support/tickets',
  requirePermission(ADMIN_PERMISSIONS.SUPPORT_READ),
  OperationsController.adminListTickets,
);

adminOperationsRouter.get(
  '/support/tickets/:ticketId',
  requirePermission(ADMIN_PERMISSIONS.SUPPORT_READ),
  OperationsController.adminGetTicket,
);

adminOperationsRouter.patch(
  '/support/tickets/:ticketId',
  requirePermission(ADMIN_PERMISSIONS.SUPPORT_WRITE),
  validateRequest(supportTicketUpdateSchema),
  OperationsController.adminUpdateTicket,
);

adminOperationsRouter.get(
  '/support/audit-logs',
  requirePermission(ADMIN_PERMISSIONS.AUDIT_LOGS_READ),
  OperationsController.adminGetAuditLogs,
);

// Beta Program Management
adminOperationsRouter.post(
  '/beta/invitations',
  requirePermission(ADMIN_PERMISSIONS.BETA_WRITE),
  validateRequest(betaInvitationCreateSchema),
  OperationsController.adminCreateBetaInvite,
);

adminOperationsRouter.get(
  '/beta/invitations',
  requirePermission(ADMIN_PERMISSIONS.BETA_WRITE),
  OperationsController.adminListBetaInvites,
);

// Incident Command Center
adminOperationsRouter.post(
  '/incidents',
  requirePermission(ADMIN_PERMISSIONS.INCIDENTS_WRITE),
  validateRequest(opsIncidentCreateSchema),
  OperationsController.adminDeclareIncident,
);

adminOperationsRouter.get(
  '/incidents',
  requirePermission(ADMIN_PERMISSIONS.INCIDENTS_READ),
  OperationsController.adminListIncidents,
);

adminOperationsRouter.patch(
  '/incidents/:incidentId',
  requirePermission(ADMIN_PERMISSIONS.INCIDENTS_WRITE),
  validateRequest(opsIncidentUpdateSchema),
  OperationsController.adminUpdateIncident,
);

// Operational Kill Switches
adminOperationsRouter.get(
  '/kill-switches',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
  OperationsController.adminListKillSwitches,
);

adminOperationsRouter.post(
  '/kill-switches',
  requirePermission(ADMIN_PERMISSIONS.KILL_SWITCHES_WRITE),
  validateRequest(killSwitchUpdateSchema),
  OperationsController.adminUpdateKillSwitch,
);

// Dual-Custody Two-Person Approvals
adminOperationsRouter.post(
  '/approvals',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS_WRITE),
  validateRequest(twoPersonApprovalCreateSchema),
  OperationsController.adminRequestApproval,
);

adminOperationsRouter.get(
  '/approvals',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
  OperationsController.adminListApprovals,
);

adminOperationsRouter.post(
  '/approvals/:requestId/review',
  requirePermission(ADMIN_PERMISSIONS.APPROVALS_WRITE),
  OperationsController.adminReviewApproval,
);
