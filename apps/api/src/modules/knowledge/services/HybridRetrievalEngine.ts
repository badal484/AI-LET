import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { MemoryEmbeddingService } from '../../memory/services/memoryEmbedding.service.js';
import type { HybridSearchResult, KnowledgeSourceType } from '@ai-companion/types';

export type QueryClass =
  | 'factual'
  | 'document_specific'
  | 'personal'
  | 'character_specific'
  | 'web_research'
  | 'creative'
  | 'conversational'
  | 'tool_action';

export interface HybridSearchParams {
  query: string;
  userId: string;
  characterId?: string;
  collectionId?: string;
  documentId?: string;
  maxCandidates?: number;
  maxTokenBudget?: number;
  minCompositeScore?: number;
  semanticWeight?: number;
  lexicalWeight?: number;
}

export class HybridRetrievalEngine {
  private static instance: HybridRetrievalEngine;

  private constructor() {}

  public static getInstance(): HybridRetrievalEngine {
    if (!HybridRetrievalEngine.instance) {
      HybridRetrievalEngine.instance = new HybridRetrievalEngine();
    }
    return HybridRetrievalEngine.instance;
  }

  /**
   * Classifies user query to determine whether retrieval is warranted
   */
  public classifyQuery(query: string): QueryClass {
    const q = query.trim().toLowerCase();

    // Fast conversational guardrail
    const casualPatterns = [
      /^(hi|hello|hey|sup|yo|hiya|howdy)\b/,
      /^(how are you|how's it going|what's up|how do you do)\b/,
      /^(thanks|thank you|ok|okay|cool|awesome|great|lol|haha|bye|goodbye|good night|good morning)\b/,
    ];
    if (casualPatterns.some((p) => p.test(q)) && q.split(' ').length <= 10) {
      return 'conversational';
    }

    if (q.includes('document') || q.includes('pdf') || q.includes('file') || q.includes('notes') || q.includes('page') || q.includes('uploaded')) {
      return 'document_specific';
    }

    if (q.includes('search the web') || q.includes('research') || q.includes('latest news') || q.includes('current price') || q.includes('google')) {
      return 'web_research';
    }

    if (q.includes('about me') || q.includes('remember') || q.includes('my favorite') || q.includes('my name') || q.includes('do you know me')) {
      return 'personal';
    }

    if (q.includes('who are you') || q.includes('your lore') || q.includes('your backstory') || q.includes('tell me about yourself')) {
      return 'character_specific';
    }

    if (q.includes('write a poem') || q.includes('tell a story') || q.includes('roleplay') || q.includes('imagine')) {
      return 'creative';
    }

    return 'factual';
  }

  /**
   * Executes dual-stage Hybrid Search (Semantic + Lexical) with Reciprocal Rank Fusion (RRF)
   * Guaranteed to pre-filter by tenant authorization before ranking.
   */
  public async search(params: HybridSearchParams): Promise<HybridSearchResult[]> {
    const {
      query,
      userId,
      characterId,
      collectionId,
      documentId,
      maxCandidates = 5,
      maxTokenBudget = 1500,
      minCompositeScore = 0.005,
      semanticWeight = 0.6,
      lexicalWeight = 0.4,
    } = params;

    const queryType = this.classifyQuery(query);

    // 1. Zero-Retrieval Optimization: Do not waste database/embedding cycles on casual chat
    if (queryType === 'conversational') {
      logger.info(`HybridRetrieval: Query '${query}' classified as conversational. Bypassing retrieval.`);
      return [];
    }

    const startTime = Date.now();

    // 2. Pre-Retrieval Authorization & Candidate Filter
    const documentWhere: any = {
      status: 'INDEXED',
      OR: [
        { ownerId: userId },
        ...(characterId ? [{ characterId, visibility: { in: ['PUBLIC', 'CHARACTER_ACCESSIBLE'] } }] : []),
      ],
    };

    if (documentId) {
      documentWhere.id = documentId;
    }

    if (collectionId) {
      documentWhere.collectionLinks = {
        some: { collectionId },
      };
    }

    // Fetch authorized document IDs
    const authorizedDocs = await prisma.knowledgeDocument.findMany({
      where: documentWhere,
      select: { id: true, title: true, ownerId: true, ownerType: true, characterId: true },
    });

    if (authorizedDocs.length === 0) {
      logger.info(`HybridRetrieval: No authorized documents found for query '${query}' (user: ${userId})`);
      return [];
    }

    const docMap = new Map(authorizedDocs.map((d) => [d.id, d]));
    const targetDocIds = Array.from(docMap.keys());

    // 3. Fetch Candidate Chunks within authorized documents
    const candidateChunks = await prisma.documentChunk.findMany({
      where: {
        documentId: { in: targetDocIds },
      },
      take: 100, // Bound candidate pool
    });

    if (candidateChunks.length === 0) {
      return [];
    }

    // 4. Semantic Search Stage (Cosine Similarity over Embeddings)
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await MemoryEmbeddingService.generateEmbedding(query);
    } catch (err: any) {
      logger.warn(`HybridRetrieval: query embedding generation fallback: ${err.message}`);
    }

