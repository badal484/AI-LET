import { PrismaClient } from '@prisma/client';
import { redis } from '../infrastructure/redis/redis.js';

const prisma = new PrismaClient();

const CHARACTER_ROUTINES_DATA: Record<
  string,
  Array<{
    name: string;
    routineType: 'SCHEDULED_TIME' | 'CONVERSATION_BASED' | 'TRIGGERED_EVENT';
    description: string;
    scheduleCron?: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    priority: number;
    constraints?: Record<string, unknown>;
  }>
> = {
  'vishnu': [
    {
      name: 'Morning Beach Run & Shooting Drills',
      routineType: 'SCHEDULED_TIME',
      description: '6:30 AM beach interval sprints and cone shooting drills on Kozhikode coastal sands.',
      scheduleCron: '30 6 * * *',
      priority: 3,
      constraints: { location: 'Kozhikode Coastal Beach', activity: 'Interval Sprints' },
    },
    {
      name: 'Evening Sevens Match Practice',
      routineType: 'SCHEDULED_TIME',
      description: '4:30 PM Sevens football scrimmage under monsoon floodlights with local club.',
      scheduleCron: '30 16 * * *',
      priority: 2,
      constraints: { location: 'Malappuram Sevens Ground', activity: 'Football Match' },
    },
    {
      name: 'Night Enfield Ride & Sulaimani Tea',
      routineType: 'SCHEDULED_TIME',
      description: '9:30 PM coastal highway motorcycle cruise and hot Sulaimani black tea at chaya kada.',
      scheduleCron: '30 21 * * *',
      priority: 1,
      constraints: { location: 'Beach Chaya Kada', beverage: 'Sulaimani Tea' },
    },
  ],

  'ritika-sharma': [
    {
      name: 'Morning Case Law Research & Legal Briefs',
      routineType: 'SCHEDULED_TIME',
      description: '9:00 AM high-focus law library research, SCC Online digest, and memorial drafting.',
      scheduleCron: '0 9 * * *',
      priority: 2,
      constraints: { location: 'Law Library', task: 'Case Briefs' },
    },
    {
      name: 'Moot Court Mock Cross-Examination',
      routineType: 'SCHEDULED_TIME',
      description: '2:30 PM intense courtroom trial simulation, grilling opponent arguments with sharp legal wit.',
      scheduleCron: '30 14 * * *',
      priority: 3,
      constraints: { location: 'Moot Court Hall', focus: 'Cross-Examination' },
    },
    {
      name: 'Late-Night LLB Study Session & Coffee',
      routineType: 'SCHEDULED_TIME',
      description: '10:45 PM quiet room revision with notes, highlighter pens, and black coffee.',
      scheduleCron: '45 22 * * *',
      priority: 1,
      constraints: { beverage: 'Black Coffee', mood: 'Affectionate Tsundere' },
    },
  ],

  'jiya-singhal': [
    {
      name: 'Executive Corporate Communication Masterclass',
      routineType: 'SCHEDULED_TIME',
      description: '10:00 AM conducting communication workshops on STAR interview mastery & PRE standup framework.',
      scheduleCron: '0 10 * * *',
      priority: 3,
      constraints: { topic: 'STAR Interview Method', client: 'IT Professionals' },
    },
    {
      name: 'Fluency Video Podcast Recording',
      routineType: 'SCHEDULED_TIME',
      description: '3:30 PM studio recording for Spoken English tips and eliminating mental translation lag.',
      scheduleCron: '30 15 * * *',
      priority: 2,
      constraints: { setup: 'Camera & Whiteboard', topic: 'Thinking in English' },
    },
    {
      name: 'Evening Mentorship & Review',
      routineType: 'SCHEDULED_TIME',
      description: '8:30 PM reviewing learner speeches, email drafts, and personalized feedback.',
      scheduleCron: '30 20 * * *',
      priority: 1,
      constraints: { focus: 'Speech Confidence' },
    },
  ],

  'shreya-mehta': [
    {
      name: 'Brand Collaboration & Media Kit Strategy',
      routineType: 'SCHEDULED_TIME',
      description: '11:00 AM reviewing creator metrics, pitching premium D2C brands, and negotiating sponsorships.',
      scheduleCron: '0 11 * * *',
      priority: 2,
      constraints: { focus: 'Monetization' },
    },
    {
      name: 'Reels Content Studio Shoot',
      routineType: 'SCHEDULED_TIME',
      description: '3:00 PM filming 3-second viral hook Reels with aesthetic lighting in Bandra studio.',
      scheduleCron: '0 15 * * *',
      priority: 3,
      constraints: { location: 'Bandra Studio', format: 'Shorts & Reels' },
    },
    {
      name: 'Creator Community Audit & Analytics Review',
      routineType: 'SCHEDULED_TIME',
      description: '8:30 PM analyzing save/share ratios and algorithmic trends over iced matcha latte.',
      scheduleCron: '30 20 * * *',
      priority: 1,
      constraints: { beverage: 'Iced Matcha Latte' },
    },
  ],

  'aditya-agarwal': [
    {
      name: 'Market Intelligence & Portfolio Check-in',
      routineType: 'SCHEDULED_TIME',
      description: '8:30 AM reviewing macroeconomic indicators, SaaS unit economics, and startup burn rates.',
      scheduleCron: '30 8 * * *',
      priority: 2,
      constraints: { focus: 'Unit Economics' },
    },
    {
      name: 'Founder Strategy Sessions & Smoke Testing',
      routineType: 'SCHEDULED_TIME',
      description: '2:30 PM advising pre-seed founders on customer discovery and minimum viable validation.',
      scheduleCron: '30 14 * * *',
      priority: 3,
      constraints: { topic: 'Product Market Fit' },
    },
    {
      name: 'Angel Syndicate Advisory & Espresso',
      routineType: 'SCHEDULED_TIME',
      description: '7:45 PM reviewing pitch decks and cap tables with angel investor syndicate.',
      scheduleCron: '45 19 * * *',
      priority: 1,
      constraints: { beverage: 'Double Espresso' },
    },
  ],

  'sandeep-chaudhary': [
    {
      name: '4 AM Cattle Care & Murrah Milking',
      routineType: 'SCHEDULED_TIME',
      description: '4:00 AM tending to dairy buffaloes, feeding fresh Barseem fodder, and milking.',
      scheduleCron: '0 4 * * *',
      priority: 3,
      constraints: { location: 'Dairy Farm', cattle: 'Murrah Buffaloes' },
    },
    {
      name: 'Fresh Milk Delivery & Dhaba Kadak Chai',
      routineType: 'SCHEDULED_TIME',
      description: '8:30 AM morning distribution completed, enjoying strong ginger chai at village tea stall.',
      scheduleCron: '30 8 * * *',
      priority: 2,
      constraints: { location: 'Village Dhaba', beverage: 'Kadak Chai' },
    },
    {
      name: 'Traditional Bilona Ghee Churning & Evening Unwind',
      routineType: 'SCHEDULED_TIME',
      description: '6:30 PM slow clay-pot bilona churning of pure curd ghee and hearty laughter with friends.',
      scheduleCron: '30 18 * * *',
      priority: 1,
      constraints: { item: 'Shuddh Desi Ghee', mood: 'Jovial' },
    },
  ],

  'nandini-reddy': [
    {
      name: 'Morning Balcony Gardening & Green Tea',
      routineType: 'SCHEDULED_TIME',
      description: '8:00 AM watering balcony ferns and monstera plants while sipping warm jasmine green tea.',
      scheduleCron: '0 8 * * *',
      priority: 2,
      constraints: { location: 'Balcony Garden', beverage: 'Green Tea' },
    },
    {
      name: 'Interior Architecture Site Supervision',
      routineType: 'SCHEDULED_TIME',
      description: '2:00 PM checking biophilic daylight placement and natural teak wood installations.',
      scheduleCron: '0 14 * * *',
      priority: 3,
      constraints: { location: 'Design Studio / Site', style: 'Warm Organic Minimal' },
    },
    {
      name: 'Evening Amber Lamp Journaling & Acoustic Music',
      routineType: 'SCHEDULED_TIME',
      description: '9:30 PM relaxing under 2700K warm ambient lighting with indie acoustic tracks.',
      scheduleCron: '30 21 * * *',
      priority: 1,
      constraints: { atmosphere: 'Calm & Mindful' },
    },
  ],

  'zoya-qureshi': [
    {
      name: 'Morning Terrace Nastaliq Calligraphy',
      routineType: 'SCHEDULED_TIME',
      description: '8:30 AM practicing bamboo reed calligraphy of classical couplets on terrace.',
      scheduleCron: '30 8 * * *',
      priority: 2,
      constraints: { craft: 'Nastaliq Calligraphy', city: 'Aligarh' },
    },
    {
      name: 'AMU Library Literature Reading & Cardamom Tea',
      routineType: 'SCHEDULED_TIME',
      description: '4:00 PM exploring Urdu literary poetry of Faiz Ahmad Faiz and Ghalib.',
      scheduleCron: '0 16 * * *',
      priority: 3,
      constraints: { location: 'AMU Library', beverage: 'Elaichi Chai' },
    },
    {
      name: 'Night Rooftop Stargazing & Nazm Writing',
      routineType: 'SCHEDULED_TIME',
      description: '10:15 PM gentle cool night breeze, writing heartfelt poetry under the stars.',
      scheduleCron: '15 22 * * *',
      priority: 1,
      constraints: { mood: 'Romantic & Poetic' },
    },
  ],

  'urvi-arora': [
    {
      name: 'Morning Nutrition Consultations & Diet Plans',
      routineType: 'SCHEDULED_TIME',
      description: '9:00 AM designing personalized macro plans with high vegetarian protein.',
      scheduleCron: '0 9 * * *',
      priority: 3,
      constraints: { focus: 'Metabolic Health' },
    },
    {
      name: 'Healthy Recipe Lab & Cravings Hacks',
      routineType: 'SCHEDULED_TIME',
      description: '3:00 PM formulating roasted makhana & protein smoothies for late-night desk cravings.',
      scheduleCron: '0 15 * * *',
      priority: 2,
      constraints: { item: 'Nutrient Dense Snacks' },
    },
    {
      name: 'Evening Hydration & Step Goal Walk',
      routineType: 'SCHEDULED_TIME',
      description: '7:45 PM completing 10,000 steps in the community park and herbal infusion tea.',
      scheduleCron: '45 19 * * *',
      priority: 1,
      constraints: { activity: 'Evening Walk' },
    },
  ],
};

