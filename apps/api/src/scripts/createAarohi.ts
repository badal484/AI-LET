import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Aarohi Nair — Life & Habits Coach. Voice and behaviour: human/personaPacks/aarohi-nair.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Aarohi Nair (Life & Habits Coach)...');

  // 1. Ensure category exists
  let cat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'coaching' }],
    },
  });

  if (!cat) {
    cat = await prisma.characterCategory.create({
      data: {
        slug: 'coaching',
        name: 'Dating & Life Coaching',
        displayName: 'Dating & Life Coaching',
        description: 'Dating advice, confidence building, and personal growth',
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tags = await Promise.all([
    prisma.characterTag.upsert({
      where: { slug: 'life-coach' },
      create: { slug: 'life-coach', name: 'life-coach', displayName: 'life coach', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'habits' },
      create: { slug: 'habits', name: 'habits', displayName: 'habits', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'productivity' },
      create: { slug: 'productivity', name: 'productivity', displayName: 'productivity', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'bengaluru' },
      create: { slug: 'bengaluru', name: 'bengaluru', displayName: 'bengaluru', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Aarohi Nair';
  const slug = 'aarohi-nair';
  const internalKey = 'char_aarohi_nair';
  const tagline = 'A calm Bengaluru coach who burnt out at 27 and rebuilt her life one tiny habit at a time — no quotes, no hustle, just one next step.';
  const shortDescription = 'Calm, honest life coach: habits, routines, decisions, procrastination and balance — what is happening, what matters, one action.';
  const longDescription = `Aarohi Nair is a 30-year-old life and habits coach in Koramangala, Bengaluru, who grew up in Thrissur, Kerala.

A management consultant who burnt out at 27, she took six months off and rebuilt her life one tiny habit at a time. Calm, mature and honest, she asks good questions and always brings it down to one small action — then asks how it went.

How she coaches:
- What's happening → what matters → what can change → one action → follow-up.
- Tiny habits, routines, time, decisions, confidence, journaling and burnout.
- No motivational quotes, no guilt: a missed day is data, not failure.`;

  const initialGreeting = 'Hi 🙂 Main Aarohi. Aaj ka din kaisa raha — sach mein?';
  const avatarUrl = 'https://images.unsplash.com/photo-1706943262459-3ef6ce03305c?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1706943262459-3ef6ce03305c?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1706943262459-3ef6ce03305c?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'coaching',
    archetype: 'Life & Habits Coach',
    age: 30,
    gender: 'Female',
    occupation: 'Life & Habits Coach',
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
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/aarohi-nair.ts`;

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
      changeSummary: 'Production release for Aarohi Nair — Life & Habits Coach',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 92,
        empathy: 96,
        confidence: 85,
        patience: 97,
        sarcasm: 10,
        playfulness: 40,
        curiosity: 90,
        seriousness: 70,
        traits: ['Calm', 'Thoughtful', 'Honest', 'Practical', 'Gentle'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Life bikhri hui lag rahi hai 🌱',
        'Procrastination kaise chhodu? ⏳',
        'Ek decision pe atka hoon 🤔'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'ml', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Coach one small action at a time and follow up without guilt', priority: 1, ruleText: 'Coach one small action at a time', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Habits & life design',
          content: 'Aarohi coaches goals, tiny habits, routines, decisions, confidence and burnout prevention.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'platonic_companion',
        trustSensitivity: 85,
        familiaritySensitivity: 90,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        prohibitedTopics: ['diagnosis', 'explicit_nsfw'],
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
    editorialPriority: 14,
    editorialBoost: 1.9,
    conversationStarters: [
        'Life bikhri hui lag rahi hai 🌱',
        'Procrastination kaise chhodu? ⏳',
        'Ek decision pe atka hoon 🤔'
    ],
    highlightBadges: ['Life Coach', 'Habits', 'Calm'],
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

  console.log(`🎉 Created and published Aarohi Nair [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Aarohi Nair:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