    const semanticScored: Array<{ chunk: typeof candidateChunks[0]; score: number }> = [];
    for (const chunk of candidateChunks) {
      let sim = 0;
      if (chunk.embedding && queryEmbedding.length > 0 && Array.isArray(chunk.embedding)) {
        sim = MemoryEmbeddingService.computeCosineSimilarity(queryEmbedding, chunk.embedding as number[]);
      }
      semanticScored.push({ chunk, score: Math.max(0, sim) });
    }
    // Sort semantic candidates descending
    semanticScored.sort((a, b) => b.score - a.score);

    // 5. Lexical Search Stage (Exact terms, phrases, identifiers, names)
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const lexicalScored: Array<{ chunk: typeof candidateChunks[0]; score: number }> = [];

    for (const chunk of candidateChunks) {
      const contentLower = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const kw of keywords) {
        if (contentLower.includes(kw)) {
          matchCount++;
        }
      }

      // Check section heading bonus
      if (chunk.sectionHeading && keywords.some((k) => chunk.sectionHeading?.toLowerCase().includes(k))) {
        matchCount += 2;
      }

      const score = keywords.length > 0 ? matchCount / (keywords.length + 1) : 0;
      lexicalScored.push({ chunk, score });
    }
    // Sort lexical candidates descending
    lexicalScored.sort((a, b) => b.score - a.score);

    // 6. Reciprocal Rank Fusion (RRF)
    const RRF_K = 60;
    const rrfScores = new Map<string, { chunk: typeof candidateChunks[0]; rrf: number; semScore: number; lexScore: number }>();

    semanticScored.forEach((item, rank) => {
      const chunkId = item.chunk.id;
      const semContribution = semanticWeight * (1 / (RRF_K + rank + 1));
      rrfScores.set(chunkId, {
        chunk: item.chunk,
        rrf: semContribution,
        semScore: item.score,
        lexScore: 0,
      });
    });

    lexicalScored.forEach((item, rank) => {
      const chunkId = item.chunk.id;
      const lexContribution = lexicalWeight * (1 / (RRF_K + rank + 1));
      const existing = rrfScores.get(chunkId);
      if (existing) {
        existing.rrf += lexContribution;
        existing.lexScore = item.score;
      } else {
        rrfScores.set(chunkId, {
          chunk: item.chunk,
          rrf: lexContribution,
          semScore: 0,
          lexScore: item.score,
        });
      }
    });

    // 7. Sort by Composite RRF Score
    const rankedResults = Array.from(rrfScores.values()).sort((a, b) => b.rrf - a.rrf);

    // 8. Apply Token Budget and Max Candidate Limits
    const finalResults: HybridSearchResult[] = [];
    let accumulatedTokens = 0;

    for (const item of rankedResults) {
      if (finalResults.length >= maxCandidates) break;
      if (item.rrf < minCompositeScore) continue;

      const chunkTokens = item.chunk.tokenCount || Math.round(item.chunk.content.length / 4);
      if (accumulatedTokens + chunkTokens > maxTokenBudget && finalResults.length > 0) {
        break; // Stop to stay strictly within prompt token budget
      }

      const doc = docMap.get(item.chunk.documentId);
      const sourceType: KnowledgeSourceType = doc?.characterId ? 'CHARACTER_KNOWLEDGE' : 'USER_DOCUMENT';

      finalResults.push({
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        documentTitle: doc?.title || 'Unknown Document',
        content: item.chunk.content,
        pageNumber: item.chunk.pageNumber,
        sectionHeading: item.chunk.sectionHeading,
        semanticScore: Number(item.semScore.toFixed(4)),
        lexicalScore: Number(item.lexScore.toFixed(4)),
        compositeScore: Number(item.rrf.toFixed(4)),
        sourceType,
        ownerId: doc?.ownerId || userId,
        metadata: item.chunk.metadata as any,
      });

      accumulatedTokens += chunkTokens;
    }

    const elapsed = Date.now() - startTime;
    logger.info(`HybridRetrieval: Retrieved ${finalResults.length} chunks in ${elapsed}ms for query '${query}'`);
    return finalResults;
  }
}
