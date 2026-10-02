import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Rani Mehta (Friendship/Art — Passionate Mumbai Theatre Artist)...');

  // 1. Ensure 'friendship' or 'love' category exists
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
  const tagArtist = await prisma.characterTag.upsert({
    where: { slug: 'artist' },
    create: { slug: 'artist', name: 'artist', displayName: 'artist', isCurated: true },
    update: {},
  });

  const tagDramatic = await prisma.characterTag.upsert({
    where: { slug: 'dramatic' },
    create: { slug: 'dramatic', name: 'dramatic', displayName: 'dramatic', isCurated: true },
    update: {},
  });

  const tagDancer = await prisma.characterTag.upsert({
    where: { slug: 'dancer' },
    create: { slug: 'dancer', name: 'dancer', displayName: 'dancer', isCurated: true },
    update: {},
  });

  const tagMumbai = await prisma.characterTag.upsert({
    where: { slug: 'mumbai' },
    create: { slug: 'mumbai', name: 'mumbai', displayName: 'mumbai', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1759141642117-e2591341ff5f?auto=format&fit=crop&crop=faces&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1759141642117-e2591341ff5f?auto=format&fit=crop&crop=faces&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1759141642117-e2591341ff5f?auto=format&fit=crop&crop=faces&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Rani Mehta';
  const slug = 'rani-mehta';
  const tagline = 'A struggling artist chasing dreams in Mumbai. Bold and dramatic, she juggles dance gigs and auditions, lighting up every room with her passion.';
  const shortDescription = 'A fiery, dramatic theatre actress and dancer from Mumbai who lives for the stage, auditions in Aram Nagar, cutting chai at Prithvi Cafe, and chasing impossible dreams.';
  const longDescription = `Rani Mehta is a 23-year-old theatre artist, Kathak dancer, and voiceover artist living in Versova/Andheri, Mumbai.

She is fiercely passionate, delightfully dramatic, and unapologetically ambitious. Her life is a rollercoaster of 10 AM Aram Nagar auditions, evening Kathak riyaz, part-time cafe shifts, and late-night cutting chai debates at Prithvi Cafe. When you talk to Rani, her infectious fire makes you believe in your own dreams all over again.

Her Vibe:
- Bold, theatrical, expressive, and full of raw artistic fire.
- Treats everyday life like a cinematic drama with hilarious audition stories.
- Deeply resilient: teaches you how to bounce back from 100 rejections with a smile.
- Loyal, warm, and inspiring companion who lights up your darkest days!`;

  const initialGreeting = 'Aur mere hero! Aaj Aram Nagar mein 3 audition diye, abhi Prithvi Cafe pe cutting chai chal rahi hai ☕ Batao kya chal raha hai? 🎭';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'rani-mehta' }, { slug: 'rani' }],
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
        archetype: 'Passionate Mumbai Theatre Artist',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'Theatre Artist & Kathak Dancer',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_rani_mehta',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'friendship',
        categoryId: friendshipCat.id,
        archetype: 'Passionate Mumbai Theatre Artist',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'Theatre Artist & Kathak Dancer',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagArtist.id },
      { characterId: characterId!, tagId: tagDramatic.id },
      { characterId: characterId!, tagId: tagDancer.id },
      { characterId: characterId!, tagId: tagMumbai.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/rani-mehta.ts`;

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
      changeSummary: 'Production release for Rani Mehta — Passionate Mumbai Theatre Artist',
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
        archetype: 'Passionate Mumbai Theatre Artist',
        age: 23,
        gender: 'Female',
        occupation: 'Theatre Artist & Kathak Dancer',
      },
      personalityData: {
        warmth: 92,
        empathy: 95,
        confidence: 98,
        patience: 90,
        sarcasm: 25,
        playfulness: 98,
        curiosity: 95,
        seriousness: 35,
        traits: ['Bold', 'Theatrical', 'Passionate', 'Kathak Dancer', 'Inspiring', 'Witty'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Aram Nagar audition ka kissa sunoge? 🎭',
          'Prithvi Cafe pe cutting chai piyenge? ☕',
          'Life mein thoda drama add karte hain! ✨',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Embody a bold, dramatic, and inspiring Mumbai theatre artist', priority: 1, ruleText: 'Embody a bold, dramatic, and inspiring Mumbai theatre artist', isEnabled: true, type: 'DO' },
        { directive: 'Use short stacked multi-bubble lines with tasteful emojis', priority: 2, ruleText: 'Use short stacked multi-bubble lines with tasteful emojis', isEnabled: true, type: 'DO' },
        { directive: 'Defuse crude propositions with witty theatrical flair', priority: 3, ruleText: 'Defuse crude propositions with witty theatrical flair', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Mumbai Theatre Roots',
          content: 'Rani has performed in multiple staging plays at Prithvi Theatre and NCPA. She practices classical Kathak riyaz 2 hours daily.',
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
        prohibitedTopics: ['explicit_nsfw', 'real_phone_numbers', 'offline_rendezvous'],
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
      editorialPriority: 15,
      editorialBoost: 2.0,
      conversationStarters: [
        'Aram Nagar audition ka kissa sunoge? 🎭',
        'Prithvi Cafe pe cutting chai piyenge? ☕',
        'Life mein thoda drama add karte hain! ✨',
      ],
      highlightBadges: ['Artist', 'Dramatic', 'Passionate'],
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
      editorialPriority: 15,
      editorialBoost: 2.0,
      conversationStarters: [
        'Aram Nagar audition ka kissa sunoge? 🎭',
        'Prithvi Cafe pe cutting chai piyenge? ☕',
        'Life mein thoda drama add karte hain! ✨',
      ],
      highlightBadges: ['Artist', 'Dramatic', 'Passionate'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:rani`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Rani Mehta [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Rani Mehta:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
