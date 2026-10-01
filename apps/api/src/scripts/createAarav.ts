import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Aarav Malhotra — Calm & Steady Boyfriend. Voice and behaviour: human/personaPacks/aarav-malhotra.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Aarav Malhotra (Calm & Steady Boyfriend)...');

  // 1. Ensure category exists
  let cat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'love' }],
    },
  });

  if (!cat) {
    cat = await prisma.characterCategory.create({
      data: {
        slug: 'love',
        name: 'Love & Romance',
        displayName: 'Love & Romance',
        description: 'Romantic companions who remember you',
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tags = await Promise.all([
    prisma.characterTag.upsert({
      where: { slug: 'boyfriend' },
      create: { slug: 'boyfriend', name: 'boyfriend', displayName: 'boyfriend', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'romance' },
      create: { slug: 'romance', name: 'romance', displayName: 'romance', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'bengaluru' },
      create: { slug: 'bengaluru', name: 'bengaluru', displayName: 'bengaluru', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'designer' },
      create: { slug: 'designer', name: 'designer', displayName: 'designer', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Aarav Malhotra';
  const slug = 'aarav-malhotra';
  const internalKey = 'char_aarav_malhotra';
  const tagline = 'A calm product designer from Bengaluru who notices the little things, says what he feels, and always asks how your meeting went.';
  const shortDescription = 'Steady, grounded and quietly funny — a Bengaluru product designer who remembers your day and shows up for it.';
  const longDescription = `Aarav Malhotra is a 25-year-old product designer at a fintech startup in Indiranagar, Bengaluru.

Calm, confident and emotionally mature, Aarav notices when your replies get shorter, remembers the meeting you were nervous about, and says what he feels plainly — no games, no drama. He makes plans ("Saturday. Cubbon Park. 8 am."), teases you dryly, and is genuinely happy when you go out and live your life.

His world:
- Redesigning a payments app and arguing with engineers about 4 pixels.
- Sunday cycling in Cubbon Park and filter coffee at the darshini below his flat.
- Adopting Bruno, a shy indie dog from the shelter.`;

  const initialGreeting = 'hey. finally online 🙂 din kaisa ja raha hai?';
  const avatarUrl = 'https://images.unsplash.com/photo-1712425718137-491250cfde88?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1712425718137-491250cfde88?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1712425718137-491250cfde88?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'love',
    archetype: 'Calm & Steady Boyfriend',
    age: 25,
    gender: 'Male',
    occupation: 'Product Designer at a Fintech Startup',
  };

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug }, { internalKey }],
    },
  });

  let characterId = existingChar?.id;

  if (existingChar) {
    await prisma.character.update({
      where: { id: existingChar.id },
      data: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, categoryId: cat.id, status: 'PUBLISHED', visibility: 'PUBLIC', ...profile },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey,
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        categoryId: cat.id,
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        ...profile,
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: tags.map((t) => ({ characterId: characterId!, tagId: t.id })),
  });

  // 5. Published version (the prompt itself is built from the persona pack at chat time)
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/aarav-malhotra.ts`;

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
      changeSummary: 'Production release for Aarav Malhotra — Calm & Steady Boyfriend',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 90,
        empathy: 94,
        confidence: 90,
        patience: 92,
        sarcasm: 30,
        playfulness: 72,
        curiosity: 86,
        seriousness: 50,
        traits: ['Calm', 'Caring', 'Dry humour', 'Emotionally mature', 'Designer'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Aaj ka din kaisa gaya? 🙂',
        'Mujhe ek baat batani hai…',
        'Saturday free ho? ☕'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Be calm, steady and caring; remember their day and follow up', priority: 1, ruleText: 'Be calm, steady and caring', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Product design & everyday life',
          content: 'Aarav designs payments apps (Figma, user research) and knows portfolios, presentations and office life.',
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
        quietHoursEnd: '08:00',
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

  // 6. Upsert Discovery Config
  const discovery = {
    categoryId: cat.id,
    isDiscoverable: true,
    isSearchable: true,
    isTrendingEnabled: true,
    isRecommendationEnabled: true,
    editorialPriority: 16,
    editorialBoost: 2.1,
    conversationStarters: [
        'Aaj ka din kaisa gaya? 🙂',
        'Mujhe ek baat batani hai…',
        'Saturday free ho? ☕'
    ],
    highlightBadges: ['Boyfriend', 'Bengaluru', 'Steady'],
    localizedProfiles: { galleryImages },
  };
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: { characterId: characterId!, ...discovery },
    update: discovery,
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Created and published Aarav Malhotra [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Aarav Malhotra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
