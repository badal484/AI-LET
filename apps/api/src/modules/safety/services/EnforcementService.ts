import { prisma } from '../../../infrastructure/database/prisma.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { AuditService } from '../../audit/audit.service.js';
import type {
  AccountRestrictionType,
  UserRestrictionItem,
  AccountRestrictionCreateInput,
} from '@ai-companion/types';

export class EnforcementService {
  /**
   * Checks whether a user currently has an active restriction matching the required action.
   */
  public static async isUserRestricted(
    userId: string,
    restrictionType: AccountRestrictionType,
  ): Promise<boolean> {
    const now = new Date();
    const activeRestriction = await prisma.userRestriction.findFirst({
      where: {
        userId,
        isActive: true,
        restrictionType: {
          in: [restrictionType, 'ACCOUNT_BANNED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_RESTRICTED'],
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });

    return !!activeRestriction;
  }

  /**
   * Asserts that a user does not have an active restriction, otherwise throwing ForbiddenError.
   */
  public static async assertUserNotRestricted(
    userId: string,
    restrictionType: AccountRestrictionType,
  ): Promise<void> {
    const isRestricted = await this.isUserRestricted(userId, restrictionType);
    if (isRestricted) {
      throw new ForbiddenError(
        `Action blocked due to active account restriction: ${restrictionType}`,
        ErrorCode.ACCOUNT_SUSPENDED,
      );
    }
  }

  /**
   * Issues a new granular or global account restriction.
   */
  public static async issueRestriction(
    adminId: string,
    input: AccountRestrictionCreateInput,
  ): Promise<UserRestrictionItem> {
    const restriction = await prisma.userRestriction.create({
      data: {
        userId: input.userId,
        restrictionType: input.restrictionType,
        reason: input.reason,
        issuedByAdminId: adminId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: (input.metadata as unknown as any) || undefined,
      },
    });

    await AuditService.log({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'ACCOUNT_RESTRICTION_ISSUED',
      resourceType: 'user',
      resourceId: input.userId,
      metadata: {
        restrictionType: input.restrictionType,
        reason: input.reason,
        expiresAt: input.expiresAt,
      },
    });

    return {
      id: restriction.id,
      userId: restriction.userId,
      restrictionType: restriction.restrictionType,
      reason: restriction.reason,
      issuedByAdminId: restriction.issuedByAdminId,
      expiresAt: restriction.expiresAt?.toISOString() || null,
      isActive: restriction.isActive,
      revokedAt: restriction.revokedAt?.toISOString() || null,
      createdAt: restriction.createdAt.toISOString(),
    };
  }

  /**
   * Revokes an existing restriction.
   */
  public static async revokeRestriction(
    adminId: string,
    restrictionId: string,
    reason: string,
  ): Promise<UserRestrictionItem> {
    const updated = await prisma.userRestriction.update({
      where: { id: restrictionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        metadata: { revocationReason: reason, revokedByAdminId: adminId },
      },
    });

    await AuditService.log({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'ACCOUNT_RESTRICTION_REVOKED',
      resourceType: 'user',
      resourceId: updated.userId,
      metadata: { restrictionId, reason },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      restrictionType: updated.restrictionType,
      reason: updated.reason,
      issuedByAdminId: updated.issuedByAdminId,
      expiresAt: updated.expiresAt?.toISOString() || null,
      isActive: updated.isActive,
      revokedAt: updated.revokedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Lists active restrictions for a user.
   */
  public static async getActiveRestrictions(userId: string): Promise<UserRestrictionItem[]> {
    const now = new Date();
    const list = await prisma.userRestriction.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(r => ({
      id: r.id,
      userId: r.userId,
      restrictionType: r.restrictionType,
      reason: r.reason,
      issuedByAdminId: r.issuedByAdminId,
      expiresAt: r.expiresAt?.toISOString() || null,
      isActive: r.isActive,
      revokedAt: r.revokedAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
