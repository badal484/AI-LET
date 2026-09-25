import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { ModelRegistryService } from '../routing/ModelRegistry.service.js';
import { PromptRegistryService } from '../prompts/PromptRegistry.service.js';
import { AIPlaygroundService } from '../playground/AIPlayground.service.js';
import { AITelemetryService } from '../telemetry/AITelemetry.service.js';
import { CircuitBreakerService } from '../routing/CircuitBreaker.service.js';
import {
  createAIModelSchema,
  updateAIModelSchema,
  updateAIRoutingPolicySchema,
  createAIPromptSchema,
  createAIPromptVersionSchema,
  createPromptExperimentSchema,
  aiPlaygroundSchema,
  productionReplaySchema,
} from '@ai-companion/validation';

export class AdminAIController {
  private modelRegistry = ModelRegistryService.getInstance();
  private promptRegistry = PromptRegistryService.getInstance();
  private playground = AIPlaygroundService.getInstance();
  private telemetry = AITelemetryService.getInstance();
  private circuitBreaker = CircuitBreakerService.getInstance();

  public getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = req.query['days'] ? parseInt(req.query['days'] as string, 10) : 7;
      const overview = await this.telemetry.getOverviewMetrics(days);
      const modelMetrics = await this.telemetry.getModelMetrics();
      res.json({ status: 'success', data: { overview, modelMetrics } });
    } catch (err) {
      next(err);
    }
  };

  public listModels = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const models = await this.modelRegistry.getActiveModels();
      res.json({ status: 'success', data: models });
    } catch (err) {
      next(err);
    }
  };

  public createModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createAIModelSchema.parse(req.body);
      const created = await prisma.aIModel.create({
        data: {
          provider: parsed.provider,
          modelName: parsed.modelName,
          displayName: parsed.displayName,
          capabilities: parsed.capabilities,
          contextWindow: parsed.contextWindow,
          inputCostPer1k: parsed.inputCostPer1k,
          outputCostPer1k: parsed.outputCostPer1k,
          latencyClass: parsed.latencyClass,
          qualityClass: parsed.qualityClass,
          isEnabled: parsed.isEnabled,
          isDefault: parsed.isDefault,
          fallbackModelId: parsed.fallbackModelId,
        },
      });
      await this.modelRegistry.invalidateCache();
      res.status(201).json({ status: 'success', data: created });
    } catch (err) {
      next(err);
    }
  };

  public updateModel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']! as string;
      const parsed = updateAIModelSchema.parse(req.body);
      const updated = await prisma.aIModel.update({
        where: { id },
        data: parsed,
      });
      await this.modelRegistry.invalidateCache();
      res.json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };

  public listRoutingPolicies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policies = await prisma.aIRoutingPolicy.findMany({
        include: { preferredModel: true },
      });
      res.json({ status: 'success', data: policies });
    } catch (err) {
      next(err);
    }
  };

  public updateRoutingPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateAIRoutingPolicySchema.parse(req.body);
      const updated = await prisma.aIRoutingPolicy.upsert({
        where: { workload: parsed.workload },
        update: {
          preferredModelId: parsed.preferredModelId,
          fallbackModelIds: parsed.fallbackModelIds || [],
          latencySensitivity: parsed.latencySensitivity,
          maxCostPerRequest: parsed.maxCostPerRequest,
          isEnabled: parsed.isEnabled,
        },
        create: {
          workload: parsed.workload,
          preferredModelId: parsed.preferredModelId,
          fallbackModelIds: parsed.fallbackModelIds || [],
          latencySensitivity: parsed.latencySensitivity || 'MEDIUM',
          maxCostPerRequest: parsed.maxCostPerRequest,
          isEnabled: parsed.isEnabled ?? true,
        },
      });
      res.json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };

  public listPrompts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prompts = await this.promptRegistry.listPrompts();
      res.json({ status: 'success', data: prompts });
    } catch (err) {
      next(err);
    }
  };

  public createPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createAIPromptSchema.parse(req.body);
      const prompt = await prisma.aIPrompt.create({
        data: {
          name: parsed.name,
          slug: parsed.slug,
          category: parsed.category,
          description: parsed.description || '',
        },
      });
      res.status(201).json({ status: 'success', data: prompt });
    } catch (err) {
      next(err);
    }
  };

  public createPromptVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const promptId = req.params['promptId']! as string;
      const parsed = createAIPromptVersionSchema.parse(req.body);
      const version = await this.promptRegistry.createPromptVersion(
        promptId,
        parsed.templateContent,
        parsed.inputVariables || []
      );
      res.status(201).json({ status: 'success', data: version });
    } catch (err) {
      next(err);
    }
  };

  public publishPromptVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const versionId = req.params['versionId']! as string;
      const published = await this.promptRegistry.publishPromptVersion(versionId);
      res.json({ status: 'success', data: published });
    } catch (err) {
      next(err);
    }
  };

  public createPromptExperiment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createPromptExperimentSchema.parse(req.body);
      const exp = await prisma.aIPromptExperiment.create({
        data: {
          name: parsed.name,
          promptId: parsed.promptId,
          controlVersionId: parsed.controlVersionId,
          testVersionId: parsed.testVersionId,
          trafficSplitRatio: parsed.trafficSplitRatio ?? 0.5,
          isActive: true,
        },
      });
      res.status(201).json({ status: 'success', data: exp });
    } catch (err) {
      next(err);
    }
  };

  public runPlayground = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = aiPlaygroundSchema.parse(req.body);
      const result = await this.playground.runPlayground(parsed as any);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  public replayGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = productionReplaySchema.parse(req.body);
      const result = await this.playground.replayGeneration(parsed);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  public getCosts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const costs = await this.telemetry.getCostMetrics();
      res.json({ status: 'success', data: costs });
    } catch (err) {
      next(err);
    }
  };

  public resetCircuitBreaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { provider, model } = req.body;
      if (!provider || !model) {
        res.status(400).json({ status: 'error', message: 'provider and model required' });
        return;
      }
      await this.circuitBreaker.reset(provider, model);
      res.json({ status: 'success', message: `Circuit breaker reset for ${provider}/${model}` });
    } catch (err) {
      next(err);
    }
  };
}
