import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { memorySimilarities } from '../src/modules/memory/services/memoryVectorSearch.service.js';
import { createCharacter, createUser } from './fixtures.js';

/**
 * Each embedding is stored once (17 Oct): with pgvector the trigger fills the vector column and clears the JSON
 * copy (~11 kB per memory). Search must still find the memory. Old embeddings that can't be vectors keep JSON.
 */
const hasVector = async () =>
  ((await prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int n FROM pg_extension WHERE extname = 'vector'`))[0]?.n ?? 0) > 0;

describe('memory embedding storage', async () => {
  const pgvector = await hasVector();
  const user = await createUser();
  const character = await createCharacter();
  const memory = await prisma.memory.create({
    data: { userId: user.id, characterId: character.id, scope: 'CHARACTER_SPECIFIC', category: 'GOAL', content: 'Wants to run a marathon in Pune', importanceScore: 0.8, confidenceScore: 0.9, status: 'ACTIVE' },
  });
  afterAll(async () => {
    await prisma.memory.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  });

  const vec = Array.from({ length: 1536 }, (_, i) => Math.sin(i + 1));

  it.runIf(pgvector)('a 1536-number embedding is kept only as a vector, and search still finds it', async () => {
    const row = await prisma.memoryEmbedding.create({ data: { memoryId: memory.id, modelName: 'test', dimension: 1536, embedding: vec as never } });
    const [stored] = await prisma.$queryRawUnsafe<Array<{ has_json: boolean; has_vec: boolean }>>(
      `SELECT embedding IS NOT NULL AS has_json, embedding_vec IS NOT NULL AS has_vec FROM memory_embeddings WHERE id = $1::uuid`,
      row.id,
    );
    expect(stored).toEqual({ has_json: false, has_vec: true });
    const sims = await memorySimilarities(vec, [{ id: memory.id, content: memory.content }]);
    expect(sims.get(memory.id)).toBeGreaterThan(0.99);
  });

  it.runIf(pgvector)('an old embedding that is not 1536 numbers keeps its JSON', async () => {
    const row = await prisma.memoryEmbedding.create({ data: { memoryId: memory.id, modelName: 'old', dimension: 128, embedding: vec.slice(0, 128) as never } });
    const [stored] = await prisma.$queryRawUnsafe<Array<{ has_json: boolean; has_vec: boolean }>>(
      `SELECT embedding IS NOT NULL AS has_json, embedding_vec IS NOT NULL AS has_vec FROM memory_embeddings WHERE id = $1::uuid`,
      row.id,
    );
    expect(stored).toEqual({ has_json: true, has_vec: false });
  });
});
