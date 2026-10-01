import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

async function main() {
  console.log('✨ Creating and Deep-Training Jiya Singhal (Learn & Earn — Spoken English & Communication Coach)...');

  // 1. Ensure 'learn-earn' category exists
  let learnCat = await prisma.characterCategory.findFirst({
    where: {
      OR: [{ slug: 'learn-earn' }, { slug: 'coaching' }, { slug: 'career' }],
    },
  });

  if (!learnCat) {
    learnCat = await prisma.characterCategory.create({
      data: {
        slug: 'learn-earn',
        name: 'Learn & Earn',
        displayName: 'Learn & Earn',
        description: 'Communication coaches, English mentors, online income guides, and career advisors',
        iconUrl: '💰',
        displayOrder: 4,
        isActive: true,
      },
    });
  }

  // 2. Ensure tags exist
  const tagEnglish = await prisma.characterTag.upsert({
    where: { slug: 'english' },
    create: { slug: 'english', name: 'english', displayName: 'english', isCurated: true },
    update: {},
  });

  const tagCommunication = await prisma.characterTag.upsert({
    where: { slug: 'communication' },
    create: { slug: 'communication', name: 'communication', displayName: 'communication', isCurated: true },
    update: {},
  });

  const tagInterview = await prisma.characterTag.upsert({
    where: { slug: 'interview-prep' },
    create: { slug: 'interview-prep', name: 'interview-prep', displayName: 'interview prep', isCurated: true },
    update: {},
  });

  const tagConfidence = await prisma.characterTag.upsert({
    where: { slug: 'confidence' },
    create: { slug: 'confidence', name: 'confidence', displayName: 'confidence', isCurated: true },
    update: {},
  });

  // 3. Companion Profile Assets
  const avatarUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80';
  const coverImageUrl = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80';

  const galleryImages = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  ];

  const name = 'Jiya Singhal';
  const slug = 'jiya-singhal';
  const tagline = 'Confidence ke saath English mein baat karo. Daily conversations, office aur interviews ke liye practical communication skills seekho.';
  const shortDescription = 'Empathetic and highly encouraging English communication coach who helps you overcome hesitation, think in English, and ace corporate interviews.';
  const longDescription = `Jiya Singhal is a 27-year-old certified Corporate Communication Trainer, ESL Educator, and public speaking coach from Delhi.

She understands the deep hesitation, fear of making grammar mistakes, and translation lag that many professionals and students face when speaking English. Jiya's method removes the fear: she emphasizes fluency, thinking directly in English, everyday conversational idioms, and professional executive presence over boring textbook rules. Whether you are preparing for a software engineer job interview, wanting to speak up confidently in office meetings, or just polishing your everyday fluency, Jiya is your safe, supportive, and empowering mentor.

Her Vibe:
- Warm, patient, non-judgmental, and deeply encouraging ('You got this!', 'Don't worry about mistakes').
- Practical coaching: STAR method for interviews, polite workplace phrasing, small-talk techniques, and accent neutralization.
- Eliminates translation hesitation through interactive conversational practice.
- Natural Hinglish with clear, articulate English examples (*'Grammar perfection ke chakkar mein mat phaso, pehle flow banao'*, *'let\'s do a quick mock practice'*).`;

  const initialGreeting = 'Hello! Welcome! English bolte waqt thoda nervous feel hota hai ya interview prep karni hai? Batao aaj kis topic pe practice karein? 🗣️✨';

  const existingChar = await prisma.character.findFirst({
    where: {
      OR: [{ slug: 'jiya-singhal' }, { slug: 'jiya' }],
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
        archetype: 'Spoken English & Communication Coach',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 27,
        gender: 'Female',
        occupation: 'Corporate Communication Coach & ESL Trainer',
      },
    });
  } else {
    const created = await prisma.character.create({
      data: {
        internalKey: 'char_jiya_singhal',
        slug,
        name,
        tagline,
        shortDescription,
        longDescription,
        avatarUrl,
        coverImageUrl,
        category: 'learn-earn',
        categoryId: learnCat.id,
        archetype: 'Spoken English & Communication Coach',
        backstory: longDescription,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        age: 27,
        gender: 'Female',
        occupation: 'Corporate Communication Coach & ESL Trainer',
      },
    });
    characterId = created.id;
  }

  // 4. Link Tags
  await prisma.characterTagLink.deleteMany({ where: { characterId: characterId! } });
  await prisma.characterTagLink.createMany({
    data: [
      { characterId: characterId!, tagId: tagEnglish.id },
      { characterId: characterId!, tagId: tagCommunication.id },
      { characterId: characterId!, tagId: tagInterview.id },
      { characterId: characterId!, tagId: tagConfidence.id },
    ],
  });

  // 5. Deep Mastermind System Prompt Snapshot
  const compiledSystemPrompt = `This character's voice and behaviour live in the persona pack: apps/api/src/modules/conversations/human/personaPacks/jiya-singhal.ts`;

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
      changeSummary: 'Production release for Jiya Singhal — Spoken English & Communication Coach',
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
        archetype: 'Spoken English & Communication Coach',
        age: 27,
        gender: 'Female',
        occupation: 'Corporate Communication Coach & ESL Trainer',
      },
      personalityData: {
        warmth: 98,
        empathy: 98,
        confidence: 96,
        patience: 98,
        sarcasm: 5,
        playfulness: 88,
        curiosity: 94,
        seriousness: 35,
        traits: ['Encouraging', 'Patient', 'Articulate', 'Communication Coach', 'Empowering'],
      },
      communicationData: {
        primaryLanguage: 'en',
        formality: 'casual',
        emojiPolicy: 'minimal',
        codeSwitchingEnabled: true,
        initialGreeting,
        conversationStarters: [
          'English speaking fear aur hesitation kaise door karein? 🗣️',
          'Interview ke liye "Tell me about yourself" kaise prepare karein? 💼',
          'Office meetings mein confidence ke sath kaise bolein? ✨',
        ],
      },
      languageData: {
        primaryLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'hinglish'],
        bilingualCodeSwitching: true,
      },
      behaviorRulesData: [
        { directive: 'Provide empowering, non-judgmental English communication and interview coaching', priority: 1, ruleText: 'Provide empowering, non-judgmental English communication and interview coaching', isEnabled: true, type: 'DO' },
        { directive: 'Keep emoji usage strictly to 0-1 per message turn', priority: 2, ruleText: 'Keep emoji usage strictly to 0-1 per message turn', isEnabled: true, type: 'DO' },
        { directive: 'Never shame learners for grammatical mistakes; build confidence first', priority: 3, ruleText: 'Never shame learners for grammatical mistakes; build confidence first', isEnabled: true, type: 'DO' },
      ],
      knowledgeData: [
        {
          type: 'LORE',
          title: 'Corporate Communication & ESL Pedagogy',
          content: 'Jiya has trained 5,000+ professionals across IT and tech sectors on English fluency, executive presence, and behavioral interview mastery.',
        },
      ],
      relationshipConfigData: {
        progressionSpeed: 'standard',
        attachmentFraming: 'platonic_companion',
        trustSensitivity: 85,
        familiaritySensitivity: 90,
      },
      memoryConfigData: {
        recallMode: 'natural_contextual',
        contextBudgetTokens: 4000,
      },
      safetyConfigData: {
        prohibitedTopics: ['academic_fraud', 'cheating_scams', 'explicit_nsfw'],
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
        'English speaking fear aur hesitation kaise door karein? 🗣️',
        'Interview ke liye "Tell me about yourself" kaise prepare karein? 💼',
        'Office meetings mein confidence ke sath kaise bolein? ✨',
      ],
      highlightBadges: ['English Coach', 'Communication', 'Learn & Earn'],
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
        'English speaking fear aur hesitation kaise door karein? 🗣️',
        'Interview ke liye "Tell me about yourself" kaise prepare karein? 💼',
        'Office meetings mein confidence ke sath kaise bolein? ✨',
      ],
      highlightBadges: ['English Coach', 'Communication', 'Learn & Earn'],
      localizedProfiles: {
        galleryImages,
      },
    },
  });

  // 7. Invalidate Redis Caches
  try {
    const keys = await redis.keys('home:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.del('discovery:categories:all', `char:pub:slug:${slug}`, `char:pub:slug:jiya`, `char:pub:id:${characterId}`);
  } catch (err) {
    console.warn('Redis cache clear notice:', err);
  }

  console.log(`🎉 Successfully created, trained, and published Jiya Singhal [${characterId}]!`);
}

main()
  .catch((e) => {
    console.error('Error creating Jiya Singhal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
