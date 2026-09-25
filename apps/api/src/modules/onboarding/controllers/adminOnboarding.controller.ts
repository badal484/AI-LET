import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { ActivationFunnelService } from '../services/ActivationFunnelService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { adminOnboardingStepConfigSchema } from '@ai-companion/validation';
import { AuditService } from '../../audit/audit.service.js';

export class AdminOnboardingController {
  public static async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await ActivationFunnelService.getGrowthAnalytics();
      ApiResponse.success(res, analytics);
    } catch (err) {
      next(err);
    }
  }

  public static async listStepConfigs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await prisma.onboardingStepConfig.findMany({
        orderBy: { displayOrder: 'asc' },
      });
      ApiResponse.success(res, configs);
    } catch (err) {
      next(err);
    }
  }

  public static async upsertStepConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).adminUser?.id || req.user?.userId || 'system';
      const validated = adminOnboardingStepConfigSchema.parse(req.body);

      const config = await prisma.onboardingStepConfig.upsert({
        where: { stepKey: validated.stepKey },
        create: {
          stepKey: validated.stepKey,
          title: validated.title,
          subtitle: validated.subtitle,
          isRequired: validated.isRequired,
          displayOrder: validated.displayOrder,
          version: validated.version,
          configData: validated.configData as any,
          isEnabled: validated.isEnabled,
        },
        update: {
          title: validated.title,
          subtitle: validated.subtitle,
          isRequired: validated.isRequired,
          displayOrder: validated.displayOrder,
          version: validated.version,
          configData: validated.configData as any,
          isEnabled: validated.isEnabled,
        },
      });

      await AuditService.logEvent({
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'ONBOARDING_CONFIG_UPSERTED',
        resourceType: 'OnboardingStepConfig',
        resourceId: config.id,
        metadata: { stepKey: config.stepKey },
      });

      ApiResponse.success(res, config);
    } catch (err) {
      next(err);
    }
  }
}
