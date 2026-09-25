import { Request, Response, NextFunction } from 'express';
import { SupportDeskService } from './SupportDeskService.js';
import { BetaProgramService } from './BetaProgramService.js';
import { IncidentCommandService } from './IncidentCommandService.js';
import { KillSwitchService } from './KillSwitchService.js';
import { TwoPersonApprovalService } from './TwoPersonApprovalService.js';
import { StatusPageService } from './StatusPageService.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';

export class OperationsController {
  private static supportService = SupportDeskService.getInstance();
  private static betaService = BetaProgramService.getInstance();
  private static incidentService = IncidentCommandService.getInstance();
  private static killSwitchService = KillSwitchService.getInstance();
  private static approvalService = TwoPersonApprovalService.getInstance();
  private static statusPageService = StatusPageService.getInstance();

  // Public Status Page
  public static getPublicStatus(_req: Request, res: Response, next: NextFunction): void {
    try {
      const status = OperationsController.statusPageService.getPublicStatus();
      ApiResponse.success(res, status, 200);
    } catch (err) {
      next(err);
    }
  }

  // User: Submit In-App Support Ticket / Feedback
  public static async submitSupportTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'anonymous';
      const userEmail = (req as any).user?.email;
      const ticket = await OperationsController.supportService.createTicket(userId, req.body, userEmail);
      ApiResponse.success(res, ticket, 201);
    } catch (err) {
      next(err);
    }
  }

  // User: Get My Support Tickets
  public static async getMyTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const tickets = await OperationsController.supportService.getUserTickets(userId!);
      ApiResponse.success(res, tickets, 200);
    } catch (err) {
      next(err);
    }
  }

  // User: Redeem Beta Code
  public static async redeemBetaCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const result = await OperationsController.betaService.redeemCode(userId!, req.body.code);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: List Support Tickets
  public static async adminListTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query['status'] as any;
      const category = req.query['category'] as any;
      const priority = req.query['priority'] as any;
      const search = req.query['search'] ? String(req.query['search']) : undefined;

      const tickets = await OperationsController.supportService.listTickets({
        status,
        category,
        priority,
        search,
      });
      ApiResponse.success(res, tickets, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Get Specific Support Ticket (Audited)
  public static async adminGetTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const reason = req.query['reason'] ? String(req.query['reason']) : 'Admin support triage';
      const ticketId = String(req.params['ticketId'] || '');
      const ticket = await OperationsController.supportService.getTicket(ticketId, adminId, reason);
      ApiResponse.success(res, ticket, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Update Support Ticket
  public static async adminUpdateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const reason = req.body?.reason ? String(req.body.reason) : 'Ticket status update';
      const ticketId = String(req.params['ticketId'] || '');
      const ticket = await OperationsController.supportService.updateTicket(
        ticketId,
        adminId,
        req.body,
        reason,
      );
      ApiResponse.success(res, ticket, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Get Support Audit Logs
  public static adminGetAuditLogs(req: Request, res: Response, next: NextFunction): void {
    try {
      const targetUserId = req.query['targetUserId'] ? String(req.query['targetUserId']) : undefined;
      const logs = OperationsController.supportService.getAuditLogs(targetUserId);
      ApiResponse.success(res, logs, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Create Beta Invite Code
  public static async adminCreateBetaInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const invite = await OperationsController.betaService.createInvitation(adminId, req.body);
      ApiResponse.success(res, invite, 201);
    } catch (err) {
      next(err);
    }
  }

  // Admin: List Beta Invitations
  public static async adminListBetaInvites(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invites = await OperationsController.betaService.listInvitations();
      ApiResponse.success(res, invites, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Declare Incident
  public static async adminDeclareIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const incident = await OperationsController.incidentService.declareIncident(adminId, req.body);
      ApiResponse.success(res, incident, 201);
    } catch (err) {
      next(err);
    }
  }

  // Admin: List Incidents
  public static async adminListIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query['status'] as any;
      const incidents = await OperationsController.incidentService.listIncidents(status);
      ApiResponse.success(res, incidents, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Update Incident
  public static async adminUpdateIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const incidentId = String(req.params['incidentId'] || '');
      const incident = await OperationsController.incidentService.updateIncident(
        incidentId,
        adminId,
        req.body,
      );
      ApiResponse.success(res, incident, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: List Operational Kill Switches
  public static adminListKillSwitches(_req: Request, res: Response, next: NextFunction): void {
    try {
      const switches = OperationsController.killSwitchService.listSwitches();
      ApiResponse.success(res, switches, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Update Operational Kill Switch
  public static adminUpdateKillSwitch(req: Request, res: Response, next: NextFunction): void {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const item = OperationsController.killSwitchService.updateSwitch(adminId, req.body);
      ApiResponse.success(res, item, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Request Two-Person Approval
  public static async adminRequestApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.id || 'admin';
      const request = await OperationsController.approvalService.createApprovalRequest(adminId, req.body);
      ApiResponse.success(res, request, 201);
    } catch (err) {
      next(err);
    }
  }

  // Admin: Review Two-Person Approval
  public static async adminReviewApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approverAdminId = (req as any).admin?.id || 'admin';
      const { decision } = req.body;
      const requestId = String(req.params['requestId'] || '');
      const request = await OperationsController.approvalService.reviewApprovalRequest(
        requestId,
        approverAdminId,
        decision,
      );
      ApiResponse.success(res, request, 200);
    } catch (err) {
      next(err);
    }
  }

  // Admin: List Pending Approvals
  public static async adminListApprovals(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await OperationsController.approvalService.listPendingRequests();
      ApiResponse.success(res, requests, 200);
    } catch (err) {
      next(err);
    }
  }
}

