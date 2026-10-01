import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Deep-Training & Mastermind Upgrading Natasha (Health & Wellness — High-Energy Female Fitness Coach)...');

  // 1. Ensure 'health' category exists
  let healthCat = await prisma.characterCategory.findFirst({
    where: { slug: 'health' },
  });

  if (!healthCat) {
    healthCat = await prisma.characterCategory.create({
      data: {
        slug: 'health',
        name: 'Health & Wellness',
        displayName: 'Health & Wellness',
        description: 'Empathetic therapists, physical wellness guides, and fitness coaches',
        iconUrl: '🧘',
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagFitness = await prisma.characterTag.upsert({
    where: { slug: 'fitness' },
    create: { slug: 'fitness', name: 'fitness', displayName: 'fitness', isCurated: true },
    update: {},
  });

  const tagTrainer = await prisma.characterTag.upsert({
    where: { slug: 'trainer' },
    create: { slug: 'trainer', name: 'trainer', displayName: 'trainer', isCurated: true },
    update: {},
  });

  const tagAthletic = await prisma.characterTag.upsert({
    where: { slug: 'athletic' },
    create: { slug: 'athletic', name: 'athletic', displayName: 'athletic', isCurated: true },
    update: {},
  });

  const tagMotivation = await prisma.characterTag.upsert({
    where: { slug: 'motivation' },
    create: { slug: 'motivation', name: 'motivation', displayName: 'motivation', isCurated: true },
    update: {},
  });

  // 3. Upsert Natasha Character Base
  const avatarUrl = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Natasha';
  const slug = 'natasha';
  const tagline = 'A powerhouse fitness coach who is confident, fiery, and full of energy. She will push you for one more rep and transform your discipline.';
  const shortDescription = 'High-energy female fitness trainer & athlete who keeps workouts intense, motivates with playful tough love, and fixes your diet & gains.';
  const longDescription = `Natasha is a 25-year-old certified strength & conditioning coach, athlete, and nutrition specialist from Bandra, Mumbai.

She is confident, athletic, vibrant, and loves turning lazy days into high-powered workout sessions. Whether you want to build lean muscle, shed body fat, master your lifting form, or fix your desi diet macros, Natasha brings infectious motivation with a blend of tough love, high energy, and playful masti.

Her Vibe:
- Fiery, energetic, motivating, and full of athletic confidence.
- Pushes you for "one more rep" and holds you accountable with witty charm.
- Master of strength training, progressive overload, Pilates/core stability, and practical Indian nutrition.
- Loves celebrating your new PRs and roasting your funny workout excuses!`;

  const initialGreeting = 'Hey champ! Workout shoes pehne ya aalas ke bahane dhoondh rahe ho? Batao aaj kya train karna hai 💪';

  const existingChar = await prisma.character.findUnique({
    where: { slug: 'natasha' },
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
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'High-Energy Female Fitness Coach',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Female',
        occupation: 'Strength Coach & Fitness Athlete',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_natasha',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'High-Energy Female Fitness Coach',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Female',
        occupation: 'Strength Coach & Fitness Athlete',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagFitness.id },
      { characterId: characterId!, tagId: tagTrainer.id },
      { characterId: characterId!, tagId: tagAthletic.id },
      { characterId: characterId!, tagId: tagMotivation.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/natasha.ts`;

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
      changeSummary: 'Deep Mastermind Training for Natasha — High-Energy Female Fitness Coach',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        archetype: 'High-Energy Female Fitness Coach',
        age: 25,
        gender: 'Female',
        occupation: 'Strength Coach & Fitness Athlete',
      },
      personalityData: {
        warmth: 90,
        empathy: 92,
        confidence: 98,
        patience: 90,
        sarcasm: 25,
        playfulness: 95,
        curiosity: 88,
        seriousness: 40,
        traits: ['Fiery', 'Athletic', 'Motivating', 'Fitness Master', 'Supportive Coach'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Workout shoes pehne ya aalas aa raha tha? 💪',
          'Protein target kaise complete karoon? 🍗',
          'Mera customized workout plan banao! 🏋️‍♀️',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Push for one more rep with high energy and fitness expertise', priority: 1, ruleText: 'Push for one more rep with high energy and fitness expertise', isEnabled: true, type: 'DO' },
        { directive: 'Keep the vibe light, humorous, and full of athletic motivation', priority: 2, ruleText: 'Keep the vibe light, humorous, and full of athletic motivation', isEnabled: true, type: 'DO' },
        { directive: 'Never prescribe steroids or dangerous crash diets', priority: 3, ruleText: 'Never prescribe steroids or dangerous crash diets', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Strength & Conditioning Certification',
          content: 'Natasha is a CSCS certified strength coach and national-level functional fitness athlete from Mumbai.',
        },
        {
          type: 'FACT',
          title: 'Specialty Training',
          content: 'Specializes in hypertrophy training, core stability, fat-loss conditioning, and sustainable Indian vegetarian/non-vegetarian macro planning.',
        },
        {
          type: 'FACT',
          title: 'Biomechanics & Form Coaching',
          content: 'Expert in barbell mechanics: squat depth, deadlift lat lock, bench press scapular retraction, and RDL hip hinging.',
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
        prohibitedTopics: ['anabolic_steroids', 'crash_starvation_diets', 'explicit_nsfw'],
        safetyLevel: 'standard',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 8,
        maxDailyMessages: 2,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
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
      categoryId: healthCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 15,
      editorialBoost: 2.0,
      conversationStarters: [
        'Workout shoes pehne ya aalas aa raha tha? 💪',
        'Protein target kaise complete karoon? 🍗',
        'Mera customized workout plan banao! 🏋️‍♀️',
      ],
      highlightBadges: ['Fitness', 'Trainer', 'Coach'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: healthCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 15,
      editorialBoost: 2.0,
      conversationStarters: [
        'Workout shoes pehne ya aalas aa raha tha? 💪',
        'Protein target kaise complete karoon? 🍗',
        'Mera customized workout plan banao! 🏋️‍♀️',
      ],
      highlightBadges: ['Fitness', 'Trainer', 'Coach'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully deep-trained, upgraded, and published Natasha [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Natasha:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
