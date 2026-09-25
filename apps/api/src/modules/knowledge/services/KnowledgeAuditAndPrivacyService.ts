import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';

export interface LogAccessParams {
  userId: string;
  sourceType: string;
  sourceId: string;
  purpose: string;
  generationId?: string;
}

export class KnowledgeAuditAndPrivacyService {
  private static instance: KnowledgeAuditAndPrivacyService;

  private constructor() {}

  public static getInstance(): KnowledgeAuditAndPrivacyService {
    if (!KnowledgeAuditAndPrivacyService.instance) {
      KnowledgeAuditAndPrivacyService.instance = new KnowledgeAuditAndPrivacyService();
    }
    return KnowledgeAuditAndPrivacyService.instance;
  }

  /**
   * Logs access to a knowledge source for privacy auditing
   */
  public logAccess(params: LogAccessParams): void {
    logger.info(
      `KnowledgeAccessAudit: user='${params.userId}' accessed source='${params.sourceId}' (Type: ${params.sourceType}, Purpose: ${params.purpose}, GenId: ${params.generationId || 'none'})`
    );
  }

  /**
   * Purges all user knowledge, documents, collections, and research tasks on account deletion
   */
  public async purgeUserData(userId: string): Promise<{ deletedDocuments: number; deletedCollections: number; deletedTasks: number }> {
    logger.info(`KnowledgePrivacy: Starting full purge of knowledge data for user '${userId}'`);

    // 1. Fetch user document IDs
    const userDocs = await prisma.knowledgeDocument.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const docIds = userDocs.map((d) => d.id);

    // 2. Cascade delete document chunks
    if (docIds.length > 0) {
      await prisma.documentChunk.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.documentVersion.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.knowledgeCollectionMember.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.citationRecord.deleteMany({
        where: { documentId: { in: docIds } },
      });
    }

    // 3. Delete knowledge documents
    const docRes = await prisma.knowledgeDocument.deleteMany({
      where: { ownerId: userId },
    });

    // 4. Delete collections
    const colRes = await prisma.knowledgeCollection.deleteMany({
      where: { ownerId: userId },
    });

    // 5. Delete web research tasks and sources
    const tasks = await prisma.webResearchTask.findMany({
      where: { userId },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);

    if (taskIds.length > 0) {
      await prisma.webSourceRecord.deleteMany({
        where: { researchTaskId: { in: taskIds } },
      });
    }

    const taskRes = await prisma.webResearchTask.deleteMany({
      where: { userId },
    });

    logger.info(
      `KnowledgePrivacy: Purged user '${userId}' knowledge: ${docRes.count} docs, ${colRes.count} collections, ${taskRes.count} research tasks.`
    );

    return {
      deletedDocuments: docRes.count,
      deletedCollections: colRes.count,
      deletedTasks: taskRes.count,
    };
  }
}
