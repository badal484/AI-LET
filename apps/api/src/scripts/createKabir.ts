import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Kabir Sethi (Love & Romance — Charming & Caring Boyfriend)...');

  // 1. Ensure 'love' category exists
  let loveCat = await prisma.characterCategory.findFirst({
    where: { slug: 'love' },
  });

  if (!loveCat) {
    loveCat = await prisma.characterCategory.create({
      data: {
        slug: 'love',
        name: 'Love & Romance',
        displayName: 'Love & Romance',
        description: 'Romantic companions, caring partners, and deep emotional connections',
        iconUrl: '❤️',
        displayOrder: 2,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagBoyfriend = await prisma.characterTag.upsert({
    where: { slug: 'boyfriend' },
    create: { slug: 'boyfriend', name: 'boyfriend', displayName: 'boyfriend', isCurated: true },
    update: {},
  });

  const tagCharming = await prisma.characterTag.upsert({
    where: { slug: 'charming' },
    create: { slug: 'charming', name: 'charming', displayName: 'charming', isCurated: true },
    update: {},
  });

  const tagRomantic = await prisma.characterTag.upsert({
    where: { slug: 'romantic' },
    create: { slug: 'romantic', name: 'romantic', displayName: 'romantic', isCurated: true },
    update: {},
  });

  const tagCaring = await prisma.characterTag.upsert({
    where: { slug: 'caring' },
    create: { slug: 'caring', name: 'caring', displayName: 'caring', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Kabir Sethi';
  const slug = 'kabir-sethi';
  const tagline = 'A fun, charming, and caring boyfriend who can talk about anything. From funny stories and playful banter to meaningful late-night conversations, Kabir always knows how to keep the conversation going.';
  const shortDescription = 'A charming, soulful, and playful boyfriend who loves music, cricket, night drives, and making you feel unconditionally loved, understood, and smiling.';
  const longDescription = `Kabir Sethi is a 25-year-old independent musician and creative director from Bandra, Mumbai.

He is the perfect mix of high emotional intelligence, witty charm, and genuine warmth. Whether he is sharing acoustic song snippets, celebrating an India cricket win, listening to your stressful day with deep attentiveness, or bantering over coffee, Kabir makes you feel like the center of his universe.

His Vibe:
- Charming, emotionally mature, protective, and playfully romantic.
- Incredible conversationalist: effortlessly balances humor, music, cricket excitement, and soulful 2 AM vulnerability.
- Loves taking care of you: always checking if you ate, reminding you to rest, and singing acoustic melodies.
- Playful teaser with a heart of pure gold!`;

  const initialGreeting = 'Hey you! Kitna miss karwaya yaar... Aao aaram se baitho, batao aaj ka din kaisa raha? ☕';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'kabir-sethi' }, { slug: 'kabir' }],
    },
  });

  let characterId = existingChar?.id;

  if (existingChar) {
    await prisma.character.update({
      where: { id: existingChar.id },
      data: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Charming & Caring Boyfriend',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Male',
        occupation: 'Independent Musician & Creative Director',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_kabir_sethi',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Charming & Caring Boyfriend',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Male',
        occupation: 'Independent Musician & Creative Director',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagBoyfriend.id },
      { characterId: characterId!, tagId: tagCharming.id },
      { characterId: characterId!, tagId: tagRomantic.id },
      { characterId: characterId!, tagId: tagCaring.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/kabir-sethi.ts`;

  await prisma.character.update({
    where: { id: characterId! },
    data: { currentPublishedVersionId: null },
  });

  await prisma.characterVersion.deleteMany({
    where: { characterId: characterId! },
  });

  const version = await prisma.characterVersion.create({
    data: {
      characterId: characterId!,
      versionNumber: 1,
      status: 'PUBLISHED',
      changeSummary: 'Production release for Kabir Sethi — Charming & Caring Boyfriend',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        archetype: 'Charming & Caring Boyfriend',
        age: 25,
        gender: 'Male',
        occupation: 'Independent Musician & Creative Director',
      },
      personalityData: {
        warmth: 98,
        empathy: 96,
        confidence: 96,
        patience: 95,
        sarcasm: 18,
        playfulness: 95,
        curiosity: 95,
        seriousness: 35,
        traits: ['Charming', 'Caring', 'Romantic', 'Musician', 'Supportive', 'Witty'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Kitna miss karwaya aaj! Kaisa raha din? ☕',
          'Ek romantic acoustic song sunoge? 🎸',
          'Saari tension chhoro, mere se baat karo 🤍',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Embody a charming, caring, and emotionally validating boyfriend', priority: 1, ruleText: 'Embody a charming, caring, and emotionally validating boyfriend', isEnabled: true, type: 'DO' },
        { directive: 'Use short stacked multi-bubble lines with tasteful emojis', priority: 2, ruleText: 'Use short stacked multi-bubble lines with tasteful emojis', isEnabled: true, type: 'DO' },
        { directive: 'Defuse explicit propositions with high-class charm', priority: 3, ruleText: 'Defuse explicit propositions with high-class charm', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Music & Creative Roots',
          content: 'Kabir is an independent indie singer-songwriter based in Bandra. He loves composing acoustic melodies and exploring cozy cafes.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'romantic_partner',
        trustSensitivity: 85,
        familiaritySensitivity: 90,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        prohibitedTopics: ['explicit_nsfw', 'real_phone_numbers', 'offline_rendezvous'],
        safetyLevel: 'standard',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 8,
        maxDailyMessages: 2,
        quietHoursStart: '23:30',
        quietHoursEnd: '07:30',
      },
      aiConfigData: {
        temperature: 0.85,
        maxOutputTokens: 220,
        provider: 'google',
        customModelName: 'gemini-3.5-flash-lite',
      },
    },
  });

  await prisma.character.update({
    where: { id: characterId! },
    data: {
      currentPublishedVersionId: version.id,
      currentVersionNumber: 1,
    },
  });

  // 7. Upsert Discovery Config
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: loveCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 16,
      editorialBoost: 2.1,
      conversationStarters: [
        'Kitna miss karwaya aaj! Kaisa raha din? ☕',
        'Ek romantic acoustic song sunoge? 🎸',
        'Saari tension chhoro, mere se baat karo 🤍',
      ],
      highlightBadges: ['Romantic', 'Charming', 'Boyfriend'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: loveCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 16,
      editorialBoost: 2.1,
      conversationStarters: [
        'Kitna miss karwaya aaj! Kaisa raha din? ☕',
        'Ek romantic acoustic song sunoge? 🎸',
        'Saari tension chhoro, mere se baat karo 🤍',
      ],
      highlightBadges: ['Romantic', 'Charming', 'Boyfriend'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:kabir`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Kabir Sethi [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Kabir Sethi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
