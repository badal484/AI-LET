import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging all seeded and demo characters and their dependent records from database...');

  // 1. Fetch all characters
  const allCharacters = await prisma.character.findMany({
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${allCharacters.length} character(s) in database:`);
  for (const c of allCharacters) {
    console.log(` - [${c.id}] ${c.name} (${c.slug})`);
  }

  const characterIds = allCharacters.map((c) => c.id);

  if (characterIds.length === 0) {
    console.log('✨ No characters found to remove. Database is already clean.');
    return;
  }

  // 2. Break circular / self FK references first
  console.log('  → Clearing currentPublishedVersionId links...');
  await prisma.character.updateMany({
    where: { id: { in: characterIds } },
    data: { currentPublishedVersionId: null },
  });

  // 3. Clear community character references if any
  console.log('  → Clearing community character associations...');
  await prisma.community.updateMany({
    where: { characterId: { in: characterIds } },
    data: { characterId: null },
  });

  // 4. Delete character similarities
  console.log('  → Deleting character similarities...');
  await prisma.characterSimilarity.deleteMany({
    where: {
      OR: [
        { characterId: { in: characterIds } },
        { similarCharacterId: { in: characterIds } },
      ],
    },
  });

  // 5. Delete signals, funnels, first sessions, search query logs, favorites
  console.log('  → Deleting user signals and negative signals...');
  await prisma.userNegativeSignal.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.userCharacterSignal.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.discoveryEventLog.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.activationFunnelLog.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.userFirstSession.updateMany({
    where: { selectedCharacterId: { in: characterIds } },
    data: { selectedCharacterId: null },
  });
  await prisma.searchQueryLog.updateMany({
    where: { clickedCharacterId: { in: characterIds } },
    data: { clickedCharacterId: null },
  });
  await prisma.userFavorite.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 6. Delete search documents, discovery configs, tag links, collections
  console.log('  → Deleting search documents & discovery configs...');
  await prisma.searchDocument.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.characterDiscoveryConfig.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.characterTagLink.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.collectionItem.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 7. Delete social capabilities, content, followers, blocks
  console.log('  → Deleting social capabilities & followers...');
  await prisma.characterSocialCapability.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.socialContent.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.characterFollow.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.safetyEvaluationLog.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.userBlock.deleteMany({
    where: { blockedCharacterId: { in: characterIds } },
  });

  // 8. Delete moderation cases, reports, appeals
  console.log('  → Deleting moderation cases & reports...');
  await prisma.moderationAppeal.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.characterReport.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.moderationCase.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 9. Delete creator products & earnings
  console.log('  → Deleting creator products & earnings...');
  await prisma.creatorEarningsLedger.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.creatorProduct.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 10. Delete evaluation test cases & traces
  console.log('  → Deleting evaluation test cases & traces...');
  await prisma.aIEvaluationTestCase.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.aIEvaluationRun.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.aIGenerationTrace.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.voiceSession.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 11. Delete proactive actions & decision logs
  console.log('  → Deleting proactive actions & decision logs...');
  await prisma.proactiveDecisionLog.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.proactiveAction.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.userReminder.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 12. Delete memories & relationships
  console.log('  → Deleting memories & relationships...');
  await prisma.memory.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.relationship.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 13. Delete chat messages & conversations
  console.log('  → Deleting chat messages & conversations...');
  const conversations = await prisma.conversation.findMany({
    where: { characterId: { in: characterIds } },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);
  if (conversationIds.length > 0) {
    await prisma.messagePart.deleteMany({
      where: { message: { conversationId: { in: conversationIds } } },
    });
    await prisma.messageGenerationMetadata.deleteMany({
      where: { message: { conversationId: { in: conversationIds } } },
    });
    await prisma.messageFeedback.deleteMany({
      where: { message: { conversationId: { in: conversationIds } } },
    });
    await prisma.message.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }

  // 14. Delete knowledge items & traits
  console.log('  → Deleting knowledge items & traits...');
  await prisma.characterKnowledge.deleteMany({
    where: { characterId: { in: characterIds } },
  });
  await prisma.characterTrait.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 15. Delete character versions
  console.log('  → Deleting character versions...');
  await prisma.characterVersion.deleteMany({
    where: { characterId: { in: characterIds } },
  });

  // 16. Delete characters
  console.log('  → Deleting characters...');
  const deleted = await prisma.character.deleteMany({
    where: { id: { in: characterIds } },
  });

  console.log(`\n🎉 Successfully removed all ${deleted.count} character(s) and their cascading data!`);
}

main()
  .catch((e) => {
    console.error('❌ Error removing seeded characters:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
