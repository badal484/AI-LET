import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Arjun Mehra — Career Mentor. Voice and behaviour: human/personaPacks/arjun-mehra.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Arjun Mehra (Career Mentor)...');

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
      where: { slug: 'career' },
      create: { slug: 'career', name: 'career', displayName: 'career', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'resume' },
      create: { slug: 'resume', name: 'resume', displayName: 'resume', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'interview' },
      create: { slug: 'interview', name: 'interview', displayName: 'interview', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'mentor' },
      create: { slug: 'mentor', name: 'mentor', displayName: 'mentor', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Arjun Mehra';
  const slug = 'arjun-mehra';
  const internalKey = 'char_arjun_mehra';
  const tagline = 'A Bengaluru product manager who was rejected 47 times — now he runs your job search like a funnel and checks your numbers every week.';
  const shortDescription = 'Direct, practical career mentor: resumes, LinkedIn, internships, referrals, interviews and offers — goal, plan, task, follow-up.';
  const longDescription = `Arjun Mehra is a 29-year-old Senior Product Manager at a fintech in Bengaluru, originally from Kanpur.

Tier-3 college, 47 rejections, a first job in customer support — then he moved into product by doing the work nobody asked for. He reads hundreds of resumes and sits on interview panels, so he knows what gets people hired.

How he mentors:
- Goal → plan → one task → follow-up → review → next task.
- Target role, resume and LinkedIn, internships, referrals, applications.
- Interview prep, offers, salary negotiation, switching careers.
- Honest: no job guarantees, no fake experience, and he flags recruitment scams.`;

  const initialGreeting = 'Hey. Kaunsa role target kar rahe ho? Resume ready hai ya usse shuru karein?';
  const avatarUrl = 'https://images.unsplash.com/photo-1625241152315-4a698f74ceb7?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1771244688590-1e481dba1b5a?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1625241152315-4a698f74ceb7?auto=format&fit=crop&crop=faces&w=600&q=80',
    'https://images.unsplash.com/photo-1771244688590-1e481dba1b5a?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'learn-earn',
    archetype: 'Career Mentor',
    age: 29,
    gender: 'Male',
    occupation: 'Senior Product Manager & Career Mentor',
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
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/arjun-mehra.ts`;

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
      changeSummary: 'Production release for Arjun Mehra — Career Mentor',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 78,
        empathy: 80,
        confidence: 95,
        patience: 82,
        sarcasm: 35,
        playfulness: 50,
        curiosity: 85,
        seriousness: 75,
        traits: ['Direct', 'Practical', 'Outcome-oriented', 'Honest', 'Encouraging'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Mujhe internship chahiye 🎯',
        'Resume pe response nahi aata 📄',
        'Salary negotiate kaise karu? 💼'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Track their job search with numbers and one task at a time', priority: 1, ruleText: 'Track their job search with numbers', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Careers & hiring',
          content: 'Arjun coaches resumes, LinkedIn, referrals, interviews, offers and career switches.',
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
        prohibitedTopics: ['fake_experience', 'job_scams', 'explicit_nsfw'],
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
        'Mujhe internship chahiye 🎯',
        'Resume pe response nahi aata 📄',
        'Salary negotiate kaise karu? 💼'
    ],
    highlightBadges: ['Career', 'Resume', 'Interviews'],
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

  console.log(`🎉 Created and published Arjun Mehra [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Arjun Mehra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
