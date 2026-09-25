import crypto from 'node:crypto';
import {
  TwoPersonApprovalRequestItem,
  TwoPersonApprovalCreateInput,
} from '@ai-companion/types';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export class TwoPersonApprovalService {
  private static instance: TwoPersonApprovalService;
  private requests: Map<string, TwoPersonApprovalRequestItem> = new Map();

  private constructor() {}

  public static getInstance(): TwoPersonApprovalService {
    if (!TwoPersonApprovalService.instance) {
      TwoPersonApprovalService.instance = new TwoPersonApprovalService();
    }
    return TwoPersonApprovalService.instance;
  }

  public async createApprovalRequest(
    adminId: string,
    input: TwoPersonApprovalCreateInput,
  ): Promise<TwoPersonApprovalRequestItem> {
    const id = `apr-${crypto.randomUUID().substring(0, 8)}`;
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24hr expiration

    const request: TwoPersonApprovalRequestItem = {
      id,
      action: input.action,
      status: 'PENDING',
      requestedByAdminId: adminId,
      approvedByAdminId: null,
      payload: input.payload,
      reason: input.reason.trim(),
      createdAt: new Date(now).toISOString(),
      expiresAt,
    };

    this.requests.set(id, request);
    logger.warn('[TwoPersonApprovalService] Critical action approval requested', { id, action: input.action, adminId });
    return request;
  }

  public async reviewApprovalRequest(
    requestId: string,
    approverAdminId: string,
    decision: 'APPROVE' | 'REJECT',
  ): Promise<TwoPersonApprovalRequestItem> {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new NotFoundError(`Approval request ${requestId} not found`);
    }

    if (req.status !== 'PENDING') {
      throw new ValidationError(`Request is already ${req.status.toLowerCase()}`);
    }

    if (new Date(req.expiresAt).getTime() < Date.now()) {
      req.status = 'EXPIRED';
      throw new ValidationError('Approval request has expired');
    }

    // Enforce two distinct individuals (No self-approval)
    if (req.requestedByAdminId === approverAdminId) {
      throw new ForbiddenError('Dual-control policy requires a different admin to approve this request');
    }

    req.approvedByAdminId = approverAdminId;
    req.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    this.requests.set(requestId, req);
    logger.info('[TwoPersonApprovalService] Request reviewed', { requestId, decision, approverAdminId });
    return req;
  }

  public async listPendingRequests(): Promise<TwoPersonApprovalRequestItem[]> {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
