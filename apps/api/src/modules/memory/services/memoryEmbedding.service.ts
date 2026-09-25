import { prisma } from '../../../infrastructure/database/prisma.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { logger } from '../../../config/logger.js';
import type { Prisma } from '@prisma/client';

export class MemoryEmbeddingService {
  private static readonly DEFAULT_PROVIDER = 'mock';
  private static readonly DEFAULT_MODEL = 'text-embedding-3-small';
  private static readonly EMBEDDING_VERSION = 'v1';
  private static readonly DIMENSION = 1536;

  /**
   * Generates a vector embedding for a given text.
   */
  public static async generateEmbedding(
    text: string,
    providerName: string = this.DEFAULT_PROVIDER,
    modelName: string = this.DEFAULT_MODEL,
  ): Promise<number[]> {
    try {
      const result = await AIOrchestrator.generateEmbedding(providerName, modelName, text);
      return result.embedding;
    } catch (err) {
      logger.warn(`Failed to generate embedding via ${providerName}/${modelName}, generating fallback pseudo-vector: ${err instanceof Error ? err.message : 'Unknown'}`);
      return this.generateDeterministicPseudoEmbedding(text);
    }
  }

  /**
   * Generates and persists embedding for a specific Memory entity.
   */
  public static async saveMemoryEmbedding(
    memoryId: string,
    text: string,
    providerName: string = this.DEFAULT_PROVIDER,
    modelName: string = this.DEFAULT_MODEL,
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(text, providerName, modelName);

      await prisma.memoryEmbedding.create({
        data: {
          memoryId,
          modelName,
          embeddingVersion: this.EMBEDDING_VERSION,
          dimension: embedding.length || this.DIMENSION,
          embedding: embedding as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      logger.error(`Failed to save memory embedding for memoryId ${memoryId}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  /**
   * Computes cosine similarity between two numeric vector arrays.
   * Returns a float in [-1.0, 1.0].
   */
  public static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0;
    }

    const length = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < length; i++) {
      const a = vecA[i] || 0;
      const b = vecB[i] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Fallback deterministic pseudo-embedding based on character n-grams and hashing.
   * Ensures offline / mock environments produce meaningful similarity tests.
   */
  public static generateDeterministicPseudoEmbedding(text: string, dimension: number = 1536): number[] {
    const vector = new Array(dimension).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      if (!word) continue;

      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimension;
      vector[idx] += 1.0 / (w + 1);

      // Distribute bigram energy
      if (w > 0 && words[w - 1]) {
        const bigram = `${words[w - 1]}_${word}`;
        let biHash = 0;
        for (let i = 0; i < bigram.length; i++) {
          biHash = (biHash << 5) - biHash + bigram.charCodeAt(i);
          biHash |= 0;
        }
        const biIdx = Math.abs(biHash) % dimension;
        vector[biIdx] += 1.5;
      }
    }

    // Normalize to unit vector
    let norm = 0;
    for (let i = 0; i < dimension; i++) {
      norm += vector[i] * vector[i];
    }
    const sqrtNorm = Math.sqrt(norm) || 1.0;
    for (let i = 0; i < dimension; i++) {
      vector[i] = vector[i] / sqrtNorm;
    }

    return vector;
  }
}
