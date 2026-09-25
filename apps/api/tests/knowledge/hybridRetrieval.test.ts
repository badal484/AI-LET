import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HybridRetrievalEngine } from '../../src/modules/knowledge/services/HybridRetrievalEngine.js';
import { KnowledgeDocumentService } from '../../src/modules/knowledge/services/KnowledgeDocumentService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 26: Hybrid Retrieval Engine & Query Classification', () => {
  const engine = HybridRetrievalEngine.getInstance();
  const docService = KnowledgeDocumentService.getInstance();

  const userAlice = 'user_alice_rag_001';
  const userBob = 'user_bob_rag_002';
  let aliceDocId = '';

  beforeAll(async () => {
    // Ingest Alice's private notes
    const aliceContent = `# Tokyo Travel Guide 2026\nRecommended neighborhoods: Shinjuku, Shibuya, Asakusa.\nBest ramen in Shinjuku is Ichiran and Fuunji.\nBudget hotels near Yamanote Line average 12000 JPY per night.`;
    const doc = await docService.ingestDocument({
      ownerId: userAlice,
      title: 'Tokyo Notes',
      originalFilename: 'tokyo.md',
      mimeType: 'text/markdown',
      fileSizeBytes: Buffer.byteLength(aliceContent),
      rawContent: aliceContent,
      visibility: 'PRIVATE',
    });
    aliceDocId = doc.id;
  });

  afterAll(async () => {
    if (aliceDocId) {
      await docService.deleteDocument(aliceDocId, userAlice).catch(() => {});
    }
  });

  it('classifies casual greetings as conversational and bypasses retrieval', async () => {
    const query = 'hello there, how are you doing today?';
    expect(engine.classifyQuery(query)).toBe('conversational');

    const results = await engine.search({
      query,
      userId: userAlice,
    });

    expect(results.length).toBe(0);
  });

  it('classifies document-specific questions and executes hybrid search', async () => {
    const query = 'Where is the best ramen in Shinjuku according to my notes?';
    expect(engine.classifyQuery(query)).toBe('document_specific');

    const results = await engine.search({
      query,
      userId: userAlice,
      maxCandidates: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Shinjuku');
    expect(results[0].content).toContain('Fuunji');
    expect(results[0].compositeScore).toBeGreaterThan(0);
    expect(results[0].ownerId).toBe(userAlice);
  });

  it('strictly isolates tenant data: User Bob CANNOT retrieve Alice private documents', async () => {
    const query = 'Where is the best ramen in Shinjuku according to my notes?';

    const bobResults = await engine.search({
      query,
      userId: userBob, // Bob attempts to query
      maxCandidates: 5,
    });

    // Zero candidates returned from Alice's private document
    expect(bobResults.length).toBe(0);
  });

  it('respects token budget and candidate bounds', async () => {
    const results = await engine.search({
      query: 'Tokyo ramen Yamanote Line',
      userId: userAlice,
      maxCandidates: 1, // Limit to 1 candidate
      maxTokenBudget: 50,
    });

    expect(results.length).toBeLessThanOrEqual(1);
  });
});
