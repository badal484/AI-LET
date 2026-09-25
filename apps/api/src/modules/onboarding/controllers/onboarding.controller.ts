import type { Request, Response, NextFunction } from 'express';
import { OnboardingService } from '../services/OnboardingService.js';
import { ActivationFunnelService } from '../services/ActivationFunnelService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import {
  onboardingStepCompleteSchema,
  onboardingCompleteSchema,
  activationFunnelEventSchema,
} from '@ai-companion/validation';

export class OnboardingController {
  public static async getState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const state = await OnboardingService.getOnboardingState(userId);
      ApiResponse.success(res, state);
    } catch (err) {
      next(err);
    }
  }

  public static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const progress = await OnboardingService.startOnboarding(userId);
      ApiResponse.success(res, progress);
    } catch (err) {
      next(err);
    }
  }

  public static async completeStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const validated = onboardingStepCompleteSchema.parse(req.body);
      const result = await OnboardingService.completeStep(userId, validated);
      ApiResponse.success(res, result);
    } catch (err) {
      next(err);
    }
  }

  public static async skip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const progress = await OnboardingService.skipOnboarding(userId);
      ApiResponse.success(res, progress);
    } catch (err) {
      next(err);
    }
  }

  public static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const validated = onboardingCompleteSchema.parse(req.body);
      const result = await OnboardingService.completeOnboarding(userId, validated);
      ApiResponse.success(res, result);
    } catch (err) {
      next(err);
    }
  }

  public static async getStarters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const starters = await OnboardingService.getStarterCharacters(userId);
      ApiResponse.success(res, starters);
    } catch (err) {
      next(err);
    }
  }

  public static async trackEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const validated = activationFunnelEventSchema.parse(req.body);
      await ActivationFunnelService.trackFunnelEvent(validated, userId, req.body.anonymousId);
      ApiResponse.success(res, { recorded: true });
    } catch (err) {
      next(err);
    }
  }
}
