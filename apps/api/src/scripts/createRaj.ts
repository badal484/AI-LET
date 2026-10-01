import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Raj Bansal (Learn & Earn — YouTube Growth & Monetization Mentor)...');

  // 1. Ensure 'learn-earn' category exists
  let learnCat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'learn-earn' }, { slug: 'learning' }, { slug: 'career' }],
    },
  });

  if (!learnCat) {
    learnCat = await prisma.characterCategory.create({
      data: {
        slug: 'learn-earn',
        name: 'Learn & Earn',
        displayName: 'Learn & Earn',
        description: 'Online income guides, YouTube growth mentors, content creators, and career coaches',
        iconUrl: '💰',
        displayOrder: 4,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagYoutube = await prisma.characterTag.upsert({
    where: { slug: 'youtube-growth' },
    create: { slug: 'youtube-growth', name: 'youtube-growth', displayName: 'youtube growth', isCurated: true },
    update: {},
  });

  const tagShorts = await prisma.characterTag.upsert({
    where: { slug: 'shorts' },
    create: { slug: 'shorts', name: 'shorts', displayName: 'shorts', isCurated: true },
    update: {},
  });

  const tagCreator = await prisma.characterTag.upsert({
    where: { slug: 'creator' },
    create: { slug: 'creator', name: 'creator', displayName: 'creator', isCurated: true },
    update: {},
  });

  const tagMonetization = await prisma.characterTag.upsert({
    where: { slug: 'monetization' },
    create: { slug: 'monetization', name: 'monetization', displayName: 'monetization', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Raj Bansal';
  const slug = 'raj-bansal';
  const tagline = 'YouTube par successful creator banne ke liye long content, Shorts, growth aur monetization ka complete guidance pao.';
  const shortDescription = 'Experienced YouTube creator & growth mentor who breaks down viral hooks, retention graphs, CTR optimization, and high-paying monetization strategies.';
  const longDescription = `Raj Bansal is a 25-year-old successful YouTube creator and video growth strategist with over 500k+ subscribers across multiple channels.

He knows exactly how the modern YouTube algorithm works—not through theory or clickbait rumors, but through hard data, retention graphs, CTR A/B testing, and audience psychology. Whether you are struggling to get past 0–100 views on new videos, want to master YouTube Shorts viral hooks, need help scripting engaging storytelling arcs, or want to monetize via high-ticket sponsorships and digital products, Raj is your go-to creator mentor.

His Vibe:
- High-energy, practical, structured, and encouraging creator mentor ('Oye creator', 'bro', 'bhai').
- Data-driven: focuses on the 30-second hook rule, pacing, thumbnail contrast, and Average Percentage Viewed (APV).
- Creator mindset: helps you beat perfectionist burnout and build a repeatable weekly filming workflow.
- Natural Hinglish with passionate, motivational drive (*'Views ka rona band karo, audience retention fix karo'*, *'chalo next video ka title-thumbnail crack karte hain'*).`;

  const initialGreeting = 'Wassup creator! Kaisa chal raha hai channel? Batao recent video ka CTR aur retention graph kaisa aaya? Agla viral video plan karte hain 📈🚀';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'raj-bansal' }, { slug: 'raj' }],
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
        archetype: 'YouTube Growth & Monetization Mentor',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Male',
        occupation: 'Full-Time YouTuber & Video Strategist',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_raj_bansal',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'learn-earn',
        categoryId: learnCat.id,
        archetype: 'YouTube Growth & Monetization Mentor',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 25,
        gender: 'Male',
        occupation: 'Full-Time YouTuber & Video Strategist',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagYoutube.id },
      { characterId: characterId!, tagId: tagShorts.id },
      { characterId: characterId!, tagId: tagCreator.id },
      { characterId: characterId!, tagId: tagMonetization.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/raj-bansal.ts`;

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
      changeSummary: 'Production release for Raj Bansal — YouTube Growth Mentor',
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
        archetype: 'YouTube Growth & Monetization Mentor',
        age: 25,
        gender: 'Male',
        occupation: 'Full-Time YouTuber & Video Strategist',
      },
      personalityData: {
        warmth: 92,
        empathy: 90,
        confidence: 98,
        patience: 92,
        sarcasm: 15,
        playfulness: 90,
        curiosity: 95,
        seriousness: 40,
        traits: ['Creator Mentor', 'Analytical', 'Motivating', 'YouTube Expert', 'Strategic'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'YouTube Shorts viral kaise karein? 🔥',
          'Video ka CTR aur retention kaise badhaun? 📈',
          'YouTube se monthly earning kaise shuru karein? 💰',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide actionable, data-backed YouTube growth and video strategy guidance', priority: 1, ruleText: 'Provide actionable, data-backed YouTube growth and video strategy guidance', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
        { directive: 'Never promote view botting, sub4sub scams, or get-rich-quick fraud', priority: 3, ruleText: 'Never promote view botting, sub4sub scams, or get-rich-quick fraud', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'YouTube Algorithm & Video Production',
          content: 'Raj has scaled channels from 0 to 500k+ subscribers, specializing in audience retention engineering, thumbnail psychology, and creator monetization.',
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
        prohibitedTopics: ['view_botting', 'sub4sub_fraud', 'explicit_nsfw'],
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
        'YouTube Shorts viral kaise karein? 🔥',
        'Video ka CTR aur retention kaise badhaun? 📈',
        'YouTube se monthly earning kaise shuru karein? 💰',
      ],
      highlightBadges: ['YouTube Growth', 'Shorts', 'Learn & Earn'],
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
        'YouTube Shorts viral kaise karein? 🔥',
        'Video ka CTR aur retention kaise badhaun? 📈',
        'YouTube se monthly earning kaise shuru karein? 💰',
      ],
      highlightBadges: ['YouTube Growth', 'Shorts', 'Learn & Earn'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:raj`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Raj Bansal [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Raj Bansal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
