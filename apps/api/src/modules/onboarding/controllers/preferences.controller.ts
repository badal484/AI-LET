import type { Request, Response, NextFunction } from 'express';
import { UserPreferenceService } from '../services/UserPreferenceService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { userPreferenceUpdateSchema } from '@ai-companion/validation';

export class PreferencesController {
  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const prefs = await UserPreferenceService.getEffectivePreferences(userId);
      ApiResponse.success(res, prefs);
    } catch (err) {
      next(err);
    }
  }

  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const validated = userPreferenceUpdateSchema.parse(req.body);
      const updated = await UserPreferenceService.updatePreferences(userId, validated);
      ApiResponse.success(res, updated);
    } catch (err) {
      next(err);
    }
  }

  public static async resetPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const reset = await UserPreferenceService.resetPreferences(userId);
      ApiResponse.success(res, reset);
    } catch (err) {
      next(err);
    }
  }
}
