import { Router } from 'express';
import { OperationsController } from './operations.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import {
  supportTicketCreateSchema,
  betaRedeemSchema,
} from '@ai-companion/validation';

export const operationsRouter: Router = Router();

// Public Platform Status Page Summary
operationsRouter.get('/status', OperationsController.getPublicStatus);

// User In-App Support & Feedback
operationsRouter.post(
  '/support/tickets',
  authenticateUser,
  validateRequest(supportTicketCreateSchema),
  OperationsController.submitSupportTicket,
);

operationsRouter.get(
  '/support/tickets',
  authenticateUser,
  OperationsController.getMyTickets,
);

// User Beta Invite Redemption
operationsRouter.post(
  '/beta/redeem',
  authenticateUser,
  validateRequest(betaRedeemSchema),
  OperationsController.redeemBetaCode,
);
