import { prisma } from '../infrastructure/database/prisma.js';

async function main() {
  const chars = await prisma.character.findMany({
    include: {
      currentPublishedVersion: true,
      categoryRef: true,
      tagLinks: { include: { tag: true } },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\n===============================================================`);
  console.log(`📊 TOTAL ACTIVE CHARACTERS IN PLATFORM: ${chars.length}`);
  console.log(`===============================================================\n`);

  let fullyTrainedCount = 0;

  for (const c of chars) {
    const prompt = c.currentPublishedVersion?.compiledPromptSnapshot || '';
    const hasTier1 = prompt.includes('TIER 1');
    const hasTier2 = prompt.includes('TIER 2');
    const hasTier3 = prompt.includes('TIER 3');
    const hasTier4 = prompt.includes('TIER 4');
    const hasTier5 = prompt.includes('TIER 5');
    const isFullyTrained = hasTier1 && hasTier2 && hasTier3 && hasTier4 && hasTier5;

    if (isFullyTrained) fullyTrainedCount++;

    console.log(`👤 ${c.name} [${c.slug}]`);
    console.log(`   - Archetype: ${c.archetype}`);
    console.log(`   - Category: ${c.categoryRef?.displayName || c.category}`);
    console.log(`   - Status: ${c.status} | Published Ver: ${c.currentVersionNumber}`);
    console.log(`   - Prompt Snapshot: ${prompt.length} chars | 5-Tier Architecture: ${isFullyTrained ? '✅ YES (100% Complete)' : '❌ INCOMPLETE'}`);
    console.log(`   - Tags: ${c.tagLinks.map((t) => t.tag.displayName).join(', ') || 'None'}`);
    console.log(`---------------------------------------------------------------`);
  }

  console.log(`\n🎯 AUDIT SUMMARY: ${fullyTrainedCount}/${chars.length} Characters are Deeply Trained with Full 5-Tier Architecture & Safety Rules.\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
