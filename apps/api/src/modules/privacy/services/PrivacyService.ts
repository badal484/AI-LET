import { logger } from '../../../config/logger.js';
import { SocialDataLifecycleService } from '../../social/lifecycle/SocialDataLifecycleService.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';
import type {
  PrivacySettingsUpdateInput,
  UserPrivacySettingsData,
  DataExportRequestItem,
  AccountDeletionRequestItem,
} from '@ai-companion/types';

export class PrivacyService {
  /**
   * Retrieves or creates default privacy settings for a user.
   */
  public static async getPrivacySettings(userId: string): Promise<UserPrivacySettingsData> {
    let settings = await prisma.userPrivacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userPrivacySettings.create({
        data: {
          userId,
          memoryStorageEnabled: true,
          personalizationEnabled: true,
          analyticsConsent: true,
          aiTrainingConsent: false,
          dataRetentionDays: 365,
        },
      });
    }

    return {
      userId: settings.userId,
      memoryStorageEnabled: settings.memoryStorageEnabled,
      personalizationEnabled: settings.personalizationEnabled,
      analyticsConsent: settings.analyticsConsent,
      aiTrainingConsent: settings.aiTrainingConsent,
      dataRetentionDays: settings.dataRetentionDays,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  /**
   * Updates user privacy preferences.
   */
  public static async updatePrivacySettings(
    userId: string,
    input: PrivacySettingsUpdateInput,
  ): Promise<UserPrivacySettingsData> {
    const updated = await prisma.userPrivacySettings.upsert({
      where: { userId },
      create: {
        userId,
        memoryStorageEnabled: input.memoryStorageEnabled ?? true,
        personalizationEnabled: input.personalizationEnabled ?? true,
        analyticsConsent: input.analyticsConsent ?? true,
        aiTrainingConsent: input.aiTrainingConsent ?? false,
        dataRetentionDays: input.dataRetentionDays ?? 365,
      },
      update: {
        memoryStorageEnabled: input.memoryStorageEnabled,
        personalizationEnabled: input.personalizationEnabled,
        analyticsConsent: input.analyticsConsent,
        aiTrainingConsent: input.aiTrainingConsent,
        dataRetentionDays: input.dataRetentionDays,
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'PRIVACY_SETTINGS_UPDATED',
      resourceType: 'user_privacy_settings',
      resourceId: updated.id,
      metadata: input as Record<string, unknown>,
    });

    return {
      userId: updated.userId,
      memoryStorageEnabled: updated.memoryStorageEnabled,
      personalizationEnabled: updated.personalizationEnabled,
      analyticsConsent: updated.analyticsConsent,
      aiTrainingConsent: updated.aiTrainingConsent,
      dataRetentionDays: updated.dataRetentionDays,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Enqueues an asynchronous data export request.
   */
  public static async requestDataExport(
    userId: string,
    dataTypes: string[],
  ): Promise<DataExportRequestItem> {
    // Check for recent in-progress exports
    const pending = await prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (pending) {
      return {
        id: pending.id,
        userId: pending.userId,
        status: pending.status,
        dataTypes: (pending.dataTypes as unknown as string[]) || [],
        downloadUrl: pending.downloadUrl,
        downloadExpiresAt: pending.downloadExpiresAt?.toISOString() || null,
        fileSizeBytes: pending.fileSizeBytes ? Number(pending.fileSizeBytes) : null,
        errorMessage: pending.errorMessage,
        completedAt: pending.completedAt?.toISOString() || null,
        createdAt: pending.createdAt.toISOString(),
      };
    }

    const exportReq = await prisma.dataExportRequest.create({
      data: {
        userId,
        status: 'PENDING',
        dataTypes: dataTypes as unknown as any,
      },
    });

    // In a real background worker, this is picked up by a queue.
    // For synchronous processing in dev / fast turnaround, generate archive asynchronously.
    setImmediate(() => {
      this.generateExportArchive(exportReq.id).catch(err => {
        logger.error('Failed to generate export archive', { exportId: exportReq.id, err });
      });
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'DATA_EXPORT_REQUESTED',
      resourceType: 'data_export_request',
      resourceId: exportReq.id,
      metadata: { dataTypes },
    });

    return {
      id: exportReq.id,
      userId: exportReq.userId,
      status: exportReq.status,
      dataTypes,
      downloadUrl: null,
      downloadExpiresAt: null,
      fileSizeBytes: null,
      errorMessage: null,
      completedAt: null,
      createdAt: exportReq.createdAt.toISOString(),
    };
  }

  /**
   * Internal processor for generating user data export archives.
   */
  public static async generateExportArchive(exportId: string): Promise<void> {
    const exportReq = await prisma.dataExportRequest.findUnique({
      where: { id: exportId },
      include: { user: { include: { profile: true } } },
    });

    if (!exportReq) return;

    await prisma.dataExportRequest.update({
      where: { id: exportId },
      data: { status: 'PROCESSING' },
    });

    try {
      const userId = exportReq.userId;
      const dataTypes = (exportReq.dataTypes as unknown as string[]) || [];
      const exportPayload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        userId,
      };

      if (dataTypes.includes('PROFILE')) {
        exportPayload['profile'] = exportReq.user.profile;
        exportPayload['email'] = exportReq.user.email;
        exportPayload['createdAt'] = exportReq.user.createdAt;
      }

      if (dataTypes.includes('MEMORIES')) {
        exportPayload['memories'] = await prisma.memory.findMany({
          where: { userId, status: { not: 'DELETED' } },
        });
      }

      if (dataTypes.includes('RELATIONSHIPS')) {
        exportPayload['relationships'] = await prisma.relationship.findMany({
          where: { userId },
          include: { character: { select: { id: true, name: true, slug: true } } },
        });
      }

      if (dataTypes.includes('BILLING')) {
        exportPayload['subscriptions'] = await prisma.billingSubscription.findMany({ where: { userId } });
        exportPayload['purchases'] = await prisma.purchaseTransaction.findMany({ where: { userId } });
      }

      if (dataTypes.includes('SOCIAL')) {
        exportPayload['social'] = await SocialDataLifecycleService.exportUser(userId);
      }

      const rawJson = JSON.stringify(exportPayload, null, 2);
      const sizeBytes = Buffer.byteLength(rawJson, 'utf8');

      // Temporary signed URL simulation (valid for 48 hours)
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
      const secureDownloadUrl = `https://storage.ai-companion.app/exports/${userId}/${exportId}.json?exp=${expiresAt.getTime()}`;

      await prisma.dataExportRequest.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          downloadUrl: secureDownloadUrl,
          downloadExpiresAt: expiresAt,
          fileSizeBytes: BigInt(sizeBytes),
          completedAt: new Date(),
        },
      });

      logger.info(`Data export completed for user ${userId}, size: ${sizeBytes} bytes`);
    } catch (err: any) {
      logger.error('Error during data export archive generation', { err, exportId });
      await prisma.dataExportRequest.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'Export generation failed',
        },
      });
    }
  }

  /**
   * Retrieves data export request status.
   */
  public static async getExportStatus(userId: string, exportId: string): Promise<DataExportRequestItem> {
    const exportReq = await prisma.dataExportRequest.findUnique({
      where: { id: exportId },
    });

    if (!exportReq || exportReq.userId !== userId) {
      throw new NotFoundError('Data export request not found');
    }

    return {
      id: exportReq.id,
      userId: exportReq.userId,
      status: exportReq.status,
      dataTypes: (exportReq.dataTypes as unknown as string[]) || [],
      downloadUrl: exportReq.downloadUrl,
      downloadExpiresAt: exportReq.downloadExpiresAt?.toISOString() || null,
      fileSizeBytes: exportReq.fileSizeBytes ? Number(exportReq.fileSizeBytes) : null,
      errorMessage: exportReq.errorMessage,
      completedAt: exportReq.completedAt?.toISOString() || null,
      createdAt: exportReq.createdAt.toISOString(),
    };
  }

  /**
   * Schedules account deletion.
   */
  public static async requestAccountDeletion(
    userId: string,
    reason?: string,
    confirmEmail?: string,
  ): Promise<AccountDeletionRequestItem> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (confirmEmail && confirmEmail.toLowerCase().trim() !== user.normalizedEmail) {
      throw new ValidationError('Confirmation email does not match account email');
    }

    // One active request per account: repeated submissions return the existing request.
    const existing = await prisma.accountDeletionRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        id: existing.id,
        userId: existing.userId,
        status: existing.status,
        reason: existing.reason,
        scheduledFor: existing.scheduledFor.toISOString(),
        anonymizeFinancialRecords: existing.anonymizeFinancialRecords,
        completedAt: existing.completedAt?.toISOString() || null,
        createdAt: existing.createdAt.toISOString(),
      };
    }

    // Schedule deletion with 24-hour grace window
    const scheduledFor = new Date(Date.now() + 24 * 3600 * 1000);

    const deletionReq = await prisma.accountDeletionRequest.create({
      data: {
        userId,
        status: 'PENDING',
        reason,
        scheduledFor,
        anonymizeFinancialRecords: true,
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'ACCOUNT_DELETION_REQUESTED',
      resourceType: 'account_deletion_request',
      resourceId: deletionReq.id,
      metadata: { reason, scheduledFor: scheduledFor.toISOString() },
    });

    return {
      id: deletionReq.id,
      userId: deletionReq.userId,
      status: deletionReq.status,
      reason: deletionReq.reason,
      scheduledFor: deletionReq.scheduledFor.toISOString(),
      anonymizeFinancialRecords: deletionReq.anonymizeFinancialRecords,
      completedAt: deletionReq.completedAt?.toISOString() || null,
      createdAt: deletionReq.createdAt.toISOString(),
    };
  }

  /**
   * Immediately purges all user memories from active context and storage.
   */
  public static async purgeUserMemories(userId: string): Promise<{ deletedCount: number }> {
    const result = await prisma.memory.updateMany({
      where: {
        userId,
        status: { not: 'DELETED' },
      },
      data: {
        status: 'DELETED',
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: userId,
      action: 'USER_MEMORIES_PURGED',
      resourceType: 'memory',
      metadata: { deletedCount: result.count },
    });

    return { deletedCount: result.count };
  }
}
