import type { Request, Response, NextFunction } from 'express';
import { BootstrapService } from '../services/BootstrapService.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class BootstrapController {
  public static async getBootstrap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await BootstrapService.getBootstrapData(userId);
      ApiResponse.success(res, data);
    } catch (err) {
      next(err);
    }
  }
}
