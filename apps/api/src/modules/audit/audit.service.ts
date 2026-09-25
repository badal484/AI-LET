import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../config/logger.js';
import { Prisma } from '@prisma/client';

export interface CreateAuditLogParams {
  actorType: 'USER' | 'ADMIN' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Records an append-only security audit event.
   */
  static async logEvent(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorType: params.actorType,
          actorId: params.actorId || undefined,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || undefined,
          metadata: (params.metadata || undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: params.ipAddress || undefined,
          userAgent: params.userAgent || undefined,
        },
      });
    } catch (err) {
      // Audit log failures should not crash user requests, but must be logged with high severity
      logger.error('Failed to write audit log entry', {
        error: err instanceof Error ? err.message : err,
        params: { ...params, metadata: '[REDACTED]' },
      });
    }
  }

  /**
   * Alias for logEvent
   */
  static async log(params: CreateAuditLogParams): Promise<void> {
    return this.logEvent(params);
  }

  /**
   * Retrieves paginated audit logs for privileged administrators.
   */
  static async getAuditLogs(params: {
    page?: number;
    limit?: number;
    actorType?: string;
    actorId?: string;
    resourceType?: string;
    action?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (params.actorType) where.actorType = params.actorType;
    if (params.actorId) where.actorId = params.actorId;
    if (params.resourceType) where.resourceType = params.resourceType;
    if (params.action) where.action = params.action;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    };
  }
}
