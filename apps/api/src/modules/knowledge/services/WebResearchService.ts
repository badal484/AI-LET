import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { SecureBrowserTool } from '../../agents/SecureBrowserTool.js';
import { ToolResultSanitizer } from '../../agents/ToolResultSanitizer.js';
import { AppError, BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { simulatedToolsAllowed } from '../../agents/toolSafety.js';
import { ErrorCode } from '@ai-companion/config';
import type {
  WebResearchTaskItem,
  WebSourceItem,
  SourceFreshnessPolicy,
} from '@ai-companion/types';

export interface InitiateResearchParams {
  userId: string;
  conversationId?: string;
  query: string;
  freshnessPolicy?: SourceFreshnessPolicy;
  maxSources?: number;
}

export class WebResearchService {
  private static instance: WebResearchService;
  private readonly browser = SecureBrowserTool.getInstance();
  private readonly sanitizer = ToolResultSanitizer.getInstance();

  private static readonly MAX_SOURCES = 10;
  private static readonly MAX_QUERIES = 3;
  private static readonly ESTIMATED_TASK_COST_USD = 0.04;

  private constructor() {}

  public static getInstance(): WebResearchService {
    if (!WebResearchService.instance) {
      WebResearchService.instance = new WebResearchService();
    }
    return WebResearchService.instance;
  }

  /**
   * Decomposes a research question into targeted subqueries
   */
  public generateSubqueries(mainQuery: string): string[] {
    const q = mainQuery.trim();
    const subqueries = [q];

    if (q.toLowerCase().includes('compare') || q.toLowerCase().includes('vs')) {
      const cleaned = q.replace(/^compare\s+/i, '');
      const parts = cleaned.split(/\s+vs\.?\s+|\s+versus\s+/i);
      if (parts.length >= 2 && parts[0]?.trim() && parts[1]?.trim()) {
        subqueries.push(`${parts[0].trim()} overview`);
        subqueries.push(`${parts[1].trim()} overview`);
      }
    } else {
      subqueries.push(`${q} latest developments`);
    }

    return subqueries.slice(0, WebResearchService.MAX_QUERIES);
  }

  /**
   * Orchestrates multi-step web research with SSRF defense and source deduplication
   */
  public async executeResearch(params: InitiateResearchParams): Promise<WebResearchTaskItem> {
    const {
      userId,
      conversationId,
      query,
      freshnessPolicy = 'DAILY',
      maxSources = 5,
    } = params;

    if (!query || query.trim().length === 0) {
      throw new BadRequestError('Research query cannot be empty.', ErrorCode.VALIDATION_ERROR);
    }

    // There is no search provider integration: the "results" below are generated URLs read through
    // a simulated browser. That is only acceptable, clearly labelled, in dev/test simulation.
    if (!simulatedToolsAllowed()) {
      throw new AppError('Web research is not available: no web search provider is configured.', 503, ErrorCode.TOOL_PROVIDER_NOT_CONFIGURED);
    }

    const taskId = `research_${crypto.randomUUID()}`;
    logger.info(`Initiating WebResearchTask '${taskId}' for user '${userId}': "${query}"`);

    // 1. Create durable task record in DB
    const taskRecord = await prisma.webResearchTask.create({
      data: {
        id: taskId,
        userId,
        conversationId: conversationId || null,
        query: query.trim(),
        status: 'SEARCHING',
        freshnessPolicy,
        sourceCount: 0,
        costUsd: WebResearchService.ESTIMATED_TASK_COST_USD,
      },
    });

    const subqueries = this.generateSubqueries(query);
    const discoveredSources: WebSourceItem[] = [];
    const seenUrls = new Set<string>();

    // 2. Execute bounded searches & simulated page extractions
    for (const sq of subqueries) {
      if (discoveredSources.length >= Math.min(maxSources, WebResearchService.MAX_SOURCES)) {
        break;
      }

      // Simulated external search results for query
      const sanitizedQuerySlug = sq.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
      const targetUrls = [
        `https://docs.research-portal.org/topics/${sanitizedQuerySlug}`,
        `https://news.tech-analysis.com/articles/${sanitizedQuerySlug}`,
      ];

      for (const url of targetUrls) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        try {
          // SSRF validation and safe content fetch
          const pageData = await this.browser.fetchWebpage(url);

          // Content security sanitization (defuse prompt injection & redact secrets)
          const sanitized = this.sanitizer.sanitize(pageData.cleanText);

          const sourceRecord = await prisma.webSourceRecord.create({
            data: {
              id: `wsrc_${crypto.randomUUID()}`,
              researchTaskId: taskId,
              url,
              domain: new URL(url).hostname,
              title: pageData.title,
              publisher: new URL(url).hostname,
              contentSnippet: typeof sanitized.sanitizedData === 'string'
                ? sanitized.sanitizedData.slice(0, 800)
                : JSON.stringify(sanitized.sanitizedData).slice(0, 800),
              contentHash: crypto.createHash('sha256').update(pageData.cleanText).digest('hex'),
              retrievedAt: new Date(),
              credibilityScore: 0.92,
              isAccessible: true,
            },
          });

          discoveredSources.push({
            id: sourceRecord.id,
            researchTaskId: taskId,
            url: sourceRecord.url,
            domain: sourceRecord.domain,
            title: sourceRecord.title,
            publisher: sourceRecord.publisher,
            contentSnippet: sourceRecord.contentSnippet,
            contentHash: sourceRecord.contentHash,
            publishedAt: sourceRecord.publishedAt ? sourceRecord.publishedAt.toISOString() : null,
            retrievedAt: sourceRecord.retrievedAt.toISOString(),
            credibilityScore: sourceRecord.credibilityScore,
            isAccessible: sourceRecord.isAccessible,
          });
        } catch (err: any) {
          logger.warn(`WebResearch: Failed to fetch source ${url}: ${err.message}`);
        }
      }
    }

    // 3. Synthesis & Contradiction Detection
    const hasMultipleSources = discoveredSources.length > 1;
    const summary = discoveredSources.length > 0
      ? `[SIMULATED] ${discoveredSources.length} simulated sources for "${query}" (dev/test only; no real web search was performed).`
      : `Web research was unable to discover accessible public sources for "${query}".`;

    // 4. Update task record to COMPLETED
    await prisma.webResearchTask.update({
      where: { id: taskId },
      data: {
        status: discoveredSources.length > 0 ? 'COMPLETED' : 'FAILED',
        sourceCount: discoveredSources.length,
        summary,
        findings: {
          subqueriesUsed: subqueries,
          hasContradictions: false,
          sourceDomains: discoveredSources.map((s) => s.domain),
        } as any,
        completedAt: new Date(),
      },
    });

    return {
      id: taskId,
      userId,
      conversationId,
      query,
      status: discoveredSources.length > 0 ? 'COMPLETED' : 'FAILED',
      freshnessPolicy,
      sourceCount: discoveredSources.length,
      costUsd: WebResearchService.ESTIMATED_TASK_COST_USD,
      summary,
      sources: discoveredSources,
      findings: {
        subqueriesUsed: subqueries,
        hasMultipleSources,
      },
      createdAt: taskRecord.createdAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves a research task with its sources
   */
  public async getResearchTask(taskId: string, userId?: string): Promise<WebResearchTaskItem> {
    const task = await prisma.webResearchTask.findUnique({
      where: { id: taskId },
      include: { sources: true },
    });

    if (!task) {
      throw new NotFoundError(`WebResearchTask '${taskId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (userId && task.userId !== userId) {
      throw new BadRequestError('Unauthorized to access this research task.', ErrorCode.FORBIDDEN);
    }

    return {
      id: task.id,
      userId: task.userId,
      conversationId: task.conversationId,
      query: task.query,
      status: task.status as any,
      freshnessPolicy: task.freshnessPolicy as any,
      sourceCount: task.sourceCount,
      costUsd: task.costUsd,
      summary: task.summary,
      sources: task.sources.map((s) => ({
        id: s.id,
        researchTaskId: s.researchTaskId,
        url: s.url,
        domain: s.domain,
        title: s.title,
        publisher: s.publisher,
        contentSnippet: s.contentSnippet,
        contentHash: s.contentHash,
        publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
        retrievedAt: s.retrievedAt.toISOString(),
        credibilityScore: s.credibilityScore,
        isAccessible: s.isAccessible,
      })),
      findings: task.findings as any,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    };
  }
}
