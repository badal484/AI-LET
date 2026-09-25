import { prisma } from '../../../infrastructure/database/prisma.js';

export class BillingAuditService {
  /**
   * Record an immutable audit log entry for a financial or billing mutation.
   */
  public static async logAction(params: {
    actorType?: 'ADMIN' | 'SYSTEM' | 'USER';
    adminUserId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    reason?: string | null;
    requestId?: string | null;
    ipAddress?: string | null;
  }) {
    return await prisma.billingAuditLog.create({
      data: {
        actorType: params.actorType || (params.adminUserId ? 'ADMIN' : 'SYSTEM'),
        adminUserId: params.adminUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        beforeState: params.beforeState as any,
        afterState: params.afterState as any,
        reason: params.reason,
        requestId: params.requestId,
        ipAddress: params.ipAddress,
      },
    });
  }

  /**
   * Admin: List audit logs with pagination and filters.
   */
  public static async listAuditLogsAdmin(limit: number = 50) {
    return await prisma.billingAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
