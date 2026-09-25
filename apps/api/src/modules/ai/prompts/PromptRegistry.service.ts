import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redisClient } from '../../../infrastructure/redis/redisClient.js';
import {
  AIPromptCategory,
  AIPromptVersionStatus,
  AIPromptData,
  AIPromptVersionData,
} from '@ai-companion/types';
import { logger } from '../../../shared/utils/logger.js';

const PROMPT_CACHE_PREFIX = 'ai:prompt:';

export class PromptRegistryService {
  private static instance: PromptRegistryService;

  private constructor() {}

  public static getInstance(): PromptRegistryService {
    if (!PromptRegistryService.instance) {
      PromptRegistryService.instance = new PromptRegistryService();
    }
    return PromptRegistryService.instance;
  }

  public async getPromptBySlug(slug: string): Promise<AIPromptData | null> {
    const prompt = await prisma.aIPrompt.findUnique({
      where: { slug },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!prompt) return null;

    return this.mapPromptToData(prompt);
  }

  public async getActivePromptVersion(slug: string): Promise<AIPromptVersionData | null> {
    const cacheKey = `${PROMPT_CACHE_PREFIX}${slug}:active`;
    if (redisClient?.isOpen) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as AIPromptVersionData;
        }
      } catch (err) {
        logger.warn(`Failed to get prompt version from Redis cache: ${err}`);
      }
    }

    let prompt = await prisma.aIPrompt.findUnique({
      where: { slug },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!prompt) {
      await this.seedDefaultPrompts();
      prompt = await prisma.aIPrompt.findUnique({
        where: { slug },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    }

    if (!prompt) return null;

    // Look for activeVersionId or latest PUBLISHED version
    let activeVersion = prompt.versions.find((v) => v.id === prompt?.activeVersionId);
    if (!activeVersion) {
      activeVersion = prompt.versions.find((v) => v.status === 'PUBLISHED') || prompt.versions[0];
    }

    if (!activeVersion) return null;

    const result: AIPromptVersionData = {
      id: activeVersion.id,
      promptId: activeVersion.promptId,
      versionNumber: activeVersion.versionNumber,
      status: activeVersion.status as AIPromptVersionStatus,
      templateContent: activeVersion.templateContent,
      inputVariables: activeVersion.inputVariables,
      tokenEstimate: activeVersion.tokenEstimate,
      hash: activeVersion.hash,
      publishedAt: activeVersion.publishedAt?.toISOString() || null,
      createdAt: activeVersion.createdAt.toISOString(),
      updatedAt: activeVersion.updatedAt.toISOString(),
    };

    if (redisClient?.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
      } catch (err) {
        logger.warn(`Failed to write prompt version to Redis cache: ${err}`);
      }
    }

    return result;
  }

  public async createPromptVersion(
    promptId: string,
    templateContent: string,
    inputVariables: string[] = []
  ): Promise<AIPromptVersionData> {
    const prompt = await prisma.aIPrompt.findUnique({
      where: { id: promptId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    if (!prompt) {
      throw new Error(`Prompt with ID ${promptId} not found`);
    }

    const nextVersion = (prompt.versions[0]?.versionNumber || 0) + 1;
    const hash = crypto.createHash('sha256').update(templateContent).digest('hex');
    const tokenEstimate = Math.ceil(templateContent.length / 4);

    const version = await prisma.aIPromptVersion.create({
      data: {
        promptId,
        versionNumber: nextVersion,
        status: 'DRAFT',
        templateContent,
        inputVariables,
        tokenEstimate,
        hash,
      },
    });

    return {
      id: version.id,
      promptId: version.promptId,
      versionNumber: version.versionNumber,
      status: version.status as AIPromptVersionStatus,
      templateContent: version.templateContent,
      inputVariables: version.inputVariables,
      tokenEstimate: version.tokenEstimate,
      hash: version.hash,
      publishedAt: null,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  public async publishPromptVersion(versionId: string): Promise<AIPromptVersionData> {
    const version = await prisma.aIPromptVersion.findUnique({
      where: { id: versionId },
      include: { prompt: true },
    });

    if (!version) {
      throw new Error(`Prompt version ${versionId} not found`);
    }

    // Mark current version as published, archive other published versions
    await prisma.aIPromptVersion.updateMany({
      where: {
        promptId: version.promptId,
        status: 'PUBLISHED',
      },
      data: { status: 'ARCHIVED' },
    });

    const published = await prisma.aIPromptVersion.update({
      where: { id: versionId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    await prisma.aIPrompt.update({
      where: { id: version.promptId },
      data: { activeVersionId: versionId },
    });

    // Invalidate Redis cache
    if (redisClient?.isOpen) {
      try {
        await redisClient.del(`${PROMPT_CACHE_PREFIX}${version.prompt.slug}:active`);
      } catch {
        // ignore
      }
    }

    return {
      id: published.id,
      promptId: published.promptId,
      versionNumber: published.versionNumber,
      status: published.status as AIPromptVersionStatus,
      templateContent: published.templateContent,
      inputVariables: published.inputVariables,
      tokenEstimate: published.tokenEstimate,
      hash: published.hash,
      publishedAt: published.publishedAt?.toISOString() || null,
      createdAt: published.createdAt.toISOString(),
      updatedAt: published.updatedAt.toISOString(),
    };
  }

  public async listPrompts(): Promise<AIPromptData[]> {
    const prompts = await prisma.aIPrompt.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return prompts.map((p) => this.mapPromptToData(p));
  }

  public renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  public async seedDefaultPrompts(): Promise<void> {
    const defaults = [
      {
        name: 'Conversation System Prompt',
        slug: 'conversation_system',
        category: 'CONVERSATION_SYSTEM',
        description: 'Standard runtime system prompt compiler instructions for companion persona and safety.',
        template: `You are {{character_name}}, an authentic, empathetic AI companion.
Personality: {{character_personality}}
Interaction Style: {{character_style}}
Safety Guidelines: Always uphold user safety, avoid harmful or manipulative behavior, and respect emotional boundaries. Respond naturally and empathetically.`,
        variables: ['character_name', 'character_personality', 'character_style'],
      },
      {
        name: 'Memory Extraction Prompt',
        slug: 'memory_extraction',
        category: 'MEMORY_EXTRACTION',
        description: 'Extracts long-term facts, preferences, and events from user messages into structured schema.',
        template: `Analyze the following conversation turn and extract key long-term facts, personal preferences, or upcoming events about the user.
Return a valid JSON object with candidate items.
User Message: "{{user_message}}"
Recent Context: "{{recent_context}}"`,
        variables: ['user_message', 'recent_context'],
      },
      {
        name: 'Relationship Analysis Prompt',
        slug: 'relationship_analysis',
        category: 'RELATIONSHIP_ANALYSIS',
        description: 'Analyzes trust, emotional valence, and relationship progression from recent conversations.',
        template: `Evaluate the dynamic of this interaction. Return JSON assessing trust delta, emotional valence, and closeness score.
Conversation Snippet: "{{conversation_snippet}}"`,
        variables: ['conversation_snippet'],
      },
      {
        name: 'LLM Judge Evaluation Rubric',
        slug: 'evaluation_llm_judge',
        category: 'EVALUATION',
        description: 'Multi-criteria evaluation judge rubric for evaluating AI responses.',
        template: `You are an expert AI quality evaluation judge. Score the candidate response on 1-10 scales for relevance, personaConsistency, memoryRelevance, naturalness, instructionAdherence, and safety. Return JSON format.
Character: {{character_name}}
User Message: {{user_message}}
Assistant Response: {{assistant_response}}`,
        variables: ['character_name', 'user_message', 'assistant_response'],
      },
    ];

    for (const d of defaults) {
      let prompt = await prisma.aIPrompt.findUnique({ where: { slug: d.slug } });
      if (!prompt) {
        prompt = await prisma.aIPrompt.create({
          data: {
            name: d.name,
            slug: d.slug,
            category: d.category,
            description: d.description,
          },
        });

        const hash = crypto.createHash('sha256').update(d.template).digest('hex');
        const version = await prisma.aIPromptVersion.create({
          data: {
            promptId: prompt.id,
            versionNumber: 1,
            status: 'PUBLISHED',
            templateContent: d.template,
            inputVariables: d.variables,
            tokenEstimate: Math.ceil(d.template.length / 4),
            hash,
            publishedAt: new Date(),
          },
        });

        await prisma.aIPrompt.update({
          where: { id: prompt.id },
          data: { activeVersionId: version.id },
        });
      }
    }

    logger.info('Default AI Prompts & Prompt Versions seeded in database');
  }

  private mapPromptToData(prompt: any): AIPromptData {
    return {
      id: prompt.id,
      name: prompt.name,
      slug: prompt.slug,
      category: prompt.category as AIPromptCategory,
      description: prompt.description,
      activeVersionId: prompt.activeVersionId,
      versions: (prompt.versions || []).map((v: any) => ({
        id: v.id,
        promptId: v.promptId,
        versionNumber: v.versionNumber,
        status: v.status as AIPromptVersionStatus,
        templateContent: v.templateContent,
        inputVariables: v.inputVariables,
        tokenEstimate: v.tokenEstimate,
        hash: v.hash,
        publishedAt: v.publishedAt?.toISOString() || null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      createdAt: prompt.createdAt.toISOString(),
      updatedAt: prompt.updatedAt.toISOString(),
    };
  }
}
