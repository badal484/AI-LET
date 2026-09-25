import type { Request, Response, NextFunction } from 'express';
import { DeveloperAuthService } from '../services/DeveloperAuthService.js';
import { OAuthService } from '../services/OAuthService.js';
import { WebhookService } from '../services/WebhookService.js';
import { DeveloperUsageMeteringService } from '../services/DeveloperUsageMeteringService.js';
import { DeveloperEmbedService } from '../services/DeveloperEmbedService.js';
import { ValidationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';

export class DeveloperConsoleController {
  private static getUserId(req: Request): string {
    const userId = req.user?.id || req.developerContext?.userId;
    if (!userId) {
      throw new PermissionDeniedError('User authentication required');
    }
    return userId;
  }

  // =========================================================================
  // PROJECTS
  // =========================================================================

  public static async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const { name, slug, organizationId, environment, allowedOrigins } = req.body;

      if (!name) {
        throw new ValidationError('Project name is required');
      }

      const project = await DeveloperAuthService.getInstance().createProject({
        userId,
        name,
        slug,
        organizationId,
        environment,
        allowedOrigins,
      });

      res.status(201).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  public static async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projects = await DeveloperAuthService.getInstance().listProjects(userId);
      res.status(200).json({ data: projects });
    } catch (error) {
      next(error);
    }
  }

  public static async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const id = String(req.params['id'] || '');
      const project = await DeveloperAuthService.getInstance().getProject(id, userId);
      res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const id = String(req.params['id'] || '');
      await DeveloperAuthService.getInstance().deleteProject(id, userId);
      res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // API KEYS
  // =========================================================================

  public static async createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const { name, keyType, scopes, expiresInDays } = req.body;

      if (!name) {
        throw new ValidationError('API key name is required');
      }

      const keyResult = await DeveloperAuthService.getInstance().createApiKey({
        projectId,
        userId,
        name,
        keyType,
        scopes,
        expiresInDays,
      });

      res.status(201).json({ data: keyResult });
    } catch (error) {
      next(error);
    }
  }

  public static async listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const keys = await DeveloperAuthService.getInstance().listApiKeys(projectId, userId);
      res.status(200).json({ data: keys });
    } catch (error) {
      next(error);
    }
  }

  public static async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const keyId = String(req.params['keyId'] || '');
      await DeveloperAuthService.getInstance().revokeApiKey(keyId, projectId, userId);
      res.status(200).json({ message: 'API key revoked successfully' });
    } catch (error) {
      next(error);
    }
  }

  public static async rotateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const keyId = String(req.params['keyId'] || '');
      const { overlapHours } = req.body;

      const newKeyResult = await DeveloperAuthService.getInstance().rotateApiKey(
        keyId,
        projectId,
        userId,
        typeof overlapHours === 'number' ? overlapHours : 24
      );

      res.status(200).json({ data: newKeyResult });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // OAUTH APPS
  // =========================================================================

  public static async createOAuthApp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const { name, redirectUris, allowedScopes, isPublicClient, clientType, logoUrl, privacyPolicyUrl, termsUrl } = req.body;

      if (!name || !redirectUris || !Array.isArray(redirectUris)) {
        throw new ValidationError('Name and redirectUris array are required');
      }

      const app = await OAuthService.getInstance().createOAuthApplication({
        projectId,
        userId,
        name,
        redirectUris,
        allowedScopes,
        isPublicClient,
        clientType,
        logoUrl,
        privacyPolicyUrl,
        termsUrl,
      });

      res.status(201).json({ data: app });
    } catch (error) {
      next(error);
    }
  }

  public static async listOAuthApps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const apps = await OAuthService.getInstance().listOAuthApplications(projectId, userId);
      res.status(200).json({ data: apps });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // WEBHOOKS
  // =========================================================================

  public static async createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const { url, eventTypes, description } = req.body;

      if (!url || !eventTypes || !Array.isArray(eventTypes)) {
        throw new ValidationError('url and eventTypes array are required');
      }

      const endpoint = await WebhookService.getInstance().createWebhookEndpoint({
        projectId,
        userId,
        url,
        eventTypes,
        description,
      });

      res.status(201).json({ data: endpoint });
    } catch (error) {
      next(error);
    }
  }

  public static async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const endpoints = await WebhookService.getInstance().listWebhookEndpoints(projectId, userId);
      res.status(200).json({ data: endpoints });
    } catch (error) {
      next(error);
    }
  }

  public static async updateWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const endpointId = String(req.params['endpointId'] || '');
      const { url, eventTypes, active, description } = req.body;

      const endpoint = await WebhookService.getInstance().updateWebhookEndpoint(
        endpointId,
        projectId,
        userId,
        { url, eventTypes, active, description }
      );

      res.status(200).json({ data: endpoint });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const endpointId = String(req.params['endpointId'] || '');
      await WebhookService.getInstance().deleteWebhookEndpoint(endpointId, projectId, userId);
      res.status(200).json({ message: 'Webhook endpoint deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  public static async pingWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const endpointId = String(req.params['endpointId'] || '');

      const delivery = await WebhookService.getInstance().sendTestPingEvent(endpointId, projectId, userId);
      res.status(200).json({ data: delivery, message: 'Test ping webhook dispatched' });
    } catch (error) {
      next(error);
    }
  }

  public static async listDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const endpointId = req.query['endpointId'] as string | undefined;
      const status = req.query['status'] as string | undefined;
      const limitStr = req.query['limit'] as string | undefined;
      const after = req.query['after'] as string | undefined;

      const result = await WebhookService.getInstance().listDeliveries(
        projectId,
        userId,
        endpointId,
        status,
        limitStr ? parseInt(limitStr, 10) : 50,
        after
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async replayDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const deliveryId = String(req.params['deliveryId'] || '');

      const newDelivery = await WebhookService.getInstance().replayDelivery(deliveryId, projectId, userId);
      res.status(200).json({ data: newDelivery, message: 'Delivery replayed successfully' });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // USAGE & BUDGET
  // =========================================================================

  public static async getUsageSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const daysStr = req.query['days'] as string | undefined;
      const days = daysStr ? parseInt(daysStr, 10) : 30;

      // Verify ownership
      await DeveloperAuthService.getInstance().getProject(projectId, userId);

      const summary = await DeveloperUsageMeteringService.getInstance().getUsageSummary(projectId, days);
      res.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  }

  public static async getUsageRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const limitStr = req.query['limit'] as string | undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const after = req.query['after'] as string | undefined;

      await DeveloperAuthService.getInstance().getProject(projectId, userId);

      const records = await DeveloperUsageMeteringService.getInstance().getUsageRecords(projectId, limit, after);
      res.status(200).json(records);
    } catch (error) {
      next(error);
    }
  }

  public static async getBudgetStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');

      await DeveloperAuthService.getInstance().getProject(projectId, userId);

      const budget = await DeveloperUsageMeteringService.getInstance().getBudgetStatus(projectId);
      res.status(200).json({ data: budget });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // EMBEDS
  // =========================================================================

  public static async upsertEmbed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const { characterId, originAllowlist, theme, features } = req.body;

      if (!characterId || !originAllowlist) {
        throw new ValidationError('characterId and originAllowlist are required');
      }

      const config = await DeveloperEmbedService.getInstance().upsertEmbedConfig({
        projectId,
        userId,
        characterId: String(characterId),
        originAllowlist,
        theme,
        features,
      });

      res.status(200).json({ data: config });
    } catch (error) {
      next(error);
    }
  }

  public static async getEmbed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const characterId = String(req.params['characterId'] || '');

      await DeveloperAuthService.getInstance().getProject(projectId, userId);

      const config = await DeveloperEmbedService.getInstance().getEmbedConfig(projectId, characterId);
      res.status(200).json({ data: config });
    } catch (error) {
      next(error);
    }
  }

  public static async createEmbedSessionToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = DeveloperConsoleController.getUserId(req);
      const projectId = String(req.params['id'] || '');
      const characterId = String(req.params['characterId'] || '');
      const { origin, capabilities } = req.body;

      if (!origin) {
        throw new ValidationError('origin is required');
      }

      await DeveloperAuthService.getInstance().getProject(projectId, userId);

      const session = await DeveloperEmbedService.getInstance().createEphemeralSessionToken(
        projectId,
        characterId,
        String(origin),
        capabilities
      );

      res.status(200).json({ data: session });
    } catch (error) {
      next(error);
    }
  }
}
