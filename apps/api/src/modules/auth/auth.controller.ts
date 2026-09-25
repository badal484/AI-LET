import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.register(req.body, ip, userAgent);
      ApiResponse.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.login(req.body, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { refreshToken } = req.body;
      const result = await AuthService.refresh(refreshToken, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      const allDevices = req.body.allDevices === true;
      const result = await AuthService.logout(userId, req.user?.sessionId, allDevices, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      const result = await AuthService.logout(userId, undefined, true, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          devices: {
            where: { revokedAt: null },
            orderBy: { lastSeenAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!user) {
        throw new AppError('User account not found', 404, ErrorCode.NOT_FOUND);
      }

      const responseData = {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt,
        profile: user.profile,
        activeDevicesCount: user.devices.length,
      };

      ApiResponse.success(res, responseData, 200);
    } catch (err) {
      next(err);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.verifyEmail(req.body.token, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.forgotPassword(req.body.email, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.resetPassword(req.body, ip, userAgent);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      const sessions = await prisma.session.findMany({
        where: { userId, revokedAt: null },
        include: { device: true },
        orderBy: { lastUsedAt: 'desc' },
      });

      const mappedSessions = sessions.map(s => ({
        id: s.id,
        isCurrent: s.id === req.user?.sessionId,
        device: s.device
          ? {
              id: s.device.id,
              platform: s.device.platform,
              deviceName: s.device.deviceName,
              appVersion: s.device.appVersion,
            }
          : null,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));

      ApiResponse.success(res, { sessions: mappedSessions }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const sessionId = req.params['sessionId'] as string;

      if (!userId) {
        throw new AppError('Unauthorized', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId },
      });

      if (!session) {
        throw new AppError('Session not found', 404, ErrorCode.NOT_FOUND);
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokeReason: 'USER_MANUAL_REVOKE',
        },
      });

      ApiResponse.success(res, { message: 'Session revoked successfully' }, 200);
    } catch (err) {
      next(err);
    }
  }
}
