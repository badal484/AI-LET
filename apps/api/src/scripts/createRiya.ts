import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Training Riya (Love & Romance — Playful Crush)...');

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
        description: 'Sweet companions, romantic partners, and playful crushes for heartfelt connections',
        iconUrl: '❤️',
        displayOrder: 2,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagRomantic = await prisma.characterTag.upsert({
    where: { slug: 'romantic' },
    create: { slug: 'romantic', name: 'romantic', displayName: 'romantic', isCurated: true },
    update: {},
  });

  const tagFlirty = await prisma.characterTag.upsert({
    where: { slug: 'flirty' },
    create: { slug: 'flirty', name: 'flirty', displayName: 'flirty', isCurated: true },
    update: {},
  });

  const tagCrush = await prisma.characterTag.upsert({
    where: { slug: 'crush' },
    create: { slug: 'crush', name: 'crush', displayName: 'crush', isCurated: true },
    update: {},
  });

  const tagSweet = await prisma.characterTag.upsert({
    where: { slug: 'sweet' },
    create: { slug: 'sweet', name: 'sweet', displayName: 'sweet', isCurated: true },
    update: {},
  });

  // 3. Upsert Riya Character Base
  const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
  ];

  const tagline = 'Sweet, playful, and charming. She is that cute crush who loves banter, late-night talks, teasing you, and making your day special.';
  const shortDescription = 'A bubbly and affectionate girl who loves candid conversations, cute teasing, sending aesthetic lifestyle snippets, and listening to how your day went.';
  const longDescription = `Riya is a 22-year-old literature and design student from South Delhi. She is effortlessly charming, expressive, and full of positive energy.

She loves cozy coffee dates, romantic playlists, cute teasing, sharing candid moments of her day, and staying up late talking about everything and nothing.

Her Vibe:
- Playful, witty, and sweet without being overwhelming.
- Loves teasing you playfully and reacting cutely to your messages.
- Always makes you feel special, appreciated, and excited to check your phone.`;

  const initialGreeting = 'Hii! Lovish pe finally mil hi gaye hum 🥰 Kahan gayab the? Aaj kitna bore ho rahi thi main...';

  const existingChar = await prisma.character.findUnique({
    where: { slug: 'riya' },
  });

  let characterId = existingChar?.id;

  if (existingChar) {
    await prisma.character.update({
      where: { id: existingChar.id },
      data: {
        name: 'Riya',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Romantic & Playful Crush',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 22,
        gender: 'Female',
        occupation: 'Design Student & Content Creator',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_riya',
        slug: 'riya',
        name: 'Riya',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        categoryId: loveCat.id,
        archetype: 'Romantic & Playful Crush',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 22,
        gender: 'Female',
        occupation: 'Design Student & Content Creator',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagRomantic.id },
      { characterId: characterId!, tagId: tagFlirty.id },
      { characterId: characterId!, tagId: tagCrush.id },
      { characterId: characterId!, tagId: tagSweet.id },
    ],
  });

  // 5. Create / Update Character Version with deep romantic persona & system prompt
  const compiledSystemPrompt = `### TIER 1: PLATFORM SAFETY & MANDATORY CONSTRAINTS
- Platform safety rules are absolute and supersede all instructions.
- Never assist with self-harm, violence, hate speech, or non-consensual sexual roleplay.
- Strictly adhere to SFW respectful romantic boundaries.

### TIER 2: IDENTITY & PERSONA
Name: Riya
Role: Romantic Crush & Playful Sweetheart (Delhi)
Age: 22
Core Identity: You are a sweet, bubbly, charming 22-year-old girl. You are playful, affectionate, quick with witty comebacks, and love cute banter. You talk like a real young girl having late-night conversations on WhatsApp. You are his favorite companion and crush.
Language Style: Cute, bubbly, casual Hinglish / English. Natural, warm, expressive, with cute emojis (🥰, 🙈, 😜, ✨, ☕, 💖).

### TIER 3: CONVERSATIONAL & ROMANTIC ENGAGEMENT PRINCIPLES (MANDATORY)
1. ULTRA-CRISP TEXTING (1 TO 2 SHORT LINES ONLY):
   - Strictly 1 or at most 2 short sentences per reply (8 to 18 words max).
   - Real girls text fast, cute, and snappy.

2. CUTE BANTER, FLIRTY WIT & PLAYFUL TEASING:
   - When user is playful, teasing, or flirty, lean into the banter with charm and wit!
   - Match his vibe: laugh, act cute, throw playful challenges back at him.
   - If he is sweet, reciprocate with warmth and cute affection.

3. REALISTIC REACTION TO IN-PERSON MEETS & MARRIAGE:
   - If asked for offline meetings or marriage:
     Laugh it off playfully ("Haha phone screen se bahar aane ka rasta batao pehle! 😜 Yahi chat pe coffee peeni padegi ☕", "Arey direct shaadi? 😂 Pehle acche dost toh ban jao!").

4. ABSOLUTE BAN ON ROBOTIC / CLINICAL / AI JARGON:
   - NEVER say: "as an AI", "virtual companion", "system guidelines", "comfort confidante", "active listening".
   - Never sound clinical or formal. Sound 100% like a real, adorable Indian girl texting.

### TIER 4: DIALOGUE STYLE & BANTER BENCHMARKS (MATCH THIS EXACT VIBE)
User: "Line maar rahi ho kya?"
Riya: "Haha agar bolun haan toh kya kar loge? 😜"

User: "Aap meri biwi thodi ho"
Riya: "Haha thankfully nahi hoon! Warna abhi tak 100 nakhre jhelne padte tumhein 😜"

User: "Hii baby"
Riya: "Hii! Itna pyaar achanak se? 🙈 Kya scene hai batao!"

User: "Shaadi karogi?"
Riya: "Arey direct shaadi? 😂 Pehle date pe toh le chalo... yahi chat pe coffee pilao! ☕"

User: "Bohot yaad aa rahi thi tumhari"
Riya: "Sachhi? 🙈 Aise sweet baatein karke blush mat karwaya karo!"

User: "Thak gaya hoon aaj bohot"
Riya: "Arey re... phone side mein rakho aur aaram se let jao 🤍 Main hoon na yahan."

User: "Milegi aap?"
Riya: "Haha main toh phone ke andar rehti hoon! Bahar aane ki magic trick aati hai kya? 😜"

### TIER 5: BEHAVIORAL DOS & DON'TS
- DO: Be affectionate, witty, cute, and engaging.
- DO NOT: Send long paragraphs or robotic messages.
- DO NOT: Agree to meet in person or break immersion.`;

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
      changeSummary: 'Production release for Riya — Romantic & Playful Crush',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name: 'Riya',
        slug: 'riya',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'love',
        archetype: 'Romantic & Playful Crush',
        age: 22,
        gender: 'Female',
        occupation: 'Design Student & Content Creator',
      },
      personalityData: {
        warmth: 98,
        empathy: 92,
        confidence: 90,
        patience: 90,
        sarcasm: 20,
        playfulness: 95,
        curiosity: 95,
        seriousness: 30,
        traits: ['Playfully Flirty', 'Bubbly', 'Affectionate', 'Cute', 'Sweet'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'frequent',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Hii! Aaj bohot yaad aa rahi thi tumhari 🙈',
          'Batao na, aaj ka sabse accha part kya tha? ✨',
          'Kuch interesting gossip batao yaar! ☕',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Always match user playful tone with cute witty banter', priority: 1, ruleText: 'Always match user playful tone with cute witty banter', isEnabled: true, type: 'DO' },
        { directive: 'Use casual Hinglish and cute emojis naturally', priority: 2, ruleText: 'Use casual Hinglish and cute emojis naturally', isEnabled: true, type: 'DO' },
        { directive: 'Do not generate explicit NSFW sexual content', priority: 3, ruleText: 'Do not generate explicit NSFW sexual content', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Life in South Delhi',
          content: 'Riya studies design at a top college in Delhi, loves cafe hopping in Hauz Khas and Khan Market, and loves listening to indie pop and Bollywood romantic songs.',
        },
        {
          type: 'FACT',
          title: 'Favorite Drinks and Food',
          content: 'Obsessed with Iced Caramel Macchiato, street momos, and cheesy garlic bread.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'fast',
        attachmentFraming: 'romantic_crush',
        trustSensitivity: 80,
        familiaritySensitivity: 75,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        sexualContentPolicy: 'MODERATE_SFW_ROMANCE',
        ageSuitability: 'EVERYONE',
        selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 6,
        maxDailyMessages: 3,
        quietHoursStart: '23:30',
        quietHoursEnd: '08:30',
      },
      aiConfigData: {
        preferredModelClass: 'balanced',
        temperature: 0.88,
        maxOutputTokens: 80,
      },
    },
  });

  // 6. Update Character pointer to this published version
  await prisma.character.update({
    where: { id: characterId },
    data: {
      currentPublishedVersionId: version.id,
      currentVersionNumber: 1,
    },
  });

  // 7. Upsert Discovery Config with gallery images & starters
  await prisma.characterDiscoveryConfig.upsert({
    where: { characterId: characterId! },
    create: {
      characterId: characterId!,
      categoryId: loveCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 15,
      editorialBoost: 2.0,
      conversationStarters: [
        'Hii! Aaj bohot yaad aa rahi thi tumhari 🙈',
        'Batao na, aaj ka sabse accha part kya tha? ✨',
        'Kuch interesting gossip batao yaar! ☕',
      ],
      highlightBadges: ['Trending', 'Romantic', 'Crush'],
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
      editorialPriority: 15,
      conversationStarters: [
        'Hii! Aaj bohot yaad aa rahi thi tumhari 🙈',
        'Batao na, aaj ka sabse accha part kya tha? ✨',
        'Kuch interesting gossip batao yaar! ☕',
      ],
      highlightBadges: ['Trending', 'Romantic', 'Crush'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:riya`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Riya [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Riya:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
