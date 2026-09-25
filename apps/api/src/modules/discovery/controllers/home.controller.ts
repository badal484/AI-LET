import { Request, Response, NextFunction } from 'express';
import { HomeFeedService } from '../services/HomeFeedService.js';
import { homeFeedQuerySchema } from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class HomeController {
  /**
   * GET /api/v1/home
   * Unified Home feed endpoint (authenticated or guest with optional refresh).
   */
  public static async getHomeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = homeFeedQuerySchema.parse(req.query);
      const userId = req.user?.userId || (req as any).user?.id;
      const userEntitlements = (req as any).user?.entitlements || [];
      const userLocale = req.headers['accept-language'];

      const feed = await HomeFeedService.getHomeFeed(userId, {
        refresh: query.refresh,
        limit: query.limit,
        userEntitlements,
        userLocale,
      });

      ApiResponse.success(res, feed, 200);
    } catch (err) {
      next(err);
    }
  }
}
