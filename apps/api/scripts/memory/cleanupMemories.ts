/**
 * Finds saved memories that aren't real facts about the user's life — things about the chat or the AI,
 * or the character's own stories saved as if the user said them — and (with --apply) soft-deletes them
 * the same way "forget" does (status DELETED + embeddings removed).
 *
 * Usage: npx tsx scripts/memory/cleanupMemories.ts            (dry run: lists what would go)
 *        npx tsx scripts/memory/cleanupMemories.ts --apply    (deletes them)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { junkReason } from '../../src/modules/memory/services/memoryExtraction.service.js';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const memories = await p.memory.findMany({
  where: { status: 'ACTIVE', deletedAt: null },
  select: {
    id: true,
    content: true,
    sourceMessageId: true,
    conversationId: true,
    character: { select: { slug: true } },
  },
});

const drop: Array<{ id: string; slug?: string; content: string; reason: string }> = [];
for (const m of memories) {
  let userText = '';
  let reply: string | undefined;
  if (m.sourceMessageId) {
    const src = await p.message.findUnique({
      where: { id: m.sourceMessageId },
      select: { content: true, sequenceNumber: true, conversationId: true },
    });
    if (src) {
      userText = src.content;
      const next = await p.message.findMany({
        where: {
          conversationId: src.conversationId,
          role: 'assistant',
          sequenceNumber: { gt: src.sequenceNumber },
        },
        orderBy: { sequenceNumber: 'asc' },
        take: 4,
        select: { content: true },
      });
      // The reply the user was answering (just before) also counts as the character's words.
      const before = await p.message.findMany({
        where: {
          conversationId: src.conversationId,
          role: 'assistant',
          sequenceNumber: { lt: src.sequenceNumber },
        },
        orderBy: { sequenceNumber: 'desc' },
        take: 3,
        select: { content: true },
      });
      reply = [...before, ...next].map(x => x.content).join(' ');
    }
  }
  const reason = junkReason(m.content, userText, reply);
  if (reason) drop.push({ id: m.id, slug: m.character?.slug, content: m.content, reason });
}

for (const d of drop) console.log(`${d.slug ?? '-'} | ${d.reason} | ${d.content}`);
console.log(
  `\n${drop.length} of ${memories.length} active memories ${apply ? 'deleted' : 'would be deleted (dry run)'}.`,
);

if (apply && drop.length) {
  const ids = drop.map(d => d.id);
  await p.memory.updateMany({
    where: { id: { in: ids } },
    data: { status: 'DELETED', deletedAt: new Date() },
  });
  await p.memoryEmbedding.deleteMany({ where: { memoryId: { in: ids } } });
}
await p.$disconnect();
