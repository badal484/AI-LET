/**
 * Replaces stored memory embeddings with real Gemini embeddings (gemini-embedding-001, 1536 dims).
 * Calls the API directly so a failed request is skipped instead of silently saving a mock vector.
 *
 * Usage: npx tsx scripts/memory/reembedMemories.ts
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';

const p = new PrismaClient();
const key = process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY'];
if (!key) throw new Error('No Gemini key (GOOGLE_AI_API_KEY / GEMINI_API_KEY).');
const MODEL = 'gemini-embedding-001';

// Only memories that don't have a real Gemini vector yet (safe to re-run).
const memories = await p.memory.findMany({
  where: { status: 'ACTIVE', deletedAt: null, NOT: { embeddings: { some: { modelName: MODEL } } } },
  select: { id: true, content: true },
});
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let done = 0;
let failed = 0;
for (let i = 0; i < memories.length; i += 50) {
  const batch = memories.slice(i, i + 50);
  // The free tier rate-limits bursts: wait and retry a few times.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(30_000 * attempt);
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map(m => ({
            model: `models/${MODEL}`,
            content: { parts: [{ text: m.content }] },
            outputDimensionality: 1536,
          })),
        }),
      },
    );
    if (res.status !== 429) break;
  }
  if (i + 50 < memories.length) await sleep(5_000);
  if (!res || !res.ok) {
    failed += batch.length;
    console.log(`batch ${i / 50 + 1}: HTTP ${res?.status} — skipped`);
    continue;
  }
  const data: any = await res.json();
  for (const [j, m] of batch.entries()) {
    const values: number[] | undefined = data.embeddings?.[j]?.values;
    if (!values?.length) {
      failed++;
      continue;
    }
    await p.$transaction([
      p.memoryEmbedding.deleteMany({ where: { memoryId: m.id } }),
      p.memoryEmbedding.create({
        data: {
          memoryId: m.id,
          modelName: MODEL,
          embeddingVersion: 'v1',
          dimension: values.length,
          embedding: values as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    done++;
  }
}
console.log(`Re-embedded ${done} memories, ${failed} skipped.`);
await p.$disconnect();
