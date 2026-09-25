import { describe, it, expect } from 'vitest';
import { KnowledgeDocumentService } from '../../src/modules/knowledge/services/KnowledgeDocumentService.js';
import { KnowledgeCollectionService } from '../../src/modules/knowledge/services/KnowledgeCollectionService.js';
import { WebResearchService } from '../../src/modules/knowledge/services/WebResearchService.js';
import { KnowledgeAuditAndPrivacyService } from '../../src/modules/knowledge/services/KnowledgeAuditAndPrivacyService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 26: Knowledge Privacy & Account Deletion Purge', () => {
  const docService = KnowledgeDocumentService.getInstance();
  const colService = KnowledgeCollectionService.getInstance();
  const researchService = WebResearchService.getInstance();
  const privacyService = KnowledgeAuditAndPrivacyService.getInstance();

  const userToDelete = 'user_to_purge_999';

  it('completely purges all documents, chunks, collections, research tasks, and citations upon user account deletion', async () => {
    // 1. Create Document with Chunks
    const doc = await docService.ingestDocument({
      ownerId: userToDelete,
      title: 'Private Diary',
      originalFilename: 'diary.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 50,
      rawContent: 'Private user thoughts that must never be orphaned or retained.',
    });

    // 2. Create Collection & Member
    const col = await colService.createCollection({
      ownerId: userToDelete,
      name: 'Secret Collection',
    });
    await colService.addDocument(col.id, doc.id, userToDelete);

    // 3. Create Web Research Task
    await researchService.executeResearch({
      userId: userToDelete,
      query: 'Privacy Laws 2026',
      maxSources: 1,
    });

    // 4. Verify entities exist before purge
    const initialDocs = await prisma.knowledgeDocument.findMany({ where: { ownerId: userToDelete } });
    const initialChunks = await prisma.documentChunk.findMany({ where: { documentId: doc.id } });
    const initialCols = await prisma.knowledgeCollection.findMany({ where: { ownerId: userToDelete } });
    const initialTasks = await prisma.webResearchTask.findMany({ where: { userId: userToDelete } });

    expect(initialDocs.length).toBeGreaterThan(0);
    expect(initialChunks.length).toBeGreaterThan(0);
    expect(initialCols.length).toBeGreaterThan(0);
    expect(initialTasks.length).toBeGreaterThan(0);

    // 5. Execute Privacy Purge
    const purgeSummary = await privacyService.purgeUserData(userToDelete);
    expect(purgeSummary.deletedDocuments).toBeGreaterThan(0);
    expect(purgeSummary.deletedCollections).toBeGreaterThan(0);
    expect(purgeSummary.deletedTasks).toBeGreaterThan(0);

    // 6. Verify zero lingering records or orphan chunks
    const postDocs = await prisma.knowledgeDocument.findMany({ where: { ownerId: userToDelete } });
    const postChunks = await prisma.documentChunk.findMany({ where: { documentId: doc.id } });
    const postCols = await prisma.knowledgeCollection.findMany({ where: { ownerId: userToDelete } });
    const postTasks = await prisma.webResearchTask.findMany({ where: { userId: userToDelete } });

    expect(postDocs.length).toBe(0);
    expect(postChunks.length).toBe(0);
    expect(postCols.length).toBe(0);
    expect(postTasks.length).toBe(0);
  });
});