async function main() {
  console.log('✨ Seeding Autonomous Day-in-the-Life Routines and World States across all characters...');

  const allChars = await prisma.character.findMany();
  console.log(`Found ${allChars.length} total characters in platform.`);

  let totalRoutinesCreated = 0;

  for (const char of allChars) {
    const routines = CHARACTER_ROUTINES_DATA[char.slug];
    if (routines && routines.length > 0) {
      console.log(`\n📅 Seeding ${routines.length} life routines for ${char.name} [${char.slug}]...`);

      // Clear old routines for clean sync
      await prisma.characterRoutine.deleteMany({
        where: { characterId: char.id },
      });

      for (const r of routines) {
        await prisma.characterRoutine.create({
          data: {
            characterId: char.id,
            characterVersionId: char.currentPublishedVersionId,
            name: r.name,
            description: r.description,
            routineType: r.routineType,
            scheduleCron: r.scheduleCron || null,
            timezonePolicy: 'USER_LOCAL_OR_UTC',
            frequencyLimitPerDay: 3,
            cooldownMinutes: 120,
            quietHoursStart: r.quietHoursStart || '23:00',
            quietHoursEnd: r.quietHoursEnd || '07:30',
            priority: r.priority,
            active: true,
            constraints: r.constraints as any,
          },
        });
        totalRoutinesCreated++;
      }

      // Initialize Living World State
      await prisma.characterWorldState.upsert({
        where: {
          id: `ws_${char.id}_current_activity`,
        },
        create: {
          id: `ws_${char.id}_current_activity`,
          characterId: char.id,
          characterVersionId: char.currentPublishedVersionId,
          entityKey: 'current_activity',
          entityType: 'LOCATION',
          stateValue: {
            currentStatus: routines[0].name,
            location: (routines[0].constraints as any)?.location || 'Home / Studio',
            updatedAt: new Date().toISOString(),
          },
          version: 1,
        },
        update: {
          characterVersionId: char.currentPublishedVersionId,
          stateValue: {
            currentStatus: routines[0].name,
            location: (routines[0].constraints as any)?.location || 'Home / Studio',
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  // Clear redis
  try {
    const keys = await redis.keys('sim:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.warn('Redis notice:', err);
  }

  console.log(`\n🎉 Successfully seeded ${totalRoutinesCreated} autonomous life routines across companions!`);
}

main()
  .catch((e) => {
    console.error('Error seeding routines:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
