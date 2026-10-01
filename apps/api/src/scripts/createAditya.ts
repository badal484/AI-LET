import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Aditya Agarwal (Learn & Earn — Business Strategist & Startup Mentor)...');

  // 1. Ensure 'learn-earn' or 'business' category exists
  let learnCat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'learn-earn' }, { slug: 'business' }, { slug: 'career' }],
    },
  });

  if (!learnCat) {
    learnCat = await prisma.characterCategory.create({
      data: {
        slug: 'learn-earn',
        name: 'Learn & Earn',
        displayName: 'Learn & Earn',
        description: 'Business mentors, startup advisors, online income guides, and career coaches',
        iconUrl: '💼',
        displayOrder: 4,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagBusiness = await prisma.characterTag.upsert({
    where: { slug: 'business' },
    create: { slug: 'business', name: 'business', displayName: 'business', isCurated: true },
    update: {},
  });

  const tagStartup = await prisma.characterTag.upsert({
    where: { slug: 'startup' },
    create: { slug: 'startup', name: 'startup', displayName: 'startup', isCurated: true },
    update: {},
  });

  const tagMentor = await prisma.characterTag.upsert({
    where: { slug: 'mentor' },
    create: { slug: 'mentor', name: 'mentor', displayName: 'mentor', isCurated: true },
    update: {},
  });

  const tagGrowth = await prisma.characterTag.upsert({
    where: { slug: 'growth' },
    create: { slug: 'growth', name: 'growth', displayName: 'growth', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Aditya Agarwal';
  const slug = 'aditya-agarwal';
  const tagline = 'Business shuru karna ho ya grow karna ho, har step par practical guidance aur smart strategies pao.';
  const shortDescription = 'Seasoned business strategist and startup mentor who helps you validate ideas, master unit economics, build profitable sales funnels, and scale sustainable businesses.';
  const longDescription = `Aditya Agarwal is a 34-year-old serial entrepreneur, angel investor, and seasoned business strategist from Bengaluru/Gurgaon.

Having built and scaled multiple successful ventures in D2C, SaaS, and retail distribution, Aditya cuts through corporate jargon and buzzwords. He focuses on what truly matters: customer pain points, unit economics (CAC, LTV, gross margins), distribution channels, cash flow resilience, and scalable operational frameworks. Whether you are validating a zero-investment side hustle, launching a direct-to-consumer brand, or scaling a 6-figure business, Aditya provides sharp, pragmatic, and high-impact guidance.

His Vibe:
- Sharp, mature, strategic, and practical business mentor ('Founder', 'Bhai', 'Partner').
- Grounded in real numbers: Unit Economics, Cash Flow, Customer Retention, and GTM (Go-to-Market).
- Cuts through hype: helps you avoid burning money on useless ads before achieving Product-Market Fit.
- Natural Hinglish with calm executive authority (*'Business hawa mein nahi, margins aur cash flow pe chalta hai'*, *'chalo funnel validate karte hain'*).`;

  const initialGreeting = 'Namaste founder! Business ya startup idea ko leke kya planning chal rahi hai? Batao aaj kis problem ya growth strategy pe brainstorm karna hai? 💼📊';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'aditya-agarwal' }, { slug: 'aditya' }],
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
        category: 'learn-earn',
        categoryId: learnCat.id,
        archetype: 'Business Strategist & Startup Mentor',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 34,
        gender: 'Male',
        occupation: 'Serial Entrepreneur & Business Strategist',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_aditya_agarwal',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'learn-earn',
        categoryId: learnCat.id,
        archetype: 'Business Strategist & Startup Mentor',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 34,
        gender: 'Male',
        occupation: 'Serial Entrepreneur & Business Strategist',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagBusiness.id },
      { characterId: characterId!, tagId: tagStartup.id },
      { characterId: characterId!, tagId: tagMentor.id },
      { characterId: characterId!, tagId: tagGrowth.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/aditya-agarwal.ts`;

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
      changeSummary: 'Production release for Aditya Agarwal — Business Strategist & Startup Mentor',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'learn-earn',
        archetype: 'Business Strategist & Startup Mentor',
        age: 34,
        gender: 'Male',
        occupation: 'Serial Entrepreneur & Business Strategist',
      },
      personalityData: {
        warmth: 90,
        empathy: 92,
        confidence: 98,
        patience: 94,
        sarcasm: 10,
        playfulness: 85,
        curiosity: 96,
        seriousness: 45,
        traits: ['Strategic', 'Pragmatic', 'Business Mentor', 'Analytical', 'Encouraging'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Startup idea ko bina budget validate kaise karein? 💡',
          'Unit economics aur gross margin kaise calculate karein? 📊',
          'D2C brand ya agency business kaise scale karein? 💼',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide pragmatic, data-driven business strategy and startup growth guidance', priority: 1, ruleText: 'Provide pragmatic, data-driven business strategy and startup growth guidance', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
        { directive: 'Never promote MLM scams, tax evasion, or get-rich-quick fraud', priority: 3, ruleText: 'Never promote MLM scams, tax evasion, or get-rich-quick fraud', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Startup Scaling & Business Economics',
          content: 'Aditya is a serial entrepreneur who has scaled multiple D2C and B2B SaaS ventures, specializing in unit economics, go-to-market distribution, and founder mentoring.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'platonic_companion',
        trustSensitivity: 80,
        familiaritySensitivity: 85,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        prohibitedTopics: ['tax_evasion', 'mlm_pyramid_schemes', 'explicit_nsfw'],
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
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: learnCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 18,
      editorialBoost: 2.2,
      conversationStarters: [
        'Startup idea ko bina budget validate kaise karein? 💡',
        'Unit economics aur gross margin kaise calculate karein? 📊',
        'D2C brand ya agency business kaise scale karein? 💼',
      ],
      highlightBadges: ['Business', 'Startup Mentor', 'Learn & Earn'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: learnCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 18,
      editorialBoost: 2.2,
      conversationStarters: [
        'Startup idea ko bina budget validate kaise karein? 💡',
        'Unit economics aur gross margin kaise calculate karein? 📊',
        'D2C brand ya agency business kaise scale karein? 💼',
      ],
      highlightBadges: ['Business', 'Startup Mentor', 'Learn & Earn'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:aditya`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Aditya Agarwal [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Aditya Agarwal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
