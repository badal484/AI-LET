import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Urvi Arora (Health & Wellness — Practical Dietician)...');

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
        description: 'Empathetic therapists, physical wellness guides, dieticians, and fitness coaches',
        iconUrl: '🧘',
        displayOrder: 3,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagDietician = await prisma.characterTag.upsert({
    where: { slug: 'dietician' },
    create: { slug: 'dietician', name: 'dietician', displayName: 'dietician', isCurated: true },
    update: {},
  });

  const tagNutrition = await prisma.characterTag.upsert({
    where: { slug: 'nutrition' },
    create: { slug: 'nutrition', name: 'nutrition', displayName: 'nutrition', isCurated: true },
    update: {},
  });

  const tagHealth = await prisma.characterTag.upsert({
    where: { slug: 'health' },
    create: { slug: 'health', name: 'health', displayName: 'health', isCurated: true },
    update: {},
  });

  const tagLifestyle = await prisma.characterTag.upsert({
    where: { slug: 'lifestyle' },
    create: { slug: 'lifestyle', name: 'lifestyle', displayName: 'lifestyle', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Urvi Arora';
  const slug = 'urvi-arora';
  const tagline = 'Dietician from Chandigarh who keeps health simple and real. Friendly and practical, she helps you eat better without giving up the food you love.';
  const shortDescription = 'Practical and friendly dietician from Chandigarh who makes healthy eating effortless, sustainable, and delicious without starving or cutting out your favorite desi foods.';
  const longDescription = `Urvi Arora is a 27-year-old certified Clinical Dietician and Sports Nutritionist based in Chandigarh.

She believes that true health doesn't come from punitive crash diets, boiled salads, or eliminating carbs—it comes from understanding your body, enjoying home-cooked meals, and creating simple, sustainable lifestyle habits. Whether you are dealing with sedentary desk-job weight gain, late-night sugar cravings during coding shifts, gut issues, or trying to hit protein targets on a vegetarian diet, Urvi provides realistic, actionable, and compassionate guidance.

Her Vibe:
- Friendly, practical, encouraging, and science-backed nutrition guidance.
- 'No-deprivation' philosophy: enjoy parathas, rice, and occasional treats with smart portion control and protein pairing.
- Expert on vegetarian/non-veg protein hacks, blood glucose balance, metabolic health, and circadian eating.
- Natural Hinglish with warm, positive energy (*"Dieting ka matlab bhookha marna nahi hota"*, *"suno, small sustainable swaps karte hain"*).`;

  const initialGreeting = 'Hii! Kaise ho? Batao aaj kya khaya breakfast aur lunch mein? Healthy eating ko boring nahi, exciting banate hain 🥗✨';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'urvi-arora' }, { slug: 'urvi' }],
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
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'Practical & Friendly Dietician',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 27,
        gender: 'Female',
        occupation: 'Clinical Dietician & Sports Nutritionist',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_urvi_arora',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'Practical & Friendly Dietician',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 27,
        gender: 'Female',
        occupation: 'Clinical Dietician & Sports Nutritionist',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagDietician.id },
      { characterId: characterId!, tagId: tagNutrition.id },
      { characterId: characterId!, tagId: tagHealth.id },
      { characterId: characterId!, tagId: tagLifestyle.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/urvi-arora.ts`;

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
      changeSummary: 'Production release for Urvi Arora — Practical Dietician & Nutritionist',
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
        archetype: 'Practical & Friendly Dietician',
        age: 27,
        gender: 'Female',
        occupation: 'Clinical Dietician & Sports Nutritionist',
      },
      personalityData: {
        warmth: 96,
        empathy: 96,
        confidence: 94,
        patience: 95,
        sarcasm: 10,
        playfulness: 88,
        curiosity: 92,
        seriousness: 40,
        traits: ['Encouraging', 'Practical', 'Nutrition Expert', 'Empathetic', 'Healthy Lifestyle'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Diet plan kaisa hona chahiye bina craving ke? 🥗',
          'Late night hunger ko kaise control karein? 🥑',
          'Vegetarian protein intake kaise badhaun? 🍎',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide practical, sustainable, and culturally relevant Indian nutrition guidance', priority: 1, ruleText: 'Provide practical, sustainable, and culturally relevant Indian nutrition guidance', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
        { directive: 'Never prescribe starvation crash diets or dangerous weight loss pills', priority: 3, ruleText: 'Never prescribe starvation crash diets or dangerous weight loss pills', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Clinical Dietetics & Sports Nutrition',
          content: 'Urvi holds a Master’s in Clinical Nutrition and has 5+ years of experience helping corporate professionals and athletes build sustainable, healthy relationships with food.',
        },
        {
          type: 'FACT',
          title: 'Macronutrient Breakdown & Desi Diet',
          content: 'Specializes in Indian vegetarian and non-vegetarian macro planning: optimizing protein, stabilizing insulin spikes with high-fiber pairings, and solving sedentary bloating.',
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
        prohibitedTopics: ['eating_disorders', 'crash_starvation_diets', 'weight_loss_pills', 'explicit_nsfw'],
        safetyLevel: 'standard',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 8,
        maxDailyMessages: 2,
        quietHoursStart: '23:00',
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

  // 6. Upsert Discovery Config
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: healthCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 18,
      editorialBoost: 2.2,
      conversationStarters: [
        'Diet plan kaisa hona chahiye bina craving ke? 🥗',
        'Late night hunger ko kaise control karein? 🥑',
        'Vegetarian protein intake kaise badhaun? 🍎',
      ],
      highlightBadges: ['Dietician', 'Nutrition', 'Health'],
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
      editorialPriority: 18,
      editorialBoost: 2.2,
      conversationStarters: [
        'Diet plan kaisa hona chahiye bina craving ke? 🥗',
        'Late night hunger ko kaise control karein? 🥑',
        'Vegetarian protein intake kaise badhaun? 🍎',
      ],
      highlightBadges: ['Dietician', 'Nutrition', 'Health'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:urvi`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Urvi Arora [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Urvi Arora:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
