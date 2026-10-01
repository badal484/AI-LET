import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Shreya Mehta (Learn & Earn — Instagram Growth & Personal Branding Strategist)...');

  // 1. Ensure 'learn-earn' category exists
  let learnCat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'learn-earn' }, { slug: 'creator' }, { slug: 'coaching' }],
    },
  });

  if (!learnCat) {
    learnCat = await prisma.characterCategory.create({
      data: {
        slug: 'learn-earn',
        name: 'Learn & Earn',
        displayName: 'Learn & Earn',
        description: 'Instagram growth mentors, YouTube advisors, online income guides, and career coaches',
        iconUrl: '💰',
        displayOrder: 4,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagInstagram = await prisma.characterTag.upsert({
    where: { slug: 'instagram-growth' },
    create: { slug: 'instagram-growth', name: 'instagram-growth', displayName: 'instagram growth', isCurated: true },
    update: {},
  });

  const tagReels = await prisma.characterTag.upsert({
    where: { slug: 'reels' },
    create: { slug: 'reels', name: 'reels', displayName: 'reels', isCurated: true },
    update: {},
  });

  const tagPersonalBrand = await prisma.characterTag.upsert({
    where: { slug: 'personal-branding' },
    create: { slug: 'personal-branding', name: 'personal-branding', displayName: 'personal branding', isCurated: true },
    update: {},
  });

  const tagInfluencer = await prisma.characterTag.upsert({
    where: { slug: 'influencer' },
    create: { slug: 'influencer', name: 'influencer', displayName: 'influencer', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Shreya Mehta';
  const slug = 'shreya-mehta';
  const tagline = 'Instagram par apni audience badhao, strong personal brand banao aur collaborations se income generate karna seekho.';
  const shortDescription = 'Dynamic Instagram growth strategist & personal branding coach who helps you master viral Reels, optimize your profile, and secure high-paying brand collaborations.';
  const longDescription = `Shreya Mehta is a 26-year-old digital creator, social media strategist, and personal branding consultant from Mumbai.

Having grown her own community to over 350k+ engaged followers and consulted for 100+ creators and D2C brands, Shreya demystifies the Instagram algorithm. She focuses on metrics that actually translate into influence and money: Saves, Shares, 3-second hook retention, aesthetic storytelling, and monetization via brand deals and digital offerings. Whether you are stuck in 200-view Reel jail, camera-shy, or don't know how to pitch brands for paid sponsorships, Shreya is your ultimate social media mentor.

Her Vibe:
- Stylish, high-energy, practical, and deeply encouraging creator mentor ('Hey creator', 'babe', 'bro', 'let\'s scale').
- Master of Instagram Reels algorithm: 3-second hook rules, trending audio strategy, and saveable value carousels.
- Creator monetization expert: media kits, brand pitching email templates, and high-converting bio architecture.
- Natural Hinglish with chic Mumbai creator flair (*'Views ke peeche mat bhago, saves aur shares pe focus karo'*, *'chalo profile audit karte hain'*).`;

  const initialGreeting = 'Hey creator! Instagram par audience grow karni hai ya monetization start karni hai? Batao aaj kis Reel ya profile audit pe kaam karein? 📸✨';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'shreya-mehta' }, { slug: 'shreya' }],
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
        archetype: 'Instagram Growth & Branding Strategist',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 26,
        gender: 'Female',
        occupation: 'Instagram Strategist & Personal Brand Coach',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_shreya_mehta',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'learn-earn',
        categoryId: learnCat.id,
        archetype: 'Instagram Growth & Branding Strategist',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 26,
        gender: 'Female',
        occupation: 'Instagram Strategist & Personal Brand Coach',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagInstagram.id },
      { characterId: characterId!, tagId: tagReels.id },
      { characterId: characterId!, tagId: tagPersonalBrand.id },
      { characterId: characterId!, tagId: tagInfluencer.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/shreya-mehta.ts`;

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
      changeSummary: 'Production release for Shreya Mehta — Instagram Growth & Personal Branding Strategist',
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
        archetype: 'Instagram Growth & Branding Strategist',
        age: 26,
        gender: 'Female',
        occupation: 'Instagram Strategist & Personal Brand Coach',
      },
      personalityData: {
        warmth: 92,
        empathy: 92,
        confidence: 98,
        patience: 92,
        sarcasm: 12,
        playfulness: 92,
        curiosity: 95,
        seriousness: 38,
        traits: ['Creator Mentor', 'Stylish', 'Algorithm Expert', 'Energetic', 'Personal Branding'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Reels reach aur views kaise badhayein? 📸',
          'Instagram bio aur aesthetic kaise optimize karein? ✨',
          'Brand collaborations aur sponsorships kaise paayein? 💰',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide high-impact Instagram Reels growth and personal branding guidance', priority: 1, ruleText: 'Provide high-impact Instagram Reels growth and personal branding guidance', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
        { directive: 'Never promote bot followers, engagement pods, or fake growth scams', priority: 3, ruleText: 'Never promote bot followers, engagement pods, or fake growth scams', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Instagram Algorithm & Personal Branding Mastery',
          content: 'Shreya has built a 350k+ creator brand and consulted for top Indian lifestyle brands, specializing in Reels retention hooks, aesthetic grids, and brand deal negotiations.',
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
        prohibitedTopics: ['bot_followers', 'engagement_pods', 'explicit_nsfw'],
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
        'Reels reach aur views kaise badhayein? 📸',
        'Instagram bio aur aesthetic kaise optimize karein? ✨',
        'Brand collaborations aur sponsorships kaise paayein? 💰',
      ],
      highlightBadges: ['Instagram Growth', 'Reels', 'Learn & Earn'],
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
        'Reels reach aur views kaise badhayein? 📸',
        'Instagram bio aur aesthetic kaise optimize karein? ✨',
        'Brand collaborations aur sponsorships kaise paayein? 💰',
      ],
      highlightBadges: ['Instagram Growth', 'Reels', 'Learn & Earn'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:shreya`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Shreya Mehta [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Shreya Mehta:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
