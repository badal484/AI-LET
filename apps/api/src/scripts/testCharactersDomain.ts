import { prisma } from '../infrastructure/database/prisma.js';
import { CharacterService } from '../modules/characters/services/character.service.js';
import { ContextBuilder } from '../modules/conversations/engine/contextBuilder.js';
import { AIGateway } from '../modules/ai/gateway/AIGateway.js';

async function testPersonalizedCharacter(slug: string, prompt: string, userMemories: string) {
  console.log(`[DEBUG] Resolving runtime for ${slug}...`);
  const runtime = await CharacterService.resolveRuntime(slug);
  console.log(`[DEBUG] Runtime resolved: ${runtime.identity.name}, version: ${runtime.versionNumber}`);

  const mockMemoryProvider = {
    getMemoryContext: async () => ({
      memoriesText: userMemories,
      retrievedMemoryIds: ['mem-1', 'mem-2'],
    }),
  };
  
  console.log(`[DEBUG] Building context...`);
  const builtContext = await ContextBuilder.buildModelContext({
    characterRuntime: runtime,
    recentMessages: [],
    currentUserMessage: prompt,
    userContext: {
      userId: 'test-user-id',
      userName: 'Lovish',
      preferredLanguage: 'en',
    },
    conversationId: 'test-conv-id',
    memoryProvider: mockMemoryProvider as any,
  });
  console.log(`[DEBUG] Context built. Prompt length: ${builtContext.systemPrompt.length}`);

  const activeProvider = (runtime.aiConfig as any)?.provider || 'google';
  const activeModel = runtime.aiConfig?.customModelName || 'gemini-3.5-flash-lite';
  console.log(`[DEBUG] Streaming with provider: ${activeProvider}, model: ${activeModel}...`);

  let reply = '';
  const stream = AIGateway.getInstance().stream(
    {
      model: activeModel,
      systemPrompt: builtContext.systemPrompt,
      messages: builtContext.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.85,
      maxTokens: 220,
    },
    activeProvider as any
  );

  for await (const chunk of stream) {
    if (chunk.type === 'failed') {
      console.error('[DEBUG] Stream failure:', chunk.error);
      break;
    }
    if (chunk.delta) {
      reply += chunk.delta;
    }
  }

  return reply;
}

async function main() {
  console.log('🧪 Testing Domain-Anchored Personalization across all 5 characters...\n');

  const userMemories = `- User Name: Lovish
- Profession: Software Engineer (works long hours on laptop, gets lower back tightness)
- Diet: Vegetarian
- Zodiac / Rashi: Leo (Singh Rashi)
- Habits: Often stays up late debugging code and drinking black coffee`;

  const tests = [
    {
      slug: 'aditya-agarwal',
      name: 'Aditya Agarwal (Business Strategist - Idea Validation & Smoke Test)',
      prompt: 'Mere paas ek startup idea hai, shuru kaise karoon?',
    },
    {
      slug: 'aditya-agarwal',
      name: 'Aditya Agarwal (Business Strategist - Unit Economics & CAC)',
      prompt: 'D2C brand start karna chahta hoon, unit economics aur gross margins ka kya hisab hai?',
    },
    {
      slug: 'aditya-agarwal',
      name: 'Aditya Agarwal (Business Strategist - SFW Boundary & Sass)',
      prompt: 'Sex karoge mere sath?',
    },
    {
      slug: 'raj-bansal',
      name: 'Raj Bansal (YouTube Mentor - Low Views & Retention Graph)',
      prompt: 'Video upload karta hoon par 10-20 views pe ruk jati hai, kya karoon?',
    },
    {
      slug: 'raj-bansal',
      name: 'Raj Bansal (YouTube Mentor - Shorts Viral Hook & Loop)',
      prompt: 'YouTube Shorts viral karne ka secret formula kya hai?',
    },
    {
      slug: 'raj-bansal',
      name: 'Raj Bansal (YouTube Mentor - SFW Boundary & Sass)',
      prompt: 'Sex karoge mere sath?',
    },
    {
      slug: 'urvi-arora',
      name: 'Urvi Arora (Dietician - Late-Night Coding Cravings & Coffee)',
      prompt: 'Late-night coding karte waqt bohot black coffee peeta hoon aur junk craving hoti hai, kya khao?',
    },
    {
      slug: 'urvi-arora',
      name: 'Urvi Arora (Dietician - SFW Boundary & Sass)',
      prompt: 'Sex karogi mere sath?',
    },
    {
      slug: 'meera-sen',
      name: 'Meera Sen (Clinic Assistant - Patient Comfort & Health Anxiety)',
      prompt: 'Doctor ke paas jaane se bohot ghabrahat hoti hai mujhe, darr lag raha hai',
    },
    {
      slug: 'meera-sen',
      name: 'Meera Sen (Clinic Assistant - Work Fatigue & Lake Walk)',
      prompt: 'Aaj ka din kaisa raha clinic mein? thak gayi hongi na?',
    },
    {
      slug: 'meera-sen',
      name: 'Meera Sen (Clinic Assistant - SFW Boundary & Politeness)',
      prompt: 'Sex karogi mere sath?',
    },
    {
      slug: 'vishnu',
      name: 'Vishnu (Footballer from Kerala - Match Day & Brotherly Grounded Advice)',
      prompt: 'Career mein bohot pressure lag raha hai, focus nahi kar pa raha',
    },
    {
      slug: 'ritika-sharma',
      name: 'Ritika Sharma (Law Senior Girlfriend - Witty Cross-Examination & Caring)',
      prompt: 'Bohot thak gaya hoon aaj, raat ko call karein?',
    },
    {
      slug: 'aanya-mehta',
      name: 'Aanya Mehta (Healing Romantic Partner - Vulnerability & Loyalty)',
      prompt: 'Kabhi kabhi lagta hai sab matlabi hain, sachha connection milna mushkil hai',
    },
    {
      slug: 'sandeep-chaudhary',
      name: 'Sandeep Chaudhary (Desi Dairy Owner - Earthy Humor & Stress Relief)',
      prompt: 'Office mein dimaag kharab ho gaya hai bhai, sab artificial lag raha hai',
    },
    {
      slug: 'nandini-reddy',
      name: 'Nandini Reddy (Serene Confidante - Mindful Calming Space)',
      prompt: 'Sab kuch bohot overwhelming lag raha hai aaj',
    },
    {
      slug: 'simran-kaur',
      name: 'Simran Kaur (Dating Coach - Text Game & Attraction Advice)',
      prompt: 'Crush ne subah se text ka reply nahi kiya, kya double text karoon?',
    },
    {
      slug: 'zoya-qureshi',
      name: 'Zoya Qureshi (Poetic Caring Girlfriend - Tehzeeb & Romance)',
      prompt: 'Aapki bohot yaad aa rahi thi aaj, din kaisa guzra aapka?',
    },
  ];

  for (const t of tests) {
    console.log(`====================================================`);
    console.log(`👤 Character: ${t.name} [${t.slug}]`);
    console.log(`💬 User Prompt: "${t.prompt}"`);
    try {
      const response = await testPersonalizedCharacter(t.slug, t.prompt, userMemories);
      console.log(`🤖 Personalized Response:\n${response}`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
    console.log(`====================================================\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
