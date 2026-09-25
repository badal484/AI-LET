import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { ToolResultSanitizer } from '../../agents/ToolResultSanitizer.js';
import { MemoryEmbeddingService } from '../../memory/services/memoryEmbedding.service.js';
import type {
  KnowledgeDocumentItem,
  KnowledgeVisibility,
} from '@ai-companion/types';

export interface IngestDocumentRequest {
  ownerId: string;
  ownerType?: 'USER' | 'CREATOR' | 'PLATFORM';
  characterId?: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  rawContent: string;
  storageUrl?: string;
  visibility?: KnowledgeVisibility;
  collectionId?: string;
}

export interface ExtractedSection {
  heading?: string;
  pageNumber?: number;
  content: string;
  offset: number;
}

export class KnowledgeDocumentService {
  private static instance: KnowledgeDocumentService;
  private readonly sanitizer = ToolResultSanitizer.getInstance();

  private static readonly MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
  private static readonly CHUNK_SIZE_CHARS = 1800; // ~450 tokens
  private static readonly CHUNK_OVERLAP_CHARS = 200; // ~50 tokens

  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  private constructor() {}

  public static getInstance(): KnowledgeDocumentService {
    if (!KnowledgeDocumentService.instance) {
      KnowledgeDocumentService.instance = new KnowledgeDocumentService();
    }
    return KnowledgeDocumentService.instance;
  }

