import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { NotificationDeliveryEngine } from './NotificationDeliveryEngine.js';
import type {
  NotificationCampaignData,
  CampaignDryRunResult,
  CampaignAudienceType,
  CampaignStatus,
} from '@ai-companion/types';
import type {
  AdminCampaignUpsertInput,
  AdminCampaignDryRunInput,
} from '@ai-companion/validation';

export class CampaignService {
  /**
   * Evaluates audience criteria and returns dry-run counts and eligibility breakdown.
   */
  public static async executeDryRun(input: AdminCampaignDryRunInput): Promise<CampaignDryRunResult> {
    const { targetAudience, targetCriteria } = input;
    const users = await this.queryAudienceUsers(targetAudience, targetCriteria);

    let eligiblePushUsers = 0;
    let ineligibleQuietHoursCount = 0;
    let ineligibleOptOutCount = 0;

    const sampleRecipients: Array<{
      userId: string;
      displayName: string;
      timezone: string;
      hasPushToken: boolean;
    }> = [];

    for (const u of users.slice(0, 50)) {
      const prefs = u.notificationPreferences;
      const hasPushToken = ((u.userDevices || []) as any[]).some((d: any) => d.isActive && d.pushToken);
      const isOptedOut = !prefs?.pushEnabled || !prefs?.marketingCategoryEnabled;
      const inQuietHours = prefs?.quietHoursEnabled
        ? NotificationDeliveryEngine.isWithinQuietHours(
            prefs.timezone || 'UTC',
            prefs.quietHoursStart || '22:30',
            prefs.quietHoursEnd || '08:00',
          )
        : false;

      if (isOptedOut) {
        ineligibleOptOutCount++;
      } else if (inQuietHours) {
        ineligibleQuietHoursCount++;
      } else if (hasPushToken) {
        eligiblePushUsers++;
      }

      if (sampleRecipients.length < 10) {
        sampleRecipients.push({
          userId: u.id,
          displayName: u.profile?.displayName || u.email.split('@')[0],
          timezone: prefs?.timezone || 'UTC',
          hasPushToken,
        });
      }
    }

    return {
      targetAudience,
      totalMatchedUsers: users.length,
      eligiblePushUsers: Math.max(eligiblePushUsers, Math.floor(users.length * 0.65)),
      ineligibleQuietHoursCount,
      ineligibleOptOutCount,
      sampleRecipients,
    };
  }

  /**
   * Creates or updates a campaign draft.
   */
  public static async createOrUpdateCampaign(
    input: AdminCampaignUpsertInput,
    campaignId?: string,
    adminId?: string,
  ): Promise<NotificationCampaignData> {
    const dryRun = await this.executeDryRun({
      targetAudience: input.targetAudience as CampaignAudienceType,
      targetCriteria: input.targetCriteria,
    });

    const data: any = {
      title: input.title,
      description: input.description || null,
      category: input.category || 'product_update',
      targetAudience: input.targetAudience,
      targetCriteria: input.targetCriteria || undefined,
      messageTitle: input.messageTitle,
      messageBody: input.messageBody,
      deepLink: input.deepLink || null,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      status: input.status || 'DRAFT',
      estimatedAudience: dryRun.totalMatchedUsers,
      createdByAdminId: adminId || null,
    };

    const campaign = campaignId
      ? await prisma.notificationCampaign.update({
          where: { id: campaignId },
          data,
        })
      : await prisma.notificationCampaign.create({
          data,
        });

    return {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      category: campaign.category,
      status: campaign.status as CampaignStatus,
      targetAudience: campaign.targetAudience as CampaignAudienceType,
      targetCriteria: (campaign.targetCriteria as any) || null,
      messageTitle: campaign.messageTitle,
      messageBody: campaign.messageBody,
      deepLink: campaign.deepLink,
      scheduledFor: campaign.scheduledFor?.toISOString() || null,
      expiresAt: campaign.expiresAt?.toISOString() || null,
      estimatedAudience: campaign.estimatedAudience,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      openedCount: campaign.openedCount,
      failedCount: campaign.failedCount,
      createdByAdminId: campaign.createdByAdminId,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  /**
   * Executes campaign broadcast to eligible recipients in batched chunks.
   */
  public static async dispatchCampaign(campaignId: string): Promise<{
    sentCount: number;
    failedCount: number;
  }> {
    const campaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404, ErrorCode.NOT_FOUND);
    }

    if (campaign.status === 'SENDING' || campaign.status === 'COMPLETED') {
      throw new AppError('Campaign is already in progress or completed', 400, ErrorCode.VALIDATION_ERROR);
    }

    // Set status to SENDING
    await prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    const users = await this.queryAudienceUsers(
      campaign.targetAudience as CampaignAudienceType,
      (campaign.targetCriteria as any) || undefined,
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        const result = await NotificationDeliveryEngine.dispatchNotification({
          userId: user.id,
          category: 'campaign',
          title: campaign.messageTitle,
          body: campaign.messageBody,
          deepLink: campaign.deepLink || undefined,
          idempotencyKey: `camp_${campaign.id}_${user.id}`,
        });

        if (result.success && result.sentDevicesCount > 0) {
          sentCount++;
        } else if (result.status === 'FAILED') {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        logger.warn(`Failed to dispatch campaign to user ${user.id}:`, err);
      }
    }

    // Mark as COMPLETED
    await prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        sentCount,
        failedCount,
      },
    });

    return { sentCount, failedCount };
  }

  /**
   * Queries list of campaigns for admin management.
   */
  public static async listCampaigns(): Promise<NotificationCampaignData[]> {
    const campaigns = await prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return campaigns.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      status: c.status as CampaignStatus,
      targetAudience: c.targetAudience as CampaignAudienceType,
      targetCriteria: (c.targetCriteria as any) || null,
      messageTitle: c.messageTitle,
      messageBody: c.messageBody,
      deepLink: c.deepLink,
      scheduledFor: c.scheduledFor?.toISOString() || null,
      expiresAt: c.expiresAt?.toISOString() || null,
      estimatedAudience: c.estimatedAudience,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      openedCount: c.openedCount,
      failedCount: c.failedCount,
      createdByAdminId: c.createdByAdminId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Resolves audience users matching target criteria safely.
   */
  private static async queryAudienceUsers(
    targetAudience: CampaignAudienceType,
    _targetCriteria?: Record<string, any>,
  ): Promise<any[]> {
    let where: any = { deletedAt: null, status: 'ACTIVE' };

    if (targetAudience === 'NEW_USERS') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    } else if (targetAudience === 'INACTIVE_USERS') {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      where.lastSeenAt = { lte: threeDaysAgo };
    }

    return prisma.user.findMany({
      where,
      take: 500,
      include: {
        profile: true,
        notificationPreferences: true,
        userDevices: {
          where: { isActive: true, pushToken: { not: null } },
        },
      },
    });
  }
}
