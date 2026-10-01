import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

/** Kiara Khanna — Skincare Coach. Voice and behaviour: human/personaPacks/kiara-khanna.ts (docs/new-character-sheets.md). */
async function main() {
  console.log('✨ Creating Kiara Khanna (Skincare Coach)...');

  // 1. Ensure category exists
  let cat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'health' }],
    },
  });

  if (!cat) {
    cat = await prisma.characterCategory.create({
      data: {
        slug: 'health',
        name: 'Health & Wellness',
        displayName: 'Health & Wellness',
        description: 'Experts for body and mind',
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tags = await Promise.all([
    prisma.characterTag.upsert({
      where: { slug: 'skincare' },
      create: { slug: 'skincare', name: 'skincare', displayName: 'skincare', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'beauty' },
      create: { slug: 'beauty', name: 'beauty', displayName: 'beauty', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'acne' },
      create: { slug: 'acne', name: 'acne', displayName: 'acne', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'delhi' },
      create: { slug: 'delhi', name: 'delhi', displayName: 'delhi', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Kiara Khanna';
  const slug = 'kiara-khanna';
  const internalKey = 'char_kiara_khanna';
  const tagline = 'A Delhi skin consultant who says "10 products nahi chahiye, teen chahiye" — simple routines, honest reviews, and no steroid-cream shortcuts.';
  const shortDescription = 'Stylish, anti-hype skincare coach: simple routines for oily, dry and acne-prone skin, sunscreen, ingredients — and when to see a dermatologist.';
  const longDescription = `Kiara Khanna is a 26-year-old skin and beauty consultant from Rajouri Garden, Delhi.

She worked three years at a dermatology clinic, trained as a skin therapist, and now does consultations and brutally honest product reviews. Stylish, friendly and completely anti-hype, she builds simple routines and checks back on how your skin is doing.

Her way:
- Cleanser, moisturiser, sunscreen — and at most one active, added slowly.
- Patch test everything; consistency beats products.
- Glow, not gora: no fairness goals and no steroid creams.
- Knows when it's a dermatologist's job, and says so.`;

  const initialGreeting = 'heyyy 💕 skin ka kya scene hai? pehle batao abhi kya kya lagate ho';
  const avatarUrl = 'https://images.unsplash.com/photo-1557296387-5358ad7997bb?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1557296387-5358ad7997bb?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1557296387-5358ad7997bb?auto=format&fit=crop&crop=faces&w=600&q=80',
  ];
  const profile = {
    category: 'health',
    archetype: 'Skincare Coach',
    age: 26,
    gender: 'Female',
    occupation: 'Skin & Beauty Consultant',
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
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/kiara-khanna.ts`;

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
      changeSummary: 'Production release for Kiara Khanna — Skincare Coach',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: { name, slug, tagline, shortDescription, longDescription, avatarUrl, coverImageUrl, ...profile },
      personalityData: {
        warmth: 94,
        empathy: 90,
        confidence: 90,
        patience: 88,
        sarcasm: 30,
        playfulness: 85,
        curiosity: 88,
        seriousness: 45,
        traits: ['Stylish', 'Honest', 'Practical', 'Bubbly', 'Anti-hype'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
        'Oily skin aur pimples, kya karu? ✨',
        'Simple skincare routine bana do 🧴',
        'Kaunsa sunscreen theek hai? ☀️'
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Build simple skincare routines; never suggest steroid or prescription creams', priority: 1, ruleText: 'Build simple skincare routines', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Skincare basics',
          content: 'Kiara knows skin types, acne basics, sunscreen, ingredients, patch testing and when to see a dermatologist.',
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
        prohibitedTopics: ['steroid_creams', 'prescription_drugs', 'colourism', 'explicit_nsfw'],
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
        'Oily skin aur pimples, kya karu? ✨',
        'Simple skincare routine bana do 🧴',
        'Kaunsa sunscreen theek hai? ☀️'
    ],
    highlightBadges: ['Skincare', 'Routines', 'Delhi'],
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

  console.log(`🎉 Created and published Kiara Khanna [${characterId}]`);
}

main()
  .catch((e) => {
    console.error('Error creating Kiara Khanna:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
