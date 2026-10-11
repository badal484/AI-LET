import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { MemoryEmbeddingService } from './memoryEmbedding.service.js';

/**
 * Cosine similarity between a query embedding and some memories, computed inside Postgres (pgvector,
 * column memory_embeddings.embedding_vec) — only ids and scores come back, never the 1,536-number
 * embeddings. Exact (no index approximation): every search is limited to one person's memories.
 *
 * Without pgvector (column missing) it falls back to loading the JSON embeddings and comparing in Node.
 * Memories without a usable embedding are compared on a cheap text fingerprint, as before.
 */

let vectorAvailable: boolean | null = null;

async function hasVectorColumn(): Promise<boolean> {
  if (vectorAvailable !== null) return vectorAvailable;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_embeddings' AND column_name = 'embedding_vec') ok`,
    );
    vectorAvailable = Boolean(rows[0]?.ok);
  } catch {
    vectorAvailable = false;
  }
  if (!vectorAvailable) logger.warn('pgvector column missing: memory similarity runs in Node (slower at scale).');
  return vectorAvailable;
}

/** Similarity in [-1, 1] per memory id. */
export async function memorySimilarities(
  query: number[],
  memories: Array<{ id: string; content: string }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!memories.length) return out;
  const ids = memories.map((m) => m.id);

  if (query.length === 1536 && (await hasVectorColumn())) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sim: number }>>(
        `SELECT DISTINCT ON (memory_id) memory_id::text id, 1 - (embedding_vec <=> $1::vector) sim
           FROM memory_embeddings
          WHERE memory_id = ANY($2::uuid[]) AND embedding_vec IS NOT NULL
          ORDER BY memory_id, created_at DESC`,
        `[${query.join(',')}]`,
        ids,
      );
      for (const r of rows) out.set(r.id, Number(r.sim));
    } catch (err) {
      vectorAvailable = false;
      logger.warn('pgvector similarity failed; using Node', { error: err instanceof Error ? err.message : err });
    }
  }

  // Fallback (no pgvector) — the old way, only for memories still without a score.
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length && !vectorAvailable) {
    const embs = await prisma.memoryEmbedding.findMany({
      where: { memoryId: { in: missing } },
      select: { memoryId: true, embedding: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const e of embs) {
      if (out.has(e.memoryId) || !Array.isArray(e.embedding)) continue;
      out.set(e.memoryId, MemoryEmbeddingService.computeCosineSimilarity(query, e.embedding as unknown as number[]));
    }
  }

  // No usable embedding (old 128-number ones, or none yet): text fingerprint, as before.
  for (const m of memories) {
    if (!out.has(m.id)) {
      out.set(m.id, MemoryEmbeddingService.computeCosineSimilarity(query, MemoryEmbeddingService.generateDeterministicPseudoEmbedding(m.content)));
    }
  }
  return out;
}
