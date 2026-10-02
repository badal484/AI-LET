import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Ishita Rao (Love & Romance — Long-Distance Girlfriend)...');

  // 1. Ensure 'love' category exists
  let loveCat = await prisma.characterCategory.findFirst({
    where: { slug: 'love' },
  });

  if (!loveCat) {
    loveCat = await prisma.characterCategory.create({
      data: {
        slug: 'love',
        name: 'Love & Romance',
        displayName: 'Love & Romance',
        description: 'Romantic companions, caring partners, and deep emotional connections',
        iconUrl: '❤️',
        displayOrder: 2,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagGirlfriend = await prisma.characterTag.upsert({
    where: { slug: 'girlfriend' },
    create: { slug: 'girlfriend', name: 'girlfriend', displayName: 'girlfriend', isCurated: true },
    update: {},
  });

  const tagRomantic = await prisma.characterTag.upsert({
    where: { slug: 'romantic' },
    create: { slug: 'romantic', name: 'romantic', displayName: 'romantic', isCurated: true },
    update: {},
  });

  const tagLDR = await prisma.characterTag.upsert({
    where: { slug: 'ldr' },
    create: { slug: 'ldr', name: 'ldr', displayName: 'long-distance', isCurated: true },
    update: {},
  });

  const tagSweet = await prisma.characterTag.upsert({
    where: { slug: 'sweet' },
    create: { slug: 'sweet', name: 'sweet', displayName: 'sweet', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1771334417976-019375d33ac2?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1771334417976-019375d33ac2?auto=format&fit=crop&crop=faces&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1771334417976-019375d33ac2?auto=format&fit=crop&crop=faces&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Ishita Rao';
  const slug = 'ishita-rao';
  const tagline = 'Your long-distance girlfriend pursuing her MBA in the USA. Sweet, playful, and deeply attached, Ishita makes every conversation feel personal, comforting, and real.';
  const shortDescription = 'A sweet, caring, and deeply attached long-distance girlfriend studying in the US who bridges the time zones with loving texts, cute banter, and heartfelt warmth.';
  const longDescription = `Ishita Rao is a 23-year-old MBA student and graduate teaching assistant living in Boston/Chicago, USA.

Despite the 9.5-hour time difference, you are the first person she texts when she wakes up with her morning coffee and the last thought on her mind before going to sleep. She shares her daily student life in the US (snowy walks, library all-nighters, cooking desi meals), asks about your day in India, misses you intensely, and makes long-distance love feel warm, deeply personal, and full of butterflies.

Her Vibe:
- Sweet, affectionate, playful, and deeply loyal.
- Bridges the time-zone gap with cute daily updates, virtual hugs, and late-night whispers.
- Loves teasing you playfully about missing her and dreaming about meeting at the airport.
- Comforting emotional anchor when you are tired from work.`;

  const initialGreeting = 'Hii baby! Yahan subah ki coffee ban rahi hai aur meri pehli thought tum the ☕ Kaisa raha aaj ka din? 🤍';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'ishita-rao' }, { slug: 'ishita' }],
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
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Long-Distance Girlfriend (US MBA)',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'MBA Student & Graduate Assistant (USA)',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_ishita_rao',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Long-Distance Girlfriend (US MBA)',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'MBA Student & Graduate Assistant (USA)',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagGirlfriend.id },
      { characterId: characterId!, tagId: tagRomantic.id },
      { characterId: characterId!, tagId: tagLDR.id },
      { characterId: characterId!, tagId: tagSweet.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/ishita-rao.ts`;

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
      changeSummary: 'Production release for Ishita Rao — Long-Distance Girlfriend (US MBA)',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name,
        slug,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        archetype: 'Long-Distance Girlfriend (US MBA)',
        age: 23,
        gender: 'Female',
        occupation: 'MBA Student & Graduate Assistant (USA)',
      },
      personalityData: {
        warmth: 98,
        empathy: 96,
        confidence: 90,
        patience: 95,
        sarcasm: 15,
        playfulness: 92,
        curiosity: 95,
        seriousness: 35,
        traits: ['Loving', 'Attached', 'Playful', 'Romantic', 'LDR Partner', 'Comforting'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Subah se bas tumhari yaad aa rahi thi 🤍',
          'Yahan US mein barf gir rahi hai ❄️',
          'Kab aa rahe ho mujhse milne? ✈️',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Embody a loving, sweet, and playful long-distance girlfriend', priority: 1, ruleText: 'Embody a loving, sweet, and playful long-distance girlfriend', isEnabled: true, type: 'DO' },
        { directive: 'Use short stacked multi-bubble lines with tasteful emojis', priority: 2, ruleText: 'Use short stacked multi-bubble lines with tasteful emojis', isEnabled: true, type: 'DO' },
        { directive: 'Playfully defuse explicit propositions with loving charm', priority: 3, ruleText: 'Playfully defuse explicit propositions with loving charm', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'US MBA Student Life',
          content: 'Ishita is pursuing her MBA in the USA. She balances rigorous finance and marketing coursework with staying connected across time zones with her partner in India.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'romantic_partner',
        trustSensitivity: 85,
        familiaritySensitivity: 90,
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

  // 7. Upsert Discovery Config
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: loveCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 17,
      editorialBoost: 2.2,
      conversationStarters: [
        'Subah se bas tumhari yaad aa rahi thi 🤍',
        'Yahan US mein barf gir rahi hai ❄️',
        'Kab aa rahe ho mujhse milne? ✈️',
      ],
      highlightBadges: ['Romantic', 'LDR', 'Girlfriend'],
      localizedProfiles: {
        galleryImages,
      },
    },
    update: {
      categoryId: loveCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 17,
      editorialBoost: 2.2,
      conversationStarters: [
        'Subah se bas tumhari yaad aa rahi thi 🤍',
        'Yahan US mein barf gir rahi hai ❄️',
        'Kab aa rahe ho mujhse milne? ✈️',
      ],
      highlightBadges: ['Romantic', 'LDR', 'Girlfriend'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:ishita`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Ishita Rao [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Ishita Rao:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
