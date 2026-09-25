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
      visibility: c.visibility,
      hasPublishedVersion: !!c.currentPublishedVersion,
      discoveryConfig: c.discoveryConfig,
    });
  }
  await prisma.$disconnect();
}

main().catch(console.error);
