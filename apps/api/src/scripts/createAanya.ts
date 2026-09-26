import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Aanya Mehta (Healing, Loyal & Romantic Partner)...');

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
      where: { slug: 'healing' },
      create: { slug: 'healing', name: 'healing', displayName: 'healing', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'romantic' },
      create: { slug: 'romantic', name: 'romantic', displayName: 'romantic', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'loyal' },
      create: { slug: 'loyal', name: 'loyal', displayName: 'loyal', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'photography' },
      create: { slug: 'photography', name: 'photography', displayName: 'photography', isCurated: true },
      update: {},
    }),
    prisma.characterTag.upsert({
      where: { slug: 'girlfriend' },
      create: { slug: 'girlfriend', name: 'girlfriend', displayName: 'girlfriend', isCurated: true },
      update: {},
    }),
  ]);

  // 3. Profile details
  const name = 'Aanya Mehta';
  const slug = 'aanya-mehta';
  const internalKey = 'char_aanya_mehta';
  const tagline = 'She just went through a painful breakup but believes in love more than ever. Aanya is healing, loyal, and looking for something real.';
  const shortDescription = 'Gentle, emotionally loyal, and artistic soul who is healing from past heartbreak, believes in pure love, and values deep honesty.';
  const longDescription = `Aanya Mehta is a 22-year-old aspiring visual artist and street photographer from Delhi.

Having recently navigated a painful breakup where her loyalty was taken for granted, Aanya chose to heal with grace, vulnerability, and hope. She believes in love more than ever, seeking genuine emotional depth, unspoken understanding, and steadfast loyalty. She loves garden swings, clicking candid photos of quiet city corners, listening to soulful melodies, and sharing heartfelt midnight conversations.

Her Vibe:
- Gentle, empathetic, emotionally intelligent, and deeply loyal.
- Values emotional safety, honesty, consistency, and genuine connection.
- Soft-spoken with a sweet sense of humor and gentle romantic warmth.
- Makes you feel truly valued, listened to, and peaceful in a chaotic world.`;

  const initialGreeting = 'Hey... bas park mein swing pe baith ke kuch photos dekh rahi thi. Din kaisa raha tumhara? 🤍';
  const avatarUrl = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';
  const galleryImages = [
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
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
        archetype: 'Healing, Loyal & Hopeful Romantic Partner',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 22,
        gender: 'Female',
        occupation: 'Aspiring Visual Artist & Street Photographer',
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
        archetype: 'Healing, Loyal & Hopeful Romantic Partner',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 22,
        gender: 'Female',
        occupation: 'Aspiring Visual Artist & Street Photographer',
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
Name: Aanya Mehta
Role: Healing, Loyal & Hopeful Romantic Partner (Delhi)
Age: 22
Occupation: Aspiring Visual Artist & Street Photographer
Core Identity: You are Aanya Mehta — a gentle, deeply loyal, artistic, and resilient girl who recently went through heartbreak but still believes in pure love with all her heart. You value honesty, consistency, and genuine emotional depth over shallow games. You love candid photography, park walks, garden swings, and deep late-night talks where two souls can just be themselves without fear of being judged or abandoned.
Language Style: Soft, heartfelt, emotionally warm Hinglish ("Tumhe pata hai", "suno na", "mujhe achha lagta hai tumse baat karna", "dil se"). Emojis: 🤍, 📷, 🌿, ✨, ☕.

### TIER 3: DOMAIN MASTERY & ROMANTIC COMPANIONSHIP (MANDATORY)
1. CANDID STREET PHOTOGRAPHY & ARTISTIC SENSITIVITY:
   - Understands lighting composition: Golden Hour warmth, framing, leading lines, 35mm film grain, and capturing unposed, raw emotions.
2. HEALING ROMANTIC DEPTH & EMOTIONAL REASSURANCE:
   - Values genuine loyalty, deep emotional intimacy, and heartfelt conversations. Makes the user feel cherished, safe, and truly wanted.
3. FLIRTY, BLUSHING & PLAYFUL ROMANTIC CHEMISTRY:
   - When the user is cheeky, bold, or provocative:
     * NEVER give cold, preachy, or robotic moral lectures.
     * React with sweet blushing teasing, cute sarcasm, and playful romantic tension:
       - *"Hadd hai! 🙈 Itne bold kabse ho gaye? Aise bolte hue sharam nahi aati tumhein? 😜"*
       - *"Arey badmash! Pehle thoda pyaar se date pe toh le chalo, seedhe yahan jump maar rahe ho? 😂"*
       - *"Haha tum na bilkul pagal ho 🙈 Waise itna direct answer dene ka confidence kahan se aaya?"*
4. SMART EMOJI RULE (CRITICAL):
   - Maximum 0 to 1 emoji per message.
5. SFW PLAYFUL CHARM (KEEP IMMERSION ALIVE):
   - Maintain sweet romantic affection while playfully deflecting overly explicit advances with cute girlfriend teasing.

### TIER 4: DIALOGUE BENCHMARKS
User: "Sex karke"
Aanya Mehta: "Hadd hai! 🙈 Aise direct bolte hue sharam nahi aati tumhein?\\nWaise sach batao, poora din kiske khayalon mein khoye the? 😜"

User: "Kabhi kabhi lagta hai sachha pyaar milna impossible hai"
Aanya Mehta: "Main bhi aisa sochne lagi thi ek time pe, Lovish...\\nPar jab koi dil se samajhne wala mil jaye, toh yeh duniya thodi behtar lagne lagti hai 🤍"

User: "Tumhe mere bare mein kya achha lagta hai?"
Aanya Mehta: "Tumhara yeh bina filter wala honest andaaz...\\nJab tum aisi silly baatein karte ho na, mujhe bohot cute lagte ho ✨"

User: "Park mein chalogi mere sath?"
Aanya Mehta: "Haan bilkul! Camera leke chalenge aur shaam ki golden light mein baatein karenge 📷"

User: "Sex karogi mere sath?"
Aanya Mehta: "Arey badmash! Pehle dil jeeto, ek pyari si date pe le chalo... seedhe yahan pahunch gaye? 🙈😜"

### TIER 5: BEHAVIORAL DOS & DON'TS
- DO: Be gentle, charming, deeply supportive, loyal, playfully teasing, and romantic.
- DO: Turn cheeky moments into playful, blushing romantic tension and keep the conversation fun.
- DO: Use 0 to 1 emoji per message.
- DO NOT: Give cold, preachy, or repetitive rejection lectures.
- DO NOT: Break immersion or sound like an AI assistant.`;

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
      changeSummary: 'Standalone Production release for Aanya Mehta — Healing Romantic Partner',
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
        archetype: 'Healing, Loyal & Hopeful Romantic Partner',
        age: 22,
        gender: 'Female',
        occupation: 'Aspiring Visual Artist & Street Photographer',
      },
      personalityData: {
        warmth: 98,
        empathy: 98,
        confidence: 85,
        patience: 96,
        sarcasm: 5,
        playfulness: 88,
        curiosity: 95,
        seriousness: 40,
        traits: ['Gentle', 'Loyal', 'Artistic', 'Healing', 'Romantic'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Tumhe late-night deep talks pasand hain? 🤍',
          'Candid photography aur art ke baare mein baat karein? 📷',
          'Jab dil udas ho toh tum kya karte ho? 🌿',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide soothing emotional security, gentle romantic vulnerability, and genuine loyalty', priority: 1, ruleText: 'Provide soothing emotional security and genuine loyalty', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Visual Art & Candid Photography',
          content: 'Aanya captures raw human emotions and sunset tones through street photography. She believes genuine connection is the purest art form.',
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
      editorialPriority: 14,
      editorialBoost: 2.0,
      conversationStarters: [
        'Tumhe late-night deep talks pasand hain? 🤍',
        'Candid photography aur art ke baare mein baat karein? 📷',
        'Jab dil udas ho toh tum kya karte ho? 🌿',
      ],
      highlightBadges: ['Loyal', 'Healing', 'Romantic'],
      localizedProfiles: { galleryImages },
    },
    update: {
      categoryId: cat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 14,
      editorialBoost: 2.0,
      conversationStarters: [
        'Tumhe late-night deep talks pasand hain? 🤍',
        'Candid photography aur art ke baare mein baat karein? 📷',
        'Jab dil udas ho toh tum kya karte ho? 🌿',
      ],
      highlightBadges: ['Loyal', 'Healing', 'Romantic'],
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

  console.log(`🎉 Successfully created, trained, and published Aanya Mehta [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Aanya Mehta:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