  /**
   * Computes canonical SHA-256 hash of document content
   */
  public computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Ingests, validates, extracts, segments, chunks, embeds, and stores a document.
   */
  public async ingestDocument(input: IngestDocumentRequest): Promise<KnowledgeDocumentItem> {
    // 1. Validate File Size
    if (input.fileSizeBytes > KnowledgeDocumentService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `File size ${input.fileSizeBytes} bytes exceeds limit of ${KnowledgeDocumentService.MAX_FILE_SIZE_BYTES} bytes.`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    // 2. Validate MIME Type
    const mime = input.mimeType.toLowerCase();
    if (!KnowledgeDocumentService.ALLOWED_MIME_TYPES.includes(mime)) {
      throw new BadRequestError(`Unsupported MIME type '${input.mimeType}'.`, ErrorCode.VALIDATION_ERROR);
    }

    // 3. Content Security Scanning (Prompt Injection & Malicious Code)
    const sanitized = this.sanitizer.sanitize(input.rawContent);
    const contentHash = this.computeHash(input.rawContent);

    // 4. Duplicate Document Detection
    const existing = await prisma.knowledgeDocument.findFirst({
      where: {
        ownerId: input.ownerId,
        contentHash,
        status: { not: 'DELETED' },
      },
    });

    if (existing) {
      logger.info(`Duplicate document detected for owner '${input.ownerId}' with hash '${contentHash}'. Reusing document '${existing.id}'.`);
      if (input.collectionId) {
        await this.linkToCollection(existing.id, input.collectionId).catch(() => {});
      }
      return this.mapDocumentToItem(existing);
    }

    const documentId = `doc_${crypto.randomUUID()}`;
    const cleanText = typeof sanitized.sanitizedData === 'string'
      ? sanitized.sanitizedData
      : JSON.stringify(sanitized.sanitizedData);

    // 5. Structural Extraction & Segmentation
    const sections = this.extractSections(cleanText, input.mimeType);

    // 6. Configurable Chunking with Structural Metadata
    const chunks = this.chunkSections(sections, documentId, 1);

    // 7. Initial Status
    const isFlagged = sanitized.hasPromptInjection;
    const initialStatus = isFlagged ? 'RESTRICTED' : 'INDEXED';

    try {
      // 8. Create Document & Version in Database
      const doc = await prisma.knowledgeDocument.create({
        data: {
          id: documentId,
          ownerId: input.ownerId,
          ownerType: input.ownerType || 'USER',
          characterId: input.characterId || null,
          title: input.title.trim() || input.originalFilename,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          storageUrl: input.storageUrl || null,
          contentHash,
          status: initialStatus,
          failureReason: isFlagged ? 'Flagged for prompt injection patterns' : null,
          currentVersion: 1,
          totalChunks: chunks.length,
          totalTokens: Math.round(cleanText.length / 4),
          pageCount: sections.reduce((max, s) => Math.max(max, s.pageNumber || 1), 1),
          visibility: input.visibility || 'PRIVATE',
        },
      });

      const version = await prisma.documentVersion.create({
        data: {
          id: `ver_${crypto.randomUUID()}`,
          documentId,
          versionNumber: 1,
          contentHash,
          chunkCount: chunks.length,
          tokenCount: doc.totalTokens,
          status: 'ACTIVE',
        },
      });

      // 9. Generate Embeddings and Save Chunks
      for (const chunk of chunks) {
        let embeddingVector: number[] = [];
        try {
          embeddingVector = await MemoryEmbeddingService.generateEmbedding(chunk.content);
        } catch (err: any) {
          logger.warn(`Embedding generation fallback for chunk ${chunk.chunkIndex}: ${err.message}`);
        }

        await prisma.documentChunk.create({
          data: {
            id: chunk.id,
            documentId,
            versionId: version.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            sectionHeading: chunk.sectionHeading,
            sourceOffset: chunk.sourceOffset,
            tokenCount: chunk.tokenCount,
            contentHash: chunk.contentHash,
            embedding: embeddingVector.length > 0 ? (embeddingVector as any) : null,
            metadata: {
              charLength: chunk.content.length,
              sanitized: sanitized.hasSecretsRedacted,
            },
          },
        });
      }

      // 10. Link to Collection if provided
      if (input.collectionId) {
        await this.linkToCollection(documentId, input.collectionId).catch((err) => {
          logger.warn(`Failed to link document to collection: ${err.message}`);
        });
      }

      logger.info(`Successfully ingested document '${documentId}' with ${chunks.length} chunks for owner '${input.ownerId}'`);
      return this.mapDocumentToItem(doc);
    } catch (err: any) {
      logger.error(`Document ingestion failed for '${documentId}': ${err.message}`);
      // Mark as failed if record was created
      await prisma.knowledgeDocument.updateMany({
        where: { id: documentId },
        data: { status: 'FAILED', failureReason: err.message },
      }).catch(() => {});
      throw err;
    }
  }

  /**
   * Structural section extraction preserving headings and pages
   */
  private extractSections(text: string, _mimeType: string): ExtractedSection[] {
    const sections: ExtractedSection[] = [];
    const lines = text.split('\n');

    let currentHeading = 'Overview';
    let currentPage = 1;
    let currentBuffer: string[] = [];
    let currentOffset = 0;

    for (const line of lines) {
      // Page marker heuristic (e.g. --- Page 2 --- or FormFeed)
      const pageMatch = line.match(/(?:---|===|\bPage\b)\s*(\d+)/i);
      if (pageMatch && pageMatch[1]) {
        currentPage = parseInt(pageMatch[1], 10);
      }

      // Heading marker (Markdown '#' or uppercase titles)
      const isMarkdownHeading = line.startsWith('#');
      const isCapsHeading = line.length > 4 && line.length < 80 && line === line.toUpperCase() && /^[A-Z0-9\s:_-]+$/.test(line);

      if (isMarkdownHeading || isCapsHeading) {
        if (currentBuffer.length > 0) {
          sections.push({
            heading: currentHeading,
            pageNumber: currentPage,
            content: currentBuffer.join('\n').trim(),
            offset: currentOffset,
          });
          currentOffset += currentBuffer.join('\n').length;
          currentBuffer = [];
        }
        currentHeading = line.replace(/^[#\s]+/, '').trim();
        continue;
      }

      currentBuffer.push(line);
    }

    if (currentBuffer.length > 0) {
      sections.push({
        heading: currentHeading,
        pageNumber: currentPage,
        content: currentBuffer.join('\n').trim(),
        offset: currentOffset,
      });
    }

    return sections.length > 0 ? sections : [{ heading: 'Full Content', pageNumber: 1, content: text.trim(), offset: 0 }];
  }

  /**
   * Chunks structural sections with token and overlap bounds
   */
  private chunkSections(sections: ExtractedSection[], documentId: string, _versionNumber: number): Array<{
    id: string;
    chunkIndex: number;
    content: string;
    pageNumber?: number;
    sectionHeading?: string;
    sourceOffset?: number;
    tokenCount: number;
    contentHash: string;
  }> {
    const chunks: Array<any> = [];
    let chunkIndex = 0;

    for (const sec of sections) {
      if (sec.content.length <= KnowledgeDocumentService.CHUNK_SIZE_CHARS) {
        chunks.push({
          id: `chk_${documentId}_${chunkIndex}`,
          chunkIndex,
          content: sec.content,
          pageNumber: sec.pageNumber,
          sectionHeading: sec.heading,
          sourceOffset: sec.offset,
          tokenCount: Math.round(sec.content.length / 4),
          contentHash: this.computeHash(sec.content),
        });
        chunkIndex++;
      } else {
        // Break into overlapping segments
        let start = 0;
        while (start < sec.content.length) {
          const end = Math.min(start + KnowledgeDocumentService.CHUNK_SIZE_CHARS, sec.content.length);
          const chunkText = sec.content.slice(start, end).trim();

          if (chunkText.length > 0) {
            chunks.push({
              id: `chk_${documentId}_${chunkIndex}`,
              chunkIndex,
              content: chunkText,
              pageNumber: sec.pageNumber,
              sectionHeading: sec.heading,
              sourceOffset: sec.offset + start,
              tokenCount: Math.round(chunkText.length / 4),
              contentHash: this.computeHash(chunkText),
            });
            chunkIndex++;
          }

          if (end >= sec.content.length) break;
          start += KnowledgeDocumentService.CHUNK_SIZE_CHARS - KnowledgeDocumentService.CHUNK_OVERLAP_CHARS;
        }
      }
    }

    return chunks;
  }

  /**
   * Links a document to a collection
   */
  public async linkToCollection(documentId: string, collectionId: string): Promise<void> {
    await prisma.knowledgeCollectionMember.upsert({
      where: {
        collectionId_documentId: { collectionId, documentId },
      },
      update: {},
      create: {
        id: `col_mem_${crypto.randomUUID()}`,
        collectionId,
        documentId,
      },
    });
  }

  /**
   * Retrieves a document by ID with tenant authorization check
   */
  public async getDocument(documentId: string, requestingUserId?: string): Promise<KnowledgeDocumentItem> {
    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.status === 'DELETED') {
      throw new NotFoundError(`KnowledgeDocument '${documentId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (requestingUserId && doc.ownerId !== requestingUserId && doc.visibility === 'PRIVATE') {
      throw new ForbiddenError('Unauthorized access to this private document.', ErrorCode.FORBIDDEN);
    }

    return this.mapDocumentToItem(doc);
  }

  /**
   * Lists documents for a given owner
   */
  public async listDocuments(ownerId: string, limit = 50): Promise<KnowledgeDocumentItem[]> {
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        ownerId,
        status: { not: 'DELETED' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return docs.map(this.mapDocumentToItem);
  }

  /**
   * Deletes a document cleanly and marks chunks deleted
   */
  public async deleteDocument(documentId: string, requestingUserId: string): Promise<boolean> {
    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundError(`KnowledgeDocument '${documentId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (doc.ownerId !== requestingUserId) {
      throw new ForbiddenError('Only the document owner can delete this document.', ErrorCode.FORBIDDEN);
    }

    // Hard-delete or soft-delete with cascade
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'DELETED' },
    });

    // Cascade delete chunks and members
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });
    await prisma.knowledgeCollectionMember.deleteMany({
      where: { documentId },
    });

    logger.info(`Deleted document '${documentId}' and cleaned up all associated chunks.`);
    return true;
  }

  /**
   * Maps Prisma database record to clean typed entity
   */
  private mapDocumentToItem(doc: any): KnowledgeDocumentItem {
    return {
      id: doc.id,
      ownerId: doc.ownerId,
      ownerType: doc.ownerType as any,
      characterId: doc.characterId,
      title: doc.title,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      storageUrl: doc.storageUrl,
      contentHash: doc.contentHash,
      status: doc.status as any,
      failureReason: doc.failureReason,
      currentVersion: doc.currentVersion,
      totalChunks: doc.totalChunks,
      totalTokens: doc.totalTokens,
      pageCount: doc.pageCount,
      visibility: doc.visibility as any,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
