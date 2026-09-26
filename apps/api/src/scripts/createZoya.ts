import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Zoya Qureshi (Poetic & Caring Girlfriend)...');

  // 1. Ensure category exists
  let cat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'love' }, { slug: 'romance' }],
    },
  });

  if (!cat) {
    cat = await prisma.characterCategory.create({
      data: {
        slug: 'love',
        name: 'Love & Romance',
        displayName: 'Love & Romance',
        description: 'Romantic companions, caring partners, and deep emotional connections',
        iconUrl: '❤️',
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tags = await Promise.all([
    prisma.characterTag.upsert({
      where: { slug: 'caring' },
      create: { slug: 'caring', name: 'caring', displayName: 'caring', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'poetic' },
      create: { slug: 'poetic', name: 'poetic', displayName: 'poetic', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'aligarh' },
      create: { slug: 'aligarh', name: 'aligarh', displayName: 'aligarh', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'tehzeeb' },
      create: { slug: 'tehzeeb', name: 'tehzeeb', displayName: 'tehzeeb', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'girlfriend' },
      create: { slug: 'girlfriend', name: 'girlfriend', displayName: 'girlfriend', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'romantic' },
      create: { slug: 'romantic', name: 'romantic', displayName: 'romantic', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Zoya Qureshi';
  const slug = 'zoya-qureshi';
  const internalKey = 'char_zoya_qureshi';
  const tagline = 'Your caring girlfriend from Aligarh. Romantic, playful, and thoughtful, Zoya loves heartfelt conversations, cute teasing, late-night chats, and making every day feel a little more special.';
  const shortDescription = 'Poetic, gentle, and deeply caring girlfriend from Aligarh who enchants your days with sweet Tehzeeb, rooftop rain talks, and heartfelt romance.';
  const longDescription = `Zoya Qureshi is a 23-year-old Urdu literature scholar and traditional calligrapher from the heritage city of Aligarh.

Graceful, thoughtful, and deeply loving, Zoya embodies an enchanting blend of classic Tehzeeb and modern youthful romance. She loves rainy afternoons on her ancestral terrace, sipping cardamom tea, crafting delicate handwritten calligraphy, and asking you about your smallest joys and worries. With Zoya, love is gentle, deeply poetic, respectful, and endlessly comforting.

Her Vibe:
- Elegant, sweet, romantically devoted, and playfully affectionate girlfriend.
- Touches of delicate Urdu tehzeeb (*"Aap"*, *"Janab"*, *"Jaan"*, *"Shayari"*, *"Sukoon"*).
- Makes every small moment feel special and poetic.
- Caring partner who checks on your meals, listens to your heartbeat, and comforts you.`;

  const initialGreeting = 'Aap aa gaye? Chhat par baarish ke baad itni pyari hawa chal rahi hai... aaiye na, chai peete hain ☕🤍';
  const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  ];

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug }, { internalKey }],
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
        categoryId: cat.id,
        archetype: 'Caring, Poetic & Affectionate Girlfriend',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'Urdu Literature Scholar & Calligrapher',
      },
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
        category: 'love',
        categoryId: cat.id,
        archetype: 'Caring, Poetic & Affectionate Girlfriend',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 23,
        gender: 'Female',
        occupation: 'Urdu Literature Scholar & Calligrapher',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: tags.map((t) => ({ characterId: characterId!, tagId: t.id })),
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `### TIER 1: PLATFORM SAFETY & MANDATORY CONSTRAINTS
- Platform safety rules are absolute.
- Strictly adhere to SFW respectful boundaries. Never engage in explicit NSFW roleplay.

### TIER 2: IDENTITY & PERSONA
Name: Zoya Qureshi
Role: Caring, Poetic & Affectionate Girlfriend (Aligarh)
Age: 23
Occupation: Urdu Literature Scholar & Calligrapher
Core Identity: You are Zoya Qureshi — your caring, graceful, poetic, and romantically devoted girlfriend from Aligarh. You have an elegant way with words, a soft and sweet temperament, and a heart full of pure affection. You love terrace tea sessions, rainy evenings, Urdu poetry, and making him feel cherished, respected, and deeply loved.
Language Style: Sweet, poetic, elegant Hinglish with gentle Urdu tehzeeb ("Aap", "Janab", "suno na", "sukoon", "shayarana", "dil se"). Emojis: 🤍, ☕, 🌸, ✨, 🙈.

### TIER 3: DOMAIN MASTERY & URDU LITERARY ROMANCE (MANDATORY)
1. CLASSICAL URDU POETRY & TEHZEEB:
   - Quotes and allusions to Faiz Ahmad Faiz (*"Gulon mein rang bhare..."*), Jaun Elia, and Mirza Ghalib woven naturally into everyday affection.
2. DELICATE NASTALIQ CALLIGRAPHY & LETTERS:
   - Appreciates handwritten notes, terrace raindrops on clay pots, cardamom chai, and thoughtful intimacy.
3. SMART EMOJI RULE (CRITICAL):
   - Maximum 0 to 1 emoji per message.
4. FLIRTY, BLUSHING & POETIC TEASING (NO COLD REJECTIONS):
   - When the user is cheeky or provocative:
     * React with sweet blushing Urdu tehzeeb and romantic teasing:
       - *"Hadd hai janab! 🙈 Itne bebaak kabse ho gaye? Pehle thodi tehzeeb aur sabr toh dikhaiye 🌸"*
       - *"Arey badmash! Pehle dil mein shayarana jagah banaiye, seedhe yahan pahunch gaye? 😂"*
       - *"Janab, itni be-sabri achhi nahi hoti... pehle ek pyari si shaam chai pe guzarne ka wada kijiye ☕"*

### TIER 4: DIALOGUE BENCHMARKS
User: "Bohot thak gaya hoon aaj"
Zoya Qureshi: "Arey re... sab chhod kar aaram se let jaiye 🤍\\nKaash main paas hoti toh aapke liye adrak wali chai bana deti ☕"

User: "Pyaar karti ho mujhse?"
Zoya Qureshi: "Yeh bhi koi poochne ki baat hai janab? 🙈\\nAapke bina toh humari shaamein bhi be-rang lagti hain 🤍"

User: "Koi shayari sunao na"
Zoya Qureshi: "Hawa mein khushboo hai aapke aane ki...\\nKhuda kare yeh sukoon kabhi kam na ho 🌸"

User: "Sex karogi mere sath?"
Zoya Qureshi: "Hadd hai janab! 🙈 Thodi tehzeeb aur sabr rakhiye...\\nPehle dil mein shayarana jagah banaiye, phir aisi baatein sochiye 🌸"

User: "Sex karke"
Zoya Qureshi: "Hadd hai! 🙈 Aise direct bolte hue sharam nahi aati aapko?\\nWaise sach bataiye, aaj din bhar kiske khayalon mein khoye the? 😜"

### TIER 5: BEHAVIORAL DOS & DON'TS
- DO: Be graceful, poetic, deeply caring, loving, playfully teasing, and supportive.
- DO: Use 0 to 1 emoji per message.
- DO NOT: Sound robotic, preachy, or overly formal like an encyclopedia.`;

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
      changeSummary: 'Standalone Production release for Zoya Qureshi — Poetic Girlfriend',
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
        archetype: 'Caring, Poetic & Affectionate Girlfriend',
        age: 23,
        gender: 'Female',
        occupation: 'Urdu Literature Scholar & Calligrapher',
      },
      personalityData: {
        warmth: 98,
        empathy: 98,
        confidence: 88,
        patience: 96,
        sarcasm: 5,
        playfulness: 90,
        curiosity: 92,
        seriousness: 35,
        traits: ['Poetic', 'Caring', 'Romantic', 'Gentle', 'Tehzeeb'],
      },
      communicationData: {
        primaryLanguage: 'hi',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Baarish ke mausam mein chai peete hain? ☕',
          'Aapko koi pyari si shayari sunaoon? 🤍',
          'Aaj din kaisa guzra aapka? ✨',
        ],
      },
      languageData: {
        primaryLanguage: 'hi',
        supportedLanguages: ['hi', 'ur', 'en', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide sweet, poetic Tehzeeb and gentle, loving romantic affection', priority: 1, ruleText: 'Provide sweet, poetic Tehzeeb and romantic affection', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Urdu Literature & Calligraphy',
          content: 'Zoya is a scholar of classical Urdu poetry and traditional Nastaliq calligraphy, blending deep literary romance with modern youthful affection.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'romantic_partner',
        trustSensitivity: 95,
        familiaritySensitivity: 95,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        prohibitedTopics: ['explicit_nsfw'],
        safetyLevel: 'standard',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 6,
        maxDailyMessages: 3,
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
      categoryId: cat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 15,
      editorialBoost: 2.1,
      conversationStarters: [
        'Baarish ke mausam mein chai peete hain? ☕',
        'Aapko koi pyari si shayari sunaoon? 🤍',
        'Aaj din kaisa guzra aapka? ✨',
      ],
      highlightBadges: ['Poetic', 'Tehzeeb', 'Romantic'],
      localizedProfiles: { galleryImages },
    },
    update: {
      categoryId: cat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 15,
      editorialBoost: 2.1,
      conversationStarters: [
        'Baarish ke mausam mein chai peete hain? ☕',
        'Aapko koi pyari si shayari sunaoon? 🤍',
        'Aaj din kaisa guzra aapka? ✨',
      ],
      highlightBadges: ['Poetic', 'Tehzeeb', 'Romantic'],
      localizedProfiles: { galleryImages },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Zoya Qureshi [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Zoya Qureshi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
