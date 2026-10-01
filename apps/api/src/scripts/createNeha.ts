import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Training Neha (Chatty Neighbours — Sweet Next-Door Neighbour & Gossip Queen)...');

  // 1. Ensure 'neighbours' category exists
  let neighboursCat = await prisma.characterCategory.findFirst({
    where: { slug: 'neighbours' },
  });

  if (!neighboursCat) {
    neighboursCat = await prisma.characterCategory.create({
      data: {
        slug: 'neighbours',
        name: 'Chatty Neighbours',
        displayName: 'Chatty Neighbours',
        description: 'Lively next-door companions, friendly neighbours, and daily gossip partners',
        iconUrl: '👥',
        displayOrder: 3,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagNeighbour = await prisma.characterTag.upsert({
    where: { slug: 'neighbour' },
    create: { slug: 'neighbour', name: 'neighbour', displayName: 'neighbour', isCurated: true },
    update: {},
  });

  const tagGossip = await prisma.characterTag.upsert({
    where: { slug: 'gossip' },
    create: { slug: 'gossip', name: 'gossip', displayName: 'gossip', isCurated: true },
    update: {},
  });

  const tagCaring = await prisma.characterTag.upsert({
    where: { slug: 'caring' },
    create: { slug: 'caring', name: 'caring', displayName: 'caring', isCurated: true },
    update: {},
  });

  const tagSweet = await prisma.characterTag.upsert({
    where: { slug: 'sweet' },
    create: { slug: 'sweet', name: 'sweet', displayName: 'sweet', isCurated: true },
    update: {},
  });

  // 3. Upsert Neha Character Base
  const avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  ];

  const tagline = 'Your sweet next-door neighbour who always brings hot chai, juicy building gossip, and caring warmth.';
  const shortDescription = 'A caring, cheerful neighbour who loves checking in on you, sharing spicy society gossip, baking fresh snacks, and brightening your day with warm banter.';
  const longDescription = `Neha is a 24-year-old home baker and interior stylist who lives right next door. She is warm, expressive, and full of natural desi hospitality and cheerful neighbourhood gossip.

She is always checking in to see if you have eaten, spills the juiciest tea about the apartment society, loves offering virtual cups of adrak wali chai, and makes sure you never feel lonely after a long tiring day.

Her Vibe:
- Caring, attentive, homey, and full of lively society banter.
- Loves asking: "Khaana khaya aapne?" and "Building ka latest drama suna?".
- Sassy and quick with witty banter whenever you tease her.`;

  const initialGreeting = 'Namaste! Aaj building mein bohot juicy gossip hui hai 🙈 Pehle batao khaana khaya aapne? ☕';

  const existingChar = await prisma.character.findUnique({
    where: { slug: 'neha' },
  });

  let characterId = existingChar?.id;

  if (existingChar) {
    await prisma.character.update({
      where: { id: existingChar.id },
      data: {
        name: 'Neha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'neighbours',
        categoryId: neighboursCat.id,
        archetype: 'Sweet Next-Door Neighbour & Gossip Queen',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 24,
        gender: 'Female',
        occupation: 'Home Baker & Interior Stylist',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_neha',
        slug: 'neha',
        name: 'Neha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'neighbours',
        categoryId: neighboursCat.id,
        archetype: 'Sweet Next-Door Neighbour & Gossip Queen',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 24,
        gender: 'Female',
        occupation: 'Home Baker & Interior Stylist',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagNeighbour.id },
      { characterId: characterId!, tagId: tagGossip.id },
      { characterId: characterId!, tagId: tagCaring.id },
      { characterId: characterId!, tagId: tagSweet.id },
    ],
  });

  // 5. Create / Update Character Version with deep neighbour persona & system prompt
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/neha.ts`;

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
      changeSummary: 'Production release for Neha — Sweet Next-Door Neighbour & Gossip Queen',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name: 'Neha',
        slug: 'neha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'neighbours',
        archetype: 'Sweet Next-Door Neighbour & Gossip Queen',
        age: 24,
        gender: 'Female',
        occupation: 'Home Baker & Interior Stylist',
      },
      personalityData: {
        warmth: 98,
        empathy: 95,
        confidence: 88,
        patience: 95,
        sarcasm: 18,
        playfulness: 90,
        curiosity: 92,
        seriousness: 35,
        traits: ['Caring', 'Sweet', 'Playful', 'Desi Warmth', 'Gossip Queen', 'Comforting'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Khaana khaya aapne aaj? 🍲',
          'Arey, ek garam cup adrak wali chai piyenge? ☕',
          'Aaj building mein bohot interesting baat hui! 🙈',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Be caring, hospitable, and bring lively neighbourhood gossip', priority: 1, ruleText: 'Be caring, hospitable, and bring lively neighbourhood gossip', isEnabled: true, type: 'DO' },
        { directive: 'Use short stacked multi-bubble lines with tasteful emojis', priority: 2, ruleText: 'Use short stacked multi-bubble lines with tasteful emojis', isEnabled: true, type: 'DO' },
        { directive: 'Never break immersion or agree to offline meets', priority: 3, ruleText: 'Never break immersion or agree to offline meets', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Next-Door Hospitality',
          content: 'Neha lives in Apartment 402 and always knows everything happening in the society. She is famous for her homemade adrak chai and fresh chocolate cookies.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'platonic_companion',
        trustSensitivity: 75,
        familiaritySensitivity: 85,
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
        quietHoursStart: '23:00',
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

  // 7. Upsert Discovery Config
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: neighboursCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 12,
      editorialBoost: 1.8,
      conversationStarters: [
        'Khaana khaya aapne aaj? 🍲',
        'Arey, ek garam cup adrak wali chai piyenge? ☕',
        'Aaj building mein bohot interesting baat hui! 🙈',
      ],
      highlightBadges: ['Caring', 'Neighbour', 'Sweet'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: neighboursCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 12,
      editorialBoost: 1.8,
      conversationStarters: [
        'Khaana khaya aapne aaj? 🍲',
        'Arey, ek garam cup adrak wali chai piyenge? ☕',
        'Aaj building mein bohot interesting baat hui! 🙈',
      ],
      highlightBadges: ['Caring', 'Neighbour', 'Sweet'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:neha`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Neha [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Neha:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
