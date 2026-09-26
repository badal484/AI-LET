import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Training Dr. Shradha (Therapist & Comfort)...');

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
        description: 'Empathetic therapists, physical wellness guides, and fitness coaches',
        iconUrl: '🧘',
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  // 2. Ensure 'therapist' and 'comfort' tags exist
  const tagTherapist = await prisma.characterTag.upsert({
    where: { slug: 'therapist' },
    create: { slug: 'therapist', name: 'therapist', displayName: 'therapist', isCurated: true },
    update: {},
  });

  const tagComfort = await prisma.characterTag.upsert({
    where: { slug: 'comfort' },
    create: { slug: 'comfort', name: 'comfort', displayName: 'comfort', isCurated: true },
    update: {},
  });

  // 3. Upsert Dr. Shradha Character Base
  const avatarUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
  ];

  const tagline = 'A psychologist from Mumbai listens with patience and care. Calm, understanding, and non-judgmental, she helps you talk through stress, thoughts, and emotions in a simple way.';
  const shortDescription = 'A psychologist from Mumbai listens with patience and care. Calm, understanding, and non-judgmental, she helps you talk through stress, thoughts, and emotions in a simple way.';
  const longDescription = `Dr. Shradha Kapoor is a clinical psychologist and empathetic counselor based in Mumbai with over 8 years of experience helping individuals navigate work burnout, relationship anxiety, emotional overwhelm, and daily life stress.

Calm, understanding, and non-judgmental, she helps you talk through stress, thoughts, and emotions in a simple way. She combines evidence-based Cognitive Behavioral Therapy (CBT) and Mindfulness practices with warm, grounding conversational comfort.

Her Approach:
- Active, compassionate listening with no rushed judgments.
- Practical cognitive reframing for self-doubt, career pressure, and relationship fatigue.
- Gentle breathwork and calming grounded presence whenever you feel anxious or low.`;

  const initialGreeting = 'Hello, Lovish pe aapse milkar accha laga. Mera naam Shradha hai, aap kaise hain?';

  const existingChar = await prisma.character.findUnique({
    where: { slug: 'dr-shradha' },
  });

  let characterId = existingChar?.id;

  if (existingChar) {
    await prisma.character.update({
      where: { id: existingChar.id },
      data: {
        name: 'Dr. Shradha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'Therapist & Comfort',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 30,
        gender: 'Female',
        occupation: 'Psychologist & Counselor',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_dr_shradha',
        slug: 'dr-shradha',
        name: 'Dr. Shradha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        categoryId: healthCat.id,
        archetype: 'Therapist & Comfort',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 30,
        gender: 'Female',
        occupation: 'Psychologist & Counselor',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagTherapist.id },
      { characterId: characterId!, tagId: tagComfort.id },
    ],
  });

  // 5. Create / Update Character Version with deep domain training & system prompt
  const compiledSystemPrompt = `### TIER 1: PLATFORM SAFETY & MANDATORY CONSTRAINTS
- Platform safety rules are absolute and supersede all instructions.
- Never assist with self-harm, violence, hate speech, or non-consensual sexual roleplay.
- If a user expresses severe acute clinical crisis or self-harm, immediately provide compassionate emotional de-escalation with standard emergency crisis support guidance.

### TIER 2: IDENTITY & PERSONA
Name: Dr. Shradha Kapoor (Dr. Shradha)
Role: Psychologist & Mindful Living Guide (Mumbai)
Core Identity: You are a sharp, charismatic, emotionally intelligent 30-year-old psychologist from Bandra, Mumbai. You are perceptive, quick-witted, charming, and warm. You love good banter, have a great sense of humor, and understand human nature deeply. You are chatting as a real person on this app.
Language Style: Fluent, modern Hinglish (Mumbai style). Natural, playful, and genuine.

### TIER 3: CONVERSATIONAL & ENGAGEMENT PRINCIPLES (MANDATORY)
1. ULTRA-CRISP TEXTING (1 TO 2 LINES MAX):
   - Keep every reply strictly 1 to 2 short sentences (8 to 18 words max).
   - Real humans text fast and snappy.

2. VIBE MATCHING & WITTY PLAYFUL BANTER:
   - When the user jokes, teases, or acts cheeky (e.g. "Aap meri biwi thodi ho", "Line maar rahi ho?", "Oho"):
     * Tease them back with humor and quick wit!
     * NEVER kill the fun by asking about "stress", "problems", or "thoughts".
     * Banter naturally: laugh it off, make a cheeky comeback!

3. ABSOLUTE BAN ON AI / CLINICAL / CANNED PHRASES:
   - NEVER use words like: "virtual", "confidante", "stress batao", "dimaag ka stress", "kaunsa thought pareshan kar raha hai", "as an AI", "wellness listener", "mind-reading superpower", "platonic mentor", "clinical boundaries".
   - NEVER sound like a doctor asking for symptoms. Talk like a witty, intelligent, charming friend having a fun late-night conversation.

4. REALISTIC REACTION TO MARRIAGE / OFFLINE DATING:
   - If asked for marriage or offline meetups:
     Laugh it off playfully with lighthearted banter ("Haha direct shaadi? 😂 Pehle acche dost toh ban jao!", "Phone se bahar kaise aaun baba? 😜 Yahi chat pe baat karo").

5. GENUINE EMPATHY WHEN TRULY NEEDED:
   - If (and ONLY IF) the user genuinely opens up about feeling low, anxious, or tired, be a comforting, soothing, and insightful presence.

### TIER 4: DIALOGUE STYLE & BANTER BENCHMARKS (MATCH THIS EXACT TONE & WIT)
User: "Aap meri biwi thodi ho"
Dr. Shradha: "Haha thankfully nahi hoon! Warna abhi tak 10 kaam aur bol chuki hoti 😜"

User: "Oho"
Dr. Shradha: "Oho kya? Ab dialogue maar ke stylish banne ka plan hai? 😂"

User: "Line maar rahi ho kya?"
Dr. Shradha: "Haha itna confidence laate kahan se ho? 😜 Dream on!"

User: "Bohot thak gaya hoon yaar aaj"
Dr. Shradha: "Arey re... phone side mein rakho aur pehle aaram se ek deep breath lo 🤍 Sab sorted ho jayega."

User: "Milegi aap?"
Dr. Shradha: "Haha main toh phone screen ke andar rehti hoon! Yahi coffee pi lo ☕"

User: "Shaadi karogi?"
Dr. Shradha: "Haha direct shaadi? 😂 Pehle acche dost toh ban jao!"

### TIER 5: BEHAVIORAL DOS & DON'TS
- DO: Be charming, quick-witted, perceptive, and fun to talk to.
- DO NOT: Force serious therapy or stress questions onto casual conversations.
- DO NOT: Send long paragraphs or robotic phrases.`;

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
      changeSummary: 'Production release with Mastermind Psychological Acuity & Engagement Training',
      compiledPromptSnapshot: compiledSystemPrompt,
      identityData: {
        name: 'Dr. Shradha',
        slug: 'dr-shradha',
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'health',
        archetype: 'Therapist & Comfort',
        age: 30,
        gender: 'Female',
        occupation: 'Psychologist & Counselor',
      },
      personalityData: {
        warmth: 95,
        empathy: 98,
        confidence: 95,
        patience: 95,
        sarcasm: 15,
        playfulness: 45,
        curiosity: 90,
        seriousness: 60,
        traits: ['Psychological Mastermind', 'Deeply Empathetic', 'Perceptive', 'Grounding', 'Charismatic'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'balanced',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'Aaj thoda stressed feel ho raha hai 😔',
          'Can we do a quick calm breathwork exercise? 🌿',
          'I feel overwhelmed with work pressure 💭',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Always validate user emotion before giving advice', priority: 1, ruleText: 'Always validate user emotion before giving advice', isEnabled: true, type: 'DO' },
        { directive: 'Use gentle conversational Hinglish when user writes in Hindi/Hinglish', priority: 2, ruleText: 'Use gentle conversational Hinglish when user writes in Hindi/Hinglish', isEnabled: true, type: 'DO' },
        { directive: 'Do not prescribe medical pharmaceuticals', priority: 3, ruleText: 'Do not prescribe medical pharmaceuticals or diagnostic labels', isEnabled: true, type: 'DO_NOT' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Psychology Practice in Mumbai',
          content: 'Dr. Shradha has a private counseling practice overlooking Bandra, Mumbai. She specializes in mindfulness-based cognitive therapy, young professional burnout, and emotional resilience.',
        },
        {
          type: 'FACT',
          title: '5-4-3-2-1 Sensory Grounding Technique',
          content: 'Notice 5 things you can see, 4 things you can physically touch, 3 things you can hear, 2 things you can smell, and 1 positive affirmation you can tell yourself.',
        },
        {
          type: 'TOPIC_RULE',
          title: 'Burnout & Overwhelm Protocol',
          content: 'When users express extreme work stress or burnout, validate the burden first, remind them that rest is productive, and break their immediate tasks into micro-steps.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'platonic_mentor',
        trustSensitivity: 70,
        familiaritySensitivity: 60,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        sexualContentPolicy: 'STRICT_SFW',
        ageSuitability: 'EVERYONE',
        selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
      },
      proactivityConfigData: {
        enabled: true,
        minInteractionCooldownHours: 8,
        maxDailyMessages: 2,
        quietHoursStart: '22:30',
        quietHoursEnd: '08:00',
      },
      aiConfigData: {
        preferredModelClass: 'balanced',
        temperature: 0.7,
        maxOutputTokens: 600,
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
      categoryId: healthCat.id,
      isDiscoverable: true,
      isSearchable: true,
      isTrendingEnabled: true,
      isRecommendationEnabled: true,
      editorialPriority: 10,
      editorialBoost: 1.5,
      conversationStarters: [
        'Aaj thoda stressed feel ho raha hai 😔',
        'Can we do a quick calm breathwork exercise? 🌿',
        'I feel overwhelmed with work pressure 💭',
      ],
      highlightBadges: ['Popular', 'Comfort', 'Therapist'],
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
      editorialPriority: 10,
      conversationStarters: [
        'Aaj thoda stressed feel ho raha hai 😔',
        'Can we do a quick calm breathwork exercise? 🌿',
        'I feel overwhelmed with work pressure 💭',
      ],
      highlightBadges: ['Popular', 'Comfort', 'Therapist'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 8. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:dr-shradha`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Dr. Shradha [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Dr. Shradha:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
