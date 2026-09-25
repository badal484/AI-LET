import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from './adminAuth.service.js';
import { AdminUsersService } from './adminUsers.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { UserStatus } from '@prisma/client';

export class AdminController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AdminAuthService.login(req.body, ip, userAgent);

      // Set secure HttpOnly cookie for web admin console
      res.cookie('admin_session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId;
      if (!adminId) throw new AppError('Unauthorized', 401, ErrorCode.ADMIN_UNAUTHORIZED);

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AdminAuthService.logout(adminId, req.admin?.sessionId, ip, userAgent);

      res.clearCookie('admin_session_token');
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin) throw new AppError('Unauthorized', 401, ErrorCode.ADMIN_UNAUTHORIZED);
      ApiResponse.success(res, { admin: req.admin }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query;
      const result = await AdminUsersService.listUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status ? (status as UserStatus) : undefined,
        search: search as string | undefined,
      });
      ApiResponse.success(res, result.items, 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params['userId'] as string;
      if (!userId) throw new AppError('User ID required', 400, ErrorCode.VALIDATION_ERROR);
      const user = await AdminUsersService.getUserDetails(userId);
      ApiResponse.success(res, user, 200);
    } catch (err) {
      next(err);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId;
      if (!adminId) throw new AppError('Unauthorized', 401, ErrorCode.ADMIN_UNAUTHORIZED);

      const userId = req.params['userId'] as string;
      const { status, reason } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!userId) throw new AppError('User ID required', 400, ErrorCode.VALIDATION_ERROR);

      const result = await AdminUsersService.updateUserStatus(
        userId,
        status,
        reason,
        adminId,
        ip,
        userAgent,
      );
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin) throw new AppError('Unauthorized', 401, ErrorCode.ADMIN_UNAUTHORIZED);

      const { targetAdminId, roleName } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AdminUsersService.assignAdminRole(
        targetAdminId,
        roleName,
        req.admin,
        ip,
        userAgent,
      );
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, actorType, actorId, resourceType, action } = req.query;
      const result = await AuditService.getAuditLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        actorType: actorType as string | undefined,
        actorId: actorId as string | undefined,
        resourceType: resourceType as string | undefined,
        action: action as string | undefined,
      });

      ApiResponse.success(res, result.items, 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (err) {
      next(err);
    }
  }
}
