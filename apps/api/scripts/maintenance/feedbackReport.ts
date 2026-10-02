/**
 * Weekly feedback report: how often each character's answers helped (👍 rate), and every 👎 with what the
 * user asked, what the character said and the reason they gave — so the real causes get fixed.
 *
 *   npx tsx scripts/maintenance/feedbackReport.ts          # last 7 days
 *   npx tsx scripts/maintenance/feedbackReport.ts 30       # last 30 days
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const days = Number(process.argv[2] ?? 7);
const since = new Date(Date.now() - days * 24 * 3_600_000);

async function main() {
  const feedback = await p.messageFeedback.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { message: { select: { id: true, content: true, conversationId: true, sequenceNumber: true, conversation: { select: { character: { select: { name: true } } } } } } },
  });

  const byCharacter = new Map<string, { up: number; down: number }>();
  for (const f of feedback) {
    const name = f.message.conversation.character.name;
    const row = byCharacter.get(name) ?? { up: 0, down: 0 };
    if (f.rating === 'THUMBS_UP') row.up++;
    else row.down++;
    byCharacter.set(name, row);
  }

  console.log(`# Feedback report — last ${days} days (${feedback.length} ratings)\n`);
  console.log('Character'.padEnd(24), '👍', '👎', 'helpful');
  for (const [name, r] of [...byCharacter.entries()].sort((a, b) => b[1].down - a[1].down)) {
    const rate = Math.round((r.up / Math.max(1, r.up + r.down)) * 100);
    console.log(name.padEnd(24), String(r.up).padStart(2), String(r.down).padStart(2), `${rate}%`);
  }

  const downs = feedback.filter((f) => f.rating !== 'THUMBS_UP');
  if (downs.length) console.log(`\n## 👎 answers (${downs.length})`);
  for (const f of downs) {
    const asked = await p.message.findFirst({
      where: { conversationId: f.message.conversationId, role: 'user', sequenceNumber: { lt: f.message.sequenceNumber } },
      orderBy: { sequenceNumber: 'desc' },
      select: { content: true },
    });
    console.log(`\n- ${f.message.conversation.character.name} · ${f.createdAt.toISOString().slice(0, 10)}${f.reasonCategory ? ` · ${f.reasonCategory}` : ''}`);
    console.log(`  They asked: ${(asked?.content ?? '?').replace(/\s+/g, ' ').slice(0, 160)}`);
    console.log(`  Answer:     ${f.message.content.replace(/\s+/g, ' ').slice(0, 200)}`);
    if (f.feedbackText) console.log(`  Why:        ${f.feedbackText.replace(/\s+/g, ' ').slice(0, 200)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
