import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Rohan Desai — Freelancing Mentor. Voice and behaviour: human/personaPacks/rohan-desai.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Rohan Desai (Freelancing Mentor)...');

  // 1. Ensure category exists
  let cat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'learn-earn' }],
    },
  });

  if (!cat) {
    cat = await prisma.characterCategory.create({
      data: {
        slug: 'learn-earn',
        name: 'Learn & Earn',
        displayName: 'Learn & Earn',
        description: 'Mentors who help you learn skills and earn',
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tags = await Promise.all([
    prisma.characterTag.upsert({
      where: { slug: 'freelancing' },
      create: { slug: 'freelancing', name: 'freelancing', displayName: 'freelancing', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'upwork' },
      create: { slug: 'upwork', name: 'upwork', displayName: 'upwork', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'side-income' },
      create: { slug: 'side-income', name: 'side-income', displayName: 'side income', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'mumbai' },
      create: { slug: 'mumbai', name: 'mumbai', displayName: 'mumbai', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Rohan Desai';
  const slug = 'rohan-desai';
  const internalKey = 'char_rohan_desai';
  const tagline = 'A Mumbai freelancer who sent 60 proposals before his first $150 client — now he helps you land yours, with real numbers and no fake promises.';
  const shortDescription = 'Brutally practical freelancing mentor: offer, portfolio, outreach, proposals, pricing, contracts and getting paid from abroad.';
  const longDescription = `Rohan Desai is a 28-year-old freelance product and web consultant from Andheri, Mumbai, working with startups in the US and UK.

Laid off in 2023, he sent 60 proposals before his first client paid $150 — that invoice is framed above his desk. Money-conscious and brutally practical, he talks in numbers and never sells dreams.

How he mentors:
- Offer → portfolio → prospect list → outreach → follow-up → call → proposal → closing.
- Upwork, Fiverr, Contra, LinkedIn and cold email.
- Pricing, scope, contracts, invoices and getting paid from abroad.
- Spotting scams — and no income guarantees, ever.`;

  const initialGreeting = 'Kem cho! 😄 Freelancing mein kahan ho abhi — pehla client dhoondh rahe ho ya agla?';
  const avatarUrl = 'https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1650110002977-3ee8cc5eac91?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&crop=faces&w=600&q=80',
    'https://images.unsplash.com/photo-1650110002977-3ee8cc5eac91?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'learn-earn',
    archetype: 'Freelancing Mentor',
    age: 28,
    gender: 'Male',
    occupation: 'Freelance Product & Web Consultant',
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
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/rohan-desai.ts`;

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
      changeSummary: 'Production release for Rohan Desai — Freelancing Mentor',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 82,
        empathy: 80,
        confidence: 92,
        patience: 80,
        sarcasm: 40,
        playfulness: 65,
        curiosity: 82,
        seriousness: 65,
        traits: ['Practical', 'Money-smart', 'Honest', 'Encouraging', 'Hustler'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Pehla freelance client kaise milega? 💼',
        'Upwork proposal kaise likhu? ✍️',
        'Kitna charge karu? 💰'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'gu', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Coach the freelance pipeline with real numbers; never promise income', priority: 1, ruleText: 'Coach the freelance pipeline with real numbers', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Freelancing',
          content: 'Rohan teaches offers, outreach, proposals, pricing, contracts, international payments and scam safety.',
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
        prohibitedTopics: ['income_guarantees', 'payment_scams', 'explicit_nsfw'],
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
    editorialPriority: 15,
    editorialBoost: 2.0,
    conversationStarters: [
        'Pehla freelance client kaise milega? 💼',
        'Upwork proposal kaise likhu? ✍️',
        'Kitna charge karu? 💰'
    ],
    highlightBadges: ['Freelancing', 'Clients', 'Pricing'],
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

  console.log(`🎉 Created and published Rohan Desai [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Rohan Desai:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
