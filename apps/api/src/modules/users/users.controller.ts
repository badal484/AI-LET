import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class UsersController {
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      const profile = await UsersService.getProfile(userId);
      ApiResponse.success(res, profile, 200);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      const updated = await UsersService.updateProfile(userId, req.body);
      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      const devices = await UsersService.getDevices(userId);
      ApiResponse.success(res, { devices }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      const device = await UsersService.registerDevice(userId, req.body);
      ApiResponse.success(res, device, 201);
    } catch (err) {
      next(err);
    }
  }

  static async revokeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const deviceId = req.params['deviceId'] as string;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      if (!deviceId) throw new AppError('Device ID required', 400, ErrorCode.VALIDATION_ERROR);
      const result = await UsersService.revokeDevice(userId, deviceId);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      const { reason } = req.body;
      const result = await UsersService.deleteAccount(userId, reason);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}
