/**
 * One-time fix: memories learned in a chat but saved as shared ("GLOBAL_USER") are moved back to the
 * character the user actually told (so one character never knows what you told another).
 *
 *   npx tsx scripts/maintenance/scopeChatMemories.ts            # dry run: shows what would change
 *   npx tsx scripts/maintenance/scopeChatMemories.ts --apply    # applies, after writing a backup
 *
 * Backup: scripts/maintenance/backups/scopeChatMemories.<timestamp>.json (gitignored).
 * Memories that can't be traced to a chat (e.g. added by the user themselves) are left as they are.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const shared = await p.memory.findMany({
    where: { scope: 'GLOBAL_USER', deletedAt: null, OR: [{ conversationId: { not: null } }, { sourceMessageId: { not: null } }] },
    select: { id: true, userId: true, content: true, scope: true, characterId: true, conversationId: true, sourceMessageId: true },
  });

  const plan: Array<{ id: string; characterId: string; characterName: string; content: string; before: typeof shared[number] }> = [];
  for (const m of shared) {
    let conversationId = m.conversationId;
    if (!conversationId && m.sourceMessageId) {
      conversationId = (await p.message.findUnique({ where: { id: m.sourceMessageId }, select: { conversationId: true } }))?.conversationId ?? null;
    }
    if (!conversationId) continue;
    const conv = await p.conversation.findUnique({ where: { id: conversationId }, select: { characterId: true, character: { select: { name: true } } } });
    if (!conv) continue;
    plan.push({ id: m.id, characterId: conv.characterId, characterName: conv.character.name, content: m.content, before: m });
  }

  console.log(`${plan.length} shared chat memories to move back to their character${apply ? '' : ' (dry run)'}:`);
  for (const x of plan) console.log(`  → ${x.characterName}: ${x.content.slice(0, 90)}`);
  if (!apply || plan.length === 0) return;

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `scopeChatMemories.${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(plan.map((x) => x.before), null, 2));
  console.log(`Backup written: ${backup}`);

  for (const x of plan) {
    await p.memory.update({ where: { id: x.id }, data: { scope: 'CHARACTER_SPECIFIC', characterId: x.characterId } });
  }
  console.log(`Moved ${plan.length} memories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
