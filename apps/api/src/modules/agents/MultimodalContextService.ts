import { MultimodalAttachmentItem, MultimodalPartType } from '@ai-companion/types';
import { AGENT_CONSTANTS } from '@ai-companion/config';
import { ToolResultSanitizer } from './ToolResultSanitizer.js';
import { logger } from '../../shared/utils/logger.js';
import crypto from 'crypto';

export class MultimodalContextService {
  private static instance: MultimodalContextService;
  private readonly sanitizer = ToolResultSanitizer.getInstance();

  private readonly attachments: Map<string, MultimodalAttachmentItem> = new Map();

  private readonly allowedMimeTypes: Record<MultimodalPartType, string[]> = {
    text: ['text/plain', 'text/markdown', 'text/csv'],
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    document: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
    ],
    structured_json: ['application/json'],
  };

  private constructor() {
    this.seedBaselineDocument();
  }

  public static getInstance(): MultimodalContextService {
    if (!MultimodalContextService.instance) {
      MultimodalContextService.instance = new MultimodalContextService();
    }
    return MultimodalContextService.instance;
  }

  /**
   * Validates and processes an uploaded multimodal attachment
   */
  public async processUpload(
    userId: string,
    partType: MultimodalPartType,
    mimeType: string,
    originalFilename: string,
    fileSizeBytes: number,
    storageUrl: string = 'https://s3.ai-companion.internal/media/sample_upload'
  ): Promise<MultimodalAttachmentItem> {
    // 1. File Size Verification
    if (fileSizeBytes > AGENT_CONSTANTS.MAX_MULTIMODAL_FILE_SIZE_BYTES) {
      throw new Error(
        `MULTIMODAL_SIZE_EXCEEDED: File size ${fileSizeBytes} bytes exceeds maximum allowed ${AGENT_CONSTANTS.MAX_MULTIMODAL_FILE_SIZE_BYTES} bytes.`
      );
    }

    // 2. MIME Type Verification
    const allowed = this.allowedMimeTypes[partType] || [];
    if (!allowed.includes(mimeType.toLowerCase())) {
      throw new Error(`UNSUPPORTED_MEDIA_TYPE: MIME type '${mimeType}' is not permitted for modality '${partType}'.`);
    }

    // 3. Security Scanning & Extraction Simulation
    const rawExtracted = `Structured text extracted from document "${originalFilename}". Sections: Introduction, Methodology, Results, Conclusions.`;
    const sanitized = this.sanitizer.sanitize(rawExtracted);

    const attachmentId = `att_${crypto.randomUUID()}`;
    const item: MultimodalAttachmentItem = {
      id: attachmentId,
      userId,
      partType,
      mimeType,
      originalFilename,
      fileSizeBytes,
      storageUrl,
      moderationStatus: sanitized.hasPromptInjection ? 'FLAGGED' : 'PASSED',
      extractedText: typeof sanitized.sanitizedData === 'string' ? sanitized.sanitizedData : JSON.stringify(sanitized.sanitizedData),
      extractedMetadata: {
        pageCount: 3,
        wordCount: 140,
        sanitized: sanitized.hasSecretsRedacted,
      },
      provenance: {
        sourceId: attachmentId,
        modelUsed: 'ocr-v2-document-extractor',
        confidence: 0.94,
      },
      createdAt: new Date().toISOString(),
    };

    this.attachments.set(item.id, item);
    logger.info(`Processed multimodal attachment '${attachmentId}' for user '${userId}' (${partType}, ${originalFilename})`);
    return item;
  }

  /**
   * Retrieves an attachment by ID ensuring ownership
   */
  public getAttachment(attachmentId: string, userId?: string): MultimodalAttachmentItem | null {
    const direct = this.attachments.get(attachmentId);
    if (!direct) return null;
    if (userId && direct.userId !== userId) return null;
    return direct;
  }

  /**
   * Deletes temporary multimodal attachment data
   */
  public deleteAttachment(attachmentId: string, userId: string): boolean {
    const item = this.getAttachment(attachmentId, userId);
    if (!item) return false;
    this.attachments.delete(attachmentId);
    logger.info(`Deleted multimodal attachment '${attachmentId}' for user '${userId}'`);
    return true;
  }

  private seedBaselineDocument() {
    const demoAtt: MultimodalAttachmentItem = {
      id: 'att_demo_doc_001',
      userId: 'user_demo_001',
      partType: 'document',
      mimeType: 'application/pdf',
      originalFilename: 'Q3_Research_Report.pdf',
      fileSizeBytes: 1048576,
      storageUrl: 'https://s3.ai-companion.internal/media/att_demo_doc_001.pdf',
      moderationStatus: 'PASSED',
      extractedText: 'Q3 Research Summary: Companionship engagement grew by 35% with memory grounding active.',
      extractedMetadata: { pageCount: 5 },
      provenance: {
        sourceId: 'att_demo_doc_001',
        modelUsed: 'ocr-v2',
        confidence: 0.98,
      },
      createdAt: new Date().toISOString(),
    };
    this.attachments.set(demoAtt.id, demoAtt);
  }
}
