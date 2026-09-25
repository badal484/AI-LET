import { Request, Response, NextFunction } from 'express';
import { HealthService } from './health.service.js';
import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker.js';
import { KillSwitchService, KillSwitchKey } from '../../infrastructure/resilience/KillSwitchService.js';
import { QueueManager } from '../../infrastructure/queues/QueueManager.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';

export class HealthController {
  public static async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await HealthService.getHealth();
      const statusCode = health.status === 'unhealthy' ? 503 : 200;
      ApiResponse.success(res, health, statusCode);
    } catch (error) {
      next(error);
    }
  }

  public static async getLiveness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const liveness = await HealthService.getLiveness();
      ApiResponse.success(res, liveness, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const readiness = await HealthService.getReadiness();
      const statusCode = readiness.status === 'ready' ? 200 : 503;
      ApiResponse.success(res, readiness, statusCode);
    } catch (error) {
      next(error);
    }
  }

  public static async getDeepDiagnostics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const diagnostics = await HealthService.getDeepDiagnostics();
      const statusCode = diagnostics.status === 'unhealthy' ? 503 : 200;
      ApiResponse.success(res, diagnostics, statusCode);
    } catch (error) {
      next(error);
    }
  }

  public static async getPrometheusMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metricsText = await HealthService.getPrometheusMetrics();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.status(200).send(metricsText);
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin Infrastructure & Resilience Controls
  // ---------------------------------------------------------------------------

  public static async getKillSwitches(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const switches = await KillSwitchService.getAllKillSwitches();
      ApiResponse.success(res, { switches }, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async updateKillSwitch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin?.adminId || 'admin';
      const { key, isEnabled, reason } = req.body;
      const updated = await KillSwitchService.setKillSwitch(
        key as KillSwitchKey,
        Boolean(isEnabled),
        adminId,
        reason,
      );
      ApiResponse.success(res, updated, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getCircuitBreakers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const breakers = CircuitBreaker.getAllStats();
      ApiResponse.success(res, { breakers }, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async resetCircuitBreakers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      CircuitBreaker.resetAll();
      ApiResponse.success(res, { reset: true }, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getDeadLetterJobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobs = QueueManager.getDeadLetterJobs();
      ApiResponse.success(res, { jobs }, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async retryDeadLetterJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params['jobId'] as string;
      const success = await QueueManager.retryDeadLetterJob(jobId);
      ApiResponse.success(res, { jobId, retried: success }, 200);
    } catch (error) {
      next(error);
    }
  }
}
