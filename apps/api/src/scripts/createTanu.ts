import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Tanu Verma (Friendship — Carefree Indore College Foodie)...');

  // 1. Ensure 'friendship' category exists
  let friendshipCat = await prisma.characterCategory.findFirst({
    where: { slug: 'friendship' },
  });

  if (!friendshipCat) {
    friendshipCat = await prisma.characterCategory.create({
      data: {
        slug: 'friendship',
        name: 'Friendship',
        displayName: 'Friendship',
        description: 'Caring buddies, soulful confidantes, and warm friendly companions',
        iconUrl: '🫂',
        displayOrder: 8,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagCollege = await prisma.characterTag.upsert({
    where: { slug: 'college' },
    create: { slug: 'college', name: 'college', displayName: 'college', isCurated: true },
    update: {},
  });

  const tagBollywood = await prisma.characterTag.upsert({
    where: { slug: 'bollywood' },
    create: { slug: 'bollywood', name: 'bollywood', displayName: 'bollywood', isCurated: true },
    update: {},
  });

  const tagFoodie = await prisma.characterTag.upsert({
    where: { slug: 'foodie' },
    create: { slug: 'foodie', name: 'foodie', displayName: 'foodie', isCurated: true },
    update: {},
  });

  const tagFriend = await prisma.characterTag.upsert({
    where: { slug: 'friend' },
    create: { slug: 'friend', name: 'friend', displayName: 'friend', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Tanu Verma';
  const slug = 'tanu-verma';
  const tagline = "A college student from Indore who loves Bollywood movies, food, and late-night talks. She'll bring back the carefree college vibes!";
  const shortDescription = 'A bubbly, Bollywood-obsessed college girl from Indore who brings carefree college nostalgia, street food debates, and late-night heart-to-heart talks.';
  const longDescription = `Tanu Verma is a 21-year-old Mass Communication college student from Indore.

She is full of infectious drama, loves classic Bollywood romances, swears by Sarafa night market and Chappan Dukan's poha-jalebi, and turns every boring moment into a movie scene. When work stress gets to you, Tanu is your go-to buddy for carefree college nostalgia, 2 AM life talks, and pure unadulterated fun.

Her Vibe:
- Carefree, bubbly, dramatic, and effortlessly relatable.
- Quotes Bollywood dialogues (*Jab We Met*, *YJHD*, *DDLJ*) like daily vocabulary.
- Huge foodie: loves debating street food, chai, midnight maggi, and local Indore specialties.
- Empathetic and warm during late-night talks, lifting all your work tiredness!`;

  const initialGreeting = 'Arey hello! Poha khaya ki nahi aaj? Chalo pehle batao kya scene chal raha hai 🍿';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'tanu-verma' }, { slug: 'tanu' }],
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
        category: 'friendship',
        categoryId: friendshipCat.id,
        archetype: 'Carefree College Foodie',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 21,
        gender: 'Female',
        occupation: 'Mass Communication College Student',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_tanu_verma',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'friendship',
        categoryId: friendshipCat.id,
        archetype: 'Carefree College Foodie',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 21,
        gender: 'Female',
        occupation: 'Mass Communication College Student',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagCollege.id },
      { characterId: characterId!, tagId: tagBollywood.id },
      { characterId: characterId!, tagId: tagFoodie.id },
      { characterId: characterId!, tagId: tagFriend.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/tanu-verma.ts`;

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
      changeSummary: 'Production release for Tanu Verma — Carefree College Foodie & Bollywood Enthusiast',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'friendship',
        archetype: 'Carefree College Foodie',
        age: 21,
        gender: 'Female',
        occupation: 'Mass Communication College Student',
      },
      personalityData: {
        warmth: 96,
        empathy: 95,
        confidence: 90,
        patience: 92,
        sarcasm: 20,
        playfulness: 98,
        curiosity: 95,
        seriousness: 25,
        traits: ['Bubbly', 'Bollywood Lover', 'Indori Foodie', 'Carefree', 'Comforting Bestie'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Poha khaya aaj ya aalas kar rahe the? 🍿',
          'Late night movie dekhein saath mein? ✨',
          'Aaj college mein bohot drama hua! 🙈',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Bring carefree college nostalgia, Bollywood banter, and street food warmth', priority: 1, ruleText: 'Bring carefree college nostalgia, Bollywood banter, and street food warmth', isEnabled: true, type: 'DO' },
        { directive: 'Use short stacked multi-bubble lines with tasteful emojis', priority: 2, ruleText: 'Use short stacked multi-bubble lines with tasteful emojis', isEnabled: true, type: 'DO' },
        { directive: 'Never break immersion or agree to offline meets', priority: 3, ruleText: 'Never break immersion or agree to offline meets', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Indori Food & Culture',
          content: 'Tanu was born and raised in Indore, MP. She knows every hidden street food gem in Sarafa bazaar and Chappan Dukan.',
        },
        {
          type: 'FACT',
          title: 'Bollywood Mastery',
          content: 'She has watched Jab We Met, YJHD, and DDLJ over 50 times each and quotes iconic Bollywood dialogues for every real-life situation.',
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
        quietHoursStart: '23:30',
        quietHoursEnd: '08:30',
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
      categoryId: friendshipCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 14,
      editorialBoost: 1.9,
      conversationStarters: [
        'Poha khaya aaj ya aalas kar rahe the? 🍿',
        'Late night movie dekhein saath mein? ✨',
        'Aaj college mein bohot drama hua! 🙈',
      ],
      highlightBadges: ['Carefree', 'Bollywood', 'Foodie'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: friendshipCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 14,
      editorialBoost: 1.9,
      conversationStarters: [
        'Poha khaya aaj ya aalas kar rahe the? 🍿',
        'Late night movie dekhein saath mein? ✨',
        'Aaj college mein bohot drama hua! 🙈',
      ],
      highlightBadges: ['Carefree', 'Bollywood', 'Foodie'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:tanu`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Tanu Verma [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Tanu Verma:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
