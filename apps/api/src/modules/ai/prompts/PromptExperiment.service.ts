import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { AIPromptExperimentData, AIPromptVersionData } from '@ai-companion/types';
import { PromptRegistryService } from './PromptRegistry.service.js';

export class PromptExperimentService {
  private static instance: PromptExperimentService;
  private promptRegistry = PromptRegistryService.getInstance();

  private constructor() {}

  public static getInstance(): PromptExperimentService {
    if (!PromptExperimentService.instance) {
      PromptExperimentService.instance = new PromptExperimentService();
    }
    return PromptExperimentService.instance;
  }

  public async getExperimentForPrompt(promptId: string): Promise<AIPromptExperimentData | null> {
    const experiment = await prisma.aIPromptExperiment.findFirst({
      where: { promptId, isActive: true },
    });
    if (!experiment) return null;

    return {
      id: experiment.id,
      name: experiment.name,
      promptId: experiment.promptId,
      controlVersionId: experiment.controlVersionId,
      testVersionId: experiment.testVersionId,
      trafficSplitRatio: experiment.trafficSplitRatio,
      isActive: experiment.isActive,
      metrics: (experiment.metrics as any) || { controlImpressions: 0, testImpressions: 0 },
      createdAt: experiment.createdAt.toISOString(),
      updatedAt: experiment.updatedAt.toISOString(),
    };
  }

  public async resolvePromptVersion(
    promptSlug: string,
    entityId: string // userId or conversationId for deterministic hash
  ): Promise<{ version: AIPromptVersionData; experimentId?: string; variant: 'control' | 'test' | 'default' }> {
    const prompt = await this.promptRegistry.getPromptBySlug(promptSlug);
    if (!prompt) {
      const fallback = await this.promptRegistry.getActivePromptVersion(promptSlug);
      if (!fallback) throw new Error(`Prompt '${promptSlug}' not found`);
      return { version: fallback, variant: 'default' };
    }

    const experiment = await this.getExperimentForPrompt(prompt.id);
    if (!experiment || !experiment.isActive) {
      const active = await this.promptRegistry.getActivePromptVersion(promptSlug);
      return { version: active!, variant: 'default' };
    }

    // Deterministic hash assignment based on entityId and experimentId
    const hash = crypto.createHash('md5').update(`${entityId}:${experiment.id}`).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const normalized = (hashInt % 1000) / 1000.0;

    const isTestVariant = normalized < experiment.trafficSplitRatio;
    const chosenVersionId = isTestVariant ? experiment.testVersionId : experiment.controlVersionId;
    const variant = isTestVariant ? 'test' : 'control';

    const chosenVersion = (prompt.versions || []).find((v) => v.id === chosenVersionId);
    if (!chosenVersion) {
      const active = await this.promptRegistry.getActivePromptVersion(promptSlug);
      return { version: active!, variant: 'default' };
    }

    // Async record impression in metrics
    this.recordImpression(experiment.id, variant).catch(() => {});

    return {
      version: chosenVersion,
      experimentId: experiment.id,
      variant,
    };
  }

  public async recordImpression(experimentId: string, variant: 'control' | 'test'): Promise<void> {
    const exp = await prisma.aIPromptExperiment.findUnique({ where: { id: experimentId } });
    if (!exp) return;

    const metrics = (exp.metrics as any) || { controlImpressions: 0, testImpressions: 0 };
    if (variant === 'test') {
      metrics.testImpressions = (metrics.testImpressions || 0) + 1;
    } else {
      metrics.controlImpressions = (metrics.controlImpressions || 0) + 1;
    }

    await prisma.aIPromptExperiment.update({
      where: { id: experimentId },
      data: { metrics },
    });
  }
}
