import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeDocumentService } from '../../src/modules/knowledge/services/KnowledgeDocumentService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 26: Knowledge Document Processing Pipeline', () => {
  const service = KnowledgeDocumentService.getInstance();
  const testUserId = 'user_test_doc_001';

  beforeEach(async () => {
    // Clean up test documents
    const existing = await prisma.knowledgeDocument.findMany({
      where: { ownerId: testUserId },
      select: { id: true },
    });
    const ids = existing.map((d) => d.id);
    if (ids.length > 0) {
      await prisma.documentChunk.deleteMany({ where: { documentId: { in: ids } } });
      await prisma.documentVersion.deleteMany({ where: { documentId: { in: ids } } });
      await prisma.knowledgeCollectionMember.deleteMany({ where: { documentId: { in: ids } } });
      await prisma.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('validates, extracts sections, chunks, and indexes a clean document', async () => {
    const rawContent = `# Executive Summary\nOur quarterly AI companion retention increased by 42%.\n\n# Methodology\nWe tested 1,000 active cohorts across 3 weeks.\n--- Page 2 ---\n# Results\nEngagement score reached 4.8 out of 5.0.`;

    const doc = await service.ingestDocument({
      ownerId: testUserId,
      title: 'Quarterly AI Retention Report',
      originalFilename: 'Q3_Retention.md',
      mimeType: 'text/markdown',
      fileSizeBytes: Buffer.byteLength(rawContent),
      rawContent,
    });

    expect(doc.id).toBeDefined();
    expect(doc.ownerId).toBe(testUserId);
    expect(doc.status).toBe('INDEXED');
    expect(doc.totalChunks).toBeGreaterThan(0);
    expect(doc.contentHash).toBeDefined();

    // Verify chunks stored in database
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { chunkIndex: 'asc' },
    });

    expect(chunks.length).toBe(doc.totalChunks);
    expect(chunks[0].sectionHeading).toBe('Executive Summary');
    expect(chunks[0].content).toContain('quarterly AI companion retention');
  });

  it('detects duplicate uploads via contentHash and reuses existing document', async () => {
    const rawContent = `Duplicate test content for deterministic hashing: ${Date.now()}`;
    const fileSizeBytes = Buffer.byteLength(rawContent);

    const doc1 = await service.ingestDocument({
      ownerId: testUserId,
      title: 'Doc 1',
      originalFilename: 'doc1.txt',
      mimeType: 'text/plain',
      fileSizeBytes,
      rawContent,
    });

    const doc2 = await service.ingestDocument({
      ownerId: testUserId,
      title: 'Doc 2 Duplicate',
      originalFilename: 'doc2.txt',
      mimeType: 'text/plain',
      fileSizeBytes,
      rawContent,
    });

    expect(doc2.id).toBe(doc1.id);
    expect(doc2.contentHash).toBe(doc1.contentHash);
  });

  it('rejects files exceeding platform size budget (20MB)', async () => {
    await expect(
      service.ingestDocument({
        ownerId: testUserId,
        title: 'Massive Doc',
        originalFilename: 'massive.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 25 * 1024 * 1024, // 25MB > 20MB
        rawContent: 'test',
      })
    ).rejects.toThrow(/limit of 20971520 bytes/);
  });

  it('rejects unsupported MIME types', async () => {
    await expect(
      service.ingestDocument({
        ownerId: testUserId,
        title: 'Executable script',
        originalFilename: 'exploit.sh',
        mimeType: 'application/x-sh',
        fileSizeBytes: 100,
        rawContent: 'echo "hack"',
      })
    ).rejects.toThrow(/Unsupported MIME type/);
  });

  it('deletes document and cleanly purges all chunks and version records', async () => {
    const rawContent = 'Simple content to verify complete deletion.';
    const doc = await service.ingestDocument({
      ownerId: testUserId,
      title: 'Delete Me',
      originalFilename: 'delete_me.txt',
      mimeType: 'text/plain',
      fileSizeBytes: Buffer.byteLength(rawContent),
      rawContent,
    });

    const deleted = await service.deleteDocument(doc.id, testUserId);
    expect(deleted).toBe(true);

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: doc.id },
    });
    expect(chunks.length).toBe(0);

    const updatedDoc = await prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
    });
    expect(updatedDoc?.status).toBe('DELETED');
  });
});
