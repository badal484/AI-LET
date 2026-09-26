import { prisma } from '../infrastructure/database/prisma.js';

async function main() {
  const chars = await prisma.character.findMany({
    include: {
      currentPublishedVersion: true,
      discoveryConfig: true,
    },
  });
  console.log('Total characters in DB:', chars.length);
  for (const c of chars) {
    console.log({
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: c.status,
      versionId: c.currentPublishedVersion?.id,
      promptSnippet: c.currentPublishedVersion?.compiledPromptSnapshot?.slice(0, 300),
    });
  }
  console.log('--- RECENT CONVERSATIONS ---');
  const convs = await prisma.conversation.findMany({
    include: { character: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });
  for (const c of convs) {
    console.log({
      id: c.id,
      charSlug: c.character?.slug,
      charCurrentVer: c.character?.currentPublishedVersionId,
      convVerId: c.characterVersionId,
      match: c.character?.currentPublishedVersionId === c.characterVersionId,
    });
  }
  await prisma.$disconnect();
}

main().catch(console.error);
