import { Request, Response, NextFunction } from 'express';
import { MemoryCrudService } from '../services/memoryCrud.service.js';
import { UserMemorySettingsService } from '../services/userMemorySettings.service.js';
import {
  memoryListQuerySchema,
  updateMemorySchema,
  updateUserMemorySettingsSchema,
  uuidParamSchema,
} from '@ai-companion/validation';

export class MemoryController {
  public static async listMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const query = memoryListQuerySchema.parse(req.query);
      const result = await MemoryCrudService.listMemories(userId, query);

      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          hasMore: result.page * result.limit < result.total,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = uuidParamSchema.parse(req.params);
      const memory = await MemoryCrudService.getMemory(userId, id);

      res.status(200).json({
        success: true,
        data: memory,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = uuidParamSchema.parse(req.params);
      const input = updateMemorySchema.parse(req.body);
      const updated = await MemoryCrudService.updateMemory(userId, id, input);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = uuidParamSchema.parse(req.params);
      await MemoryCrudService.deleteMemory(userId, id);

      res.status(200).json({
        success: true,
        data: { message: 'Memory deleted successfully' },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async forgetAllMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await UserMemorySettingsService.forgetAllMemories(userId);

      res.status(200).json({
        success: true,
        data: {
          message: 'All user memories have been wiped successfully',
          deletedCount: result.deletedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await UserMemorySettingsService.getSettings(userId);

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = updateUserMemorySettingsSchema.parse(req.body);
      const updated = await UserMemorySettingsService.updateSettings(userId, input);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}
