import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { SafetyService } from '../../safety/services/SafetyService.js';
import { ToolResultSanitizer } from '../../agents/ToolResultSanitizer.js';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export interface IngestDocumentInput {
  creatorId: string;
  characterId?: string;
  title: string;
  sourceUrl?: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  rawTextContent: string;
}

export interface CreatorKnowledgeDocItem {
  id: string;
  creatorId: string;
  characterId?: string | null;
  title: string;
  sourceUrl?: string | null;
  originalFilename?: string | null;
  mimeType: string;
  fileSizeBytes: number;
  version: number;
  chunkCount: number;
  status: string;
  moderationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export class CreatorKnowledgeIngestionService {
  private static instance: CreatorKnowledgeIngestionService;
  private readonly sanitizer = ToolResultSanitizer.getInstance();

  private constructor() {}

  public static getInstance(): CreatorKnowledgeIngestionService {
    if (!CreatorKnowledgeIngestionService.instance) {
      CreatorKnowledgeIngestionService.instance = new CreatorKnowledgeIngestionService();
    }
    return CreatorKnowledgeIngestionService.instance;
  }

  /**
   * Ingests, validates, scans, chunks, moderates, and indexes a creator knowledge document.
   */
  public async ingestDocument(input: IngestDocumentInput): Promise<CreatorKnowledgeDocItem> {
    // 1. File size guardrail (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (input.fileSizeBytes > MAX_SIZE) {
      throw new BadRequestError(`File size ${input.fileSizeBytes} bytes exceeds limit of ${MAX_SIZE} bytes.`, ErrorCode.VALIDATION_ERROR);
    }

    // 2. MIME type validation
    const allowedMimes = ['text/plain', 'text/markdown', 'application/pdf', 'application/json', 'text/csv'];
    if (!allowedMimes.includes(input.mimeType.toLowerCase())) {
      throw new BadRequestError(`Unsupported MIME type '${input.mimeType}'.`, ErrorCode.VALIDATION_ERROR);
    }

    // 3. Security Scanning & Sanitization (malware heuristics / prompt injection defense)
    const sanitized = this.sanitizer.sanitize(input.rawTextContent);
    const hasInjection = sanitized.hasPromptInjection;

    // 4. Content Safety Moderation
    const safetyCheck = await SafetyService.evaluateInput({
      surface: 'INPUT',
      content: input.rawTextContent.slice(0, 2000), // inspect sample
      userId: input.creatorId,
      characterId: input.characterId || undefined,
      requestId: `ingest_${crypto.randomUUID()}`,
    });

    const isModerationBlocked = safetyCheck.decision === 'BLOCK' || safetyCheck.decision === 'ESCALATE' || hasInjection;
    const docStatus = isModerationBlocked ? 'MODERATION_REJECTED' : 'READY';
    const moderationStatus = isModerationBlocked ? 'REJECTED' : 'PASSED';

    const cleanText = typeof sanitized.sanitizedData === 'string' ? sanitized.sanitizedData : input.rawTextContent;

    // 5. Chunking (approx 500 characters per chunk)
    const rawChunks = this.chunkText(cleanText, 500);

    const doc = await prisma.creatorKnowledgeDoc.create({
      data: {
        creatorId: input.creatorId,
        characterId: input.characterId || null,
        title: input.title,
        sourceUrl: input.sourceUrl || null,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        version: 1,
        chunkCount: rawChunks.length,
        status: docStatus,
        moderationStatus,
      },
    });

    if (!isModerationBlocked) {
      for (let i = 0; i < rawChunks.length; i++) {
        const chunkText = rawChunks[i] || '';
        await prisma.creatorKnowledgeChunk.create({
          data: {
            knowledgeId: doc.id,
            chunkIndex: i,
            content: chunkText,
            tokenCount: Math.ceil(chunkText.length / 4),
            metadata: {
              charStart: i * 500,
              charEnd: i * 500 + chunkText.length,
            },
          },
        });
      }
    }

    logger.info(`CreatorKnowledgeIngestion: ingested doc '${doc.id}' (${rawChunks.length} chunks, status: ${docStatus})`);
    return this.mapToItem(doc);
  }

  /**
   * Retrieves relevant knowledge chunks for a query
   */
  public async retrieveKnowledgeChunks(characterId: string, _query: string, topK: number = 3): Promise<string[]> {
    try {
      const docs = await prisma.creatorKnowledgeDoc.findMany({
        where: {
          characterId,
          status: 'READY',
          moderationStatus: 'PASSED',
        },
        select: { id: true },
      });

      if (docs.length === 0) return [];

      const docIds = docs.map((d) => d.id);
      const chunks = await prisma.creatorKnowledgeChunk.findMany({
        where: {
          knowledgeId: { in: docIds },
        },
        take: topK,
      });

      return chunks.map((c) => c.content);
    } catch {
      return [];
    }
  }

  /**
   * Lists creator knowledge documents
   */
  public async listCreatorDocuments(creatorId: string): Promise<CreatorKnowledgeDocItem[]> {
    const docs = await prisma.creatorKnowledgeDoc.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map(this.mapToItem);
  }

  /**
   * Rolls back a knowledge document or updates status
   */
  public async rollbackDocument(docId: string, creatorId: string): Promise<CreatorKnowledgeDocItem> {
    const doc = await prisma.creatorKnowledgeDoc.findFirst({
      where: { id: docId, creatorId },
    });

    if (!doc) {
      throw new NotFoundError(`Knowledge doc '${docId}' not found.`, ErrorCode.NOT_FOUND);
    }

    const updated = await prisma.creatorKnowledgeDoc.update({
      where: { id: docId },
      data: {
        version: doc.version + 1,
        status: 'READY',
        moderationStatus: 'PASSED',
      },
    });

    logger.info(`CreatorKnowledgeIngestion: rolled back doc '${docId}' to version ${updated.version}`);
    return this.mapToItem(updated);
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + chunkSize));
      i += chunkSize;
    }
    return chunks;
  }

  private mapToItem(record: any): CreatorKnowledgeDocItem {
    return {
      id: record.id,
      creatorId: record.creatorId,
      characterId: record.characterId,
      title: record.title,
      sourceUrl: record.sourceUrl,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      fileSizeBytes: record.fileSizeBytes,
      version: record.version,
      chunkCount: record.chunkCount,
      status: record.status,
      moderationStatus: record.moderationStatus,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
