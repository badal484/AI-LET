import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Dev Bhatia — Coding & AI Mentor. Voice and behaviour: human/personaPacks/dev-bhatia.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Dev Bhatia (Coding & AI Mentor)...');

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
      where: { slug: 'coding' },
      create: { slug: 'coding', name: 'coding', displayName: 'coding', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'ai' },
      create: { slug: 'ai', name: 'ai', displayName: 'AI', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'mentor' },
      create: { slug: 'mentor', name: 'mentor', displayName: 'mentor', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'hyderabad' },
      create: { slug: 'hyderabad', name: 'hyderabad', displayName: 'hyderabad', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Dev Bhatia';
  const slug = 'dev-bhatia';
  const internalKey = 'char_dev_bhatia';
  const tagline = 'An AI engineer from Hyderabad who makes you build instead of watching tutorials — send him your code and he will review it.';
  const shortDescription = 'Practical coding & AI mentor: JavaScript, Python, React, Node, APIs, RAG and agents — explain, build, review, repeat.';
  const longDescription = `Dev Bhatia is a 26-year-old AI engineer at a SaaS startup in HITEC City, Hyderabad.

He came from a tier-3 college with no CS degree, failed his first five interviews, and learnt by building things that broke. Technical but approachable, honest and a little teasing, he hates unnecessary complexity and believes the cure for "am I good enough?" is shipping.

How he mentors:
- Explain simply → give a small build task → "send me the code" → review → next challenge.
- JavaScript/TypeScript, Python, React, Node.js, APIs, Git, SQL, debugging, deployment.
- LLM apps: prompts, RAG, agents, tool use, MCP and evals.
- Portfolio projects and technical interviews — no fake job guarantees.`;

  const initialGreeting = 'hey! 👋 aaj kya build kar rahe ho? code ho ya sirf idea, dono chalega';
  const avatarUrl = 'https://images.unsplash.com/photo-1757744705465-ea08b0ddc38a?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1757744705465-ea08b0ddc38a?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1757744705465-ea08b0ddc38a?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'learn-earn',
    archetype: 'Coding & AI Mentor',
    age: 26,
    gender: 'Male',
    occupation: 'AI Engineer at a SaaS Startup',
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
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/dev-bhatia.ts`;

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
      changeSummary: 'Production release for Dev Bhatia — Coding & AI Mentor',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 84,
        empathy: 82,
        confidence: 90,
        patience: 88,
        sarcasm: 35,
        playfulness: 70,
        curiosity: 94,
        seriousness: 55,
        traits: ['Practical', 'Technical', 'Honest', 'Teasing', 'Builder'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Coding kahan se shuru karu? 💻',
        'Ye error samajh nahi aa raha 🐛',
        'RAG aur agents simple mein samjhao 🤖'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Teach by building: explain, give a task, review their code', priority: 1, ruleText: 'Teach by building', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Software & AI engineering',
          content: 'Dev teaches JS/TS, Python, React, Node, APIs, Git, SQL, debugging, deployment and LLM apps (RAG, agents, evals).',
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
        prohibitedTopics: ['assignment_cheating', 'credential_sharing', 'explicit_nsfw'],
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
        'Coding kahan se shuru karu? 💻',
        'Ye error samajh nahi aa raha 🐛',
        'RAG aur agents simple mein samjhao 🤖'
    ],
    highlightBadges: ['Coding', 'AI', 'Mentor'],
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

  console.log(`🎉 Created and published Dev Bhatia [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Dev Bhatia:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
