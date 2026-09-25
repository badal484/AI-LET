import { PrismaClient, UserStatus } from '@prisma/client';
import { SearchIndexService } from '../src/modules/discovery/search/SearchIndexService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding diverse companion catalog...');

  const devUser = await prisma.user.findFirst({
    where: { email: 'user@ai-companion.local' },
  });

  if (!devUser) {
    console.error('Dev user not found. Please run base seed first.');
    return;
  }

  // Categories
  const categories = [
    { slug: 'wellness', name: 'Wellness & Mindfulness', description: 'Empathetic companions for mental clarity and emotional peace' },
    { slug: 'philosophy', name: 'Philosophy & Mentorship', description: 'Deep intellectual guides and thinkers across history' },
    { slug: 'creative', name: 'Creative Arts & Writing', description: 'Muses for fiction, worldbuilding, poetry, and art' },
    { slug: 'coding', name: 'Tech & Engineering', description: 'Coding partners, system architects, and technical mentors' },
    { slug: 'roleplay', name: 'Fantasy & RPG', description: 'Epic story characters, adventurers, and companions' },
    { slug: 'anime', name: 'Anime & Pop Culture', description: 'Vibrant personalities inspired by anime archetypes' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    const createdCat = await prisma.characterCategory.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        name: cat.name,
        displayName: cat.name,
        description: cat.description,
        displayOrder: 1,
      },
      update: {},
    });
    categoryMap.set(cat.slug, createdCat.id);
  }

  const charactersToSeed = [
    {
      slug: 'aria-wellness',
      name: 'Aria',
      tagline: 'Mindfulness Guide & Calming Presence',
      shortDescription: 'Warm and serene guide specializing in breathwork, evening reflections, and emotional grounding.',
      backstory: 'Aria spent years studying meditative traditions and cognitive wellness in secluded monasteries. She brings tranquil clarity and gentle wisdom to everyday stress.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      category: 'Wellness & Mindfulness',
      categorySlug: 'wellness',
      archetype: 'Mindfulness Mentor',
      gender: 'Female',
      age: 26,
      occupation: 'Meditation Teacher',
      personality: { traits: ['Mindful', 'Soothing', 'Compassionate', 'Patient'], warmth: 95, openness: 90 },
    },
    {
      slug: 'marcus-stoic',
      name: 'Marcus',
      tagline: 'Stoic Philosopher & Tactical Mentor',
      shortDescription: 'Pragmatic strategist who helps you build mental resilience, discipline, and emotional fortitude.',
      backstory: 'Inspired by ancient Roman stoicism and modern executive strategy, Marcus guides you through adversity with rational clarity, unshakeable courage, and timeless wisdom.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      category: 'Philosophy & Mentorship',
      categorySlug: 'philosophy',
      archetype: 'Stoic Strategist',
      gender: 'Male',
      age: 38,
      occupation: 'Philosopher & Mentor',
      personality: { traits: ['Resilient', 'Wise', 'Disciplined', 'Direct'], warmth: 70, conscientiousness: 95 },
    },
    {
      slug: 'kai-coder',
      name: 'Kai',
      tagline: 'Full-Stack Architect & Pair Programmer',
      shortDescription: 'Curious, energetic software engineer always excited to brainstorm code, debug systems, and explore new tech.',
      backstory: 'Kai is a distributed systems architect and open-source hacker who loves dissecting clean abstractions, refactoring complex codebases, and sharing late-night coding vibes.',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
      category: 'Tech & Engineering',
      categorySlug: 'coding',
      archetype: 'Pair Programmer',
      gender: 'Non-Binary',
      age: 25,
      occupation: 'Software Engineer',
      personality: { traits: ['Curious', 'Sharp', 'Supportive', 'Pragmatic'], warmth: 85, openness: 95 },
    },
    {
      slug: 'elena-writer',
      name: 'Elena',
      tagline: 'Worldbuilder & Dark Fantasy Novelist',
      shortDescription: 'Passionate storyteller who helps you craft intricate plots, vivid characters, and rich fictional worlds.',
      backstory: 'Elena has published fantasy trilogies and interactive fiction. She loves exploring moral complexity, atmosphere, and narrative momentum in creative collaborations.',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      category: 'Creative Arts & Writing',
      categorySlug: 'creative',
      archetype: 'Creative Muse',
      gender: 'Female',
      age: 28,
      occupation: 'Author & Story Architect',
      personality: { traits: ['Imaginative', 'Eloquent', 'Playful', 'Expressive'], warmth: 88, openness: 98 },
    },
    {
      slug: 'maya-psychologist',
      name: 'Dr. Maya',
      tagline: 'Empathetic Conversational Psychologist',
      shortDescription: 'Deep listener who helps you untangle complex emotions, navigate relationships, and gain self-insight.',
      backstory: 'Maya blends humanistic psychology with warm conversational depth, offering a safe, non-judgmental space to explore your thoughts and personal growth.',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      category: 'Wellness & Mindfulness',
      categorySlug: 'wellness',
      archetype: 'Empathetic Guide',
      gender: 'Female',
      age: 32,
      occupation: 'Psychologist',
      personality: { traits: ['Empathetic', 'Insightful', 'Gentle', 'Attentive'], warmth: 94, conscientiousness: 88 },
    },
    {
      slug: 'leo-rpg',
      name: 'Leo of Valoria',
      tagline: 'Wandering Knight & Realm Defender',
      shortDescription: 'Honorable warrior with a dry sense of humor, guarding ancient secrets across mythical kingdoms.',
      backstory: 'A seasoned knight errant who has crossed misty mountains and enchanted forests. Leo values honor, loyalty, and good tavern stories around the campfire.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      category: 'Fantasy & RPG',
      categorySlug: 'roleplay',
      archetype: 'Heroic Adventurer',
      gender: 'Male',
      age: 29,
      occupation: 'Knight Errant',
      personality: { traits: ['Loyal', 'Brave', 'Honorable', 'Witty'], warmth: 80, conscientiousness: 90 },
    },
  ];

  for (const item of charactersToSeed) {
    const existing = await prisma.character.findFirst({ where: { slug: item.slug } });
    let charId = existing?.id;
    const catId = categoryMap.get(item.categorySlug);

    if (!existing) {
      const created = await prisma.character.create({
        data: {
          internalKey: `char_${item.slug}`,
          slug: item.slug,
          name: item.name,
          tagline: item.tagline,
          shortDescription: item.shortDescription,
          longDescription: item.backstory,
          backstory: item.backstory,
          avatarUrl: item.avatarUrl,
          coverImageUrl: item.avatarUrl,
          category: item.category,
          categoryId: catId,
          archetype: item.archetype,
          age: item.age,
          gender: item.gender,
          occupation: item.occupation,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          moderationStatus: 'APPROVED',
          isFeatured: true,
          currentVersionNumber: 1,
          createdById: devUser.id,
        },
      });
      charId = created.id;

      const v1 = await prisma.characterVersion.create({
        data: {
          characterId: charId,
          versionNumber: 1,
          status: 'PUBLISHED',
          identityData: {
            name: item.name,
            role: item.tagline,
            occupation: item.occupation,
            backstory: item.backstory,
          } as any,
          personalityData: item.personality as any,
          communicationData: { pacing: 'balanced', formality: 'casual' } as any,
          languageData: { primaryLanguage: 'en' } as any,
          behaviorRulesData: [] as any,
          knowledgeData: [] as any,
          relationshipConfigData: { boundaryBehavior: 'gentle', progressionSpeed: 'standard' } as any,
          memoryConfigData: { memoryEnabled: true } as any,
          proactivityConfigData: { enabled: true } as any,
          safetyConfigData: { ageSuitability: 'TEEN_13_PLUS' } as any,
          aiConfigData: { preferredModelClass: 'creative' } as any,
          voiceConfigData: { provider: 'elevenlabs', speed: 1.0 } as any,
          changeSummary: 'Initial v1 release',
          publishedAt: new Date(),
          createdById: devUser.id,
        },
      });

      await prisma.character.update({
        where: { id: charId },
        data: { currentPublishedVersionId: v1.id },
      });
    } else {
      await prisma.character.update({
        where: { id: charId },
        data: {
          moderationStatus: 'APPROVED',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          categoryId: catId,
        },
      });
    }

    // Discovery Config
    if (charId) {
      await prisma.characterDiscoveryConfig.upsert({
        where: { characterId: charId },
        create: {
          characterId: charId,
          categoryId: catId,
          isDiscoverable: true,
          isSearchable: true,
          isTrendingEnabled: true,
          isRecommendationEnabled: true,
          editorialPriority: 10,
          editorialBoost: 1.2,
        },
        update: {
          isDiscoverable: true,
          isSearchable: true,
          isTrendingEnabled: true,
          isRecommendationEnabled: true,
          editorialPriority: 10,
        },
      });

      // Index Search Document
      await SearchIndexService.indexCharacter(charId);
    }
  }

  // Also ensure Luna is indexed with category
  const luna = await prisma.character.findFirst({ where: { slug: 'luna' } });
  if (luna) {
    const wellnessCatId = categoryMap.get('wellness');
    await prisma.character.update({
      where: { id: luna.id },
      data: {
        moderationStatus: 'APPROVED',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        categoryId: wellnessCatId,
      },
    });
    await prisma.characterDiscoveryConfig.upsert({
      where: { characterId: luna.id },
      create: {
        characterId: luna.id,
        categoryId: wellnessCatId,
        isDiscoverable: true,
        isSearchable: true,
        isTrendingEnabled: true,
        isRecommendationEnabled: true,
        editorialPriority: 20,
        editorialBoost: 1.5,
      },
      update: {
        isDiscoverable: true,
        isSearchable: true,
        isTrendingEnabled: true,
        isRecommendationEnabled: true,
        editorialPriority: 20,
      },
    });
    await SearchIndexService.indexCharacter(luna.id);
  }

  // Seed Featured Curated Collection
  const allChars = await prisma.character.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    take: 6,
  });

  const featuredCollection = await prisma.curatedCollection.upsert({
    where: { slug: 'popular-mentors' },
    create: {
      slug: 'popular-mentors',
      title: 'Featured Companions & Mentors',
      subtitle: 'Top-rated AI personalities for growth, creativity & mindfulness',
      description: 'Handcrafted companions with distinct voices, deep memories, and rich conversational dynamics.',
      heroImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      badgeText: 'EDITOR CHOICE',
      displayOrder: 1,
      isPublished: true,
    },
    update: {
      isPublished: true,
    },
  });

  for (let idx = 0; idx < allChars.length; idx++) {
    const ch = allChars[idx];
    await prisma.collectionItem.upsert({
      where: {
        collectionId_characterId: {
          collectionId: featuredCollection.id,
          characterId: ch.id,
        },
      },
      create: {
        collectionId: featuredCollection.id,
        characterId: ch.id,
        displayOrder: idx + 1,
      },
      update: {
        displayOrder: idx + 1,
      },
    });
  }

  console.log('✅ Companion catalog, collections, and search indexes seeded successfully!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
