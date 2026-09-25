import { describe, it, expect, afterAll } from 'vitest';
import { GroundedGenerationService } from '../../src/modules/knowledge/services/GroundedGenerationService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import type { HybridSearchResult, WebSourceItem } from '@ai-companion/types';

describe('Phase 26: Grounded Generation & Citation Validation', () => {
  const service = GroundedGenerationService.getInstance();
  const testMessageId = 'msg_test_grounded_001';

  afterAll(async () => {
    await prisma.citationRecord.deleteMany({
      where: { messageId: testMessageId },
    });
  });

  const mockDocResults: HybridSearchResult[] = [
    {
      chunkId: 'chk_mars_001',
      documentId: 'doc_mars_001',
      documentTitle: 'Mars Colonization Handbook',
      content: 'Atmospheric pressure on Mars is approximately 610 Pascals, roughly 0.6% of Earth sea level.',
      pageNumber: 14,
      sectionHeading: 'Atmospheric Parameters',
      semanticScore: 0.94,
      lexicalScore: 0.88,
      compositeScore: 0.91,
      sourceType: 'USER_DOCUMENT',
      ownerId: 'user_123',
    },
  ];

  const mockWebSources: WebSourceItem[] = [
    {
      id: 'wsrc_nasa_001',
      url: 'https://nasa.gov/mars-mission',
      domain: 'nasa.gov',
      title: 'NASA Mars Exploration Overview',
      contentSnippet: 'Perseverance rover confirmed presence of ancient delta sediments in Jezero Crater.',
      contentHash: 'hash_nasa_123',
      retrievedAt: new Date().toISOString(),
      isAccessible: true,
    },
  ];

  it('builds structured XML-delimited reference blocks with unambiguous source boundaries', () => {
    const { contextBlock, sourceMap } = service.buildGroundedContext(mockDocResults, mockWebSources);

    expect(contextBlock).toContain('<source id="[1]" type="DOCUMENT"');
    expect(contextBlock).toContain('Atmospheric Parameters');
    expect(contextBlock).toContain('<source id="[2]" type="WEB"');
    expect(contextBlock).toContain('nasa.gov');

    expect(sourceMap.size).toBe(2);
    expect(sourceMap.get('1')?.title).toBe('Mars Colonization Handbook');
    expect(sourceMap.get('2')?.title).toBe('NASA Mars Exploration Overview');
  });

  it('validates legitimate citations and persists verified citation records in database', async () => {
    const { sourceMap } = service.buildGroundedContext(mockDocResults, mockWebSources);

    const modelResponse = 'According to [1], atmospheric pressure on Mars is 610 Pascals. Furthermore, ancient delta sediments were found in Jezero Crater [2].';

    const result = await service.validateAndPersistCitations(
      modelResponse,
      sourceMap,
      testMessageId,
      'gen_001'
    );

    expect(result.groundedness).toBe('SUPPORTED');
    expect(result.citations.length).toBe(2);
    expect(result.citations[0].title).toBe('Mars Colonization Handbook');
    expect(result.citations[0].pageNumber).toBe(14);
    expect(result.citations[1].title).toBe('NASA Mars Exploration Overview');

    // Verify DB persistence
    const savedCitations = await prisma.citationRecord.findMany({
      where: { messageId: testMessageId },
    });
    expect(savedCitations.length).toBe(2);
  });

  it('detects and eliminates fabricated citations not present in retrieved context', async () => {
    const { sourceMap } = service.buildGroundedContext(mockDocResults, []); // Only source [1] exists

    // Model hallucinates [42] and [99]
    const hallucinatoryResponse = 'Mars has water [1], and advanced alien bases [42], and teleportation gates [99].';

    const result = await service.validateAndPersistCitations(
      hallucinatoryResponse,
      sourceMap,
      'msg_test_fake_cite'
    );

    // Only source [1] is recognized and verified
    expect(result.citations.length).toBe(1);
    expect(result.citations[0].title).toBe('Mars Colonization Handbook');
  });

  it('marks groundedness as UNKNOWN when evidence is declared insufficient', async () => {
    const { sourceMap } = service.buildGroundedContext(mockDocResults, []);

    const insufficientEvidenceResponse = 'Based on the retrieved sources, there is insufficient evidence to determine the exact launch cost of the rocket.';

    const result = await service.validateAndPersistCitations(
      insufficientEvidenceResponse,
      sourceMap
    );

    expect(result.groundedness).toBe('UNKNOWN');
    expect(result.citations.length).toBe(0);
  });
});
