import { prisma } from '../infrastructure/database/prisma.js';
import { CharacterService } from '../modules/characters/services/character.service.js';
import { ContextBuilder } from '../modules/conversations/engine/contextBuilder.js';
import { AIGateway } from '../modules/ai/gateway/AIGateway.js';

async function testPersonalizedCharacter(slug: string, prompt: string, userMemories: string) {
  const runtime = await CharacterService.resolveRuntime(slug);

  const mockMemoryProvider = {
    getMemoryContext: async () => ({
      memoriesText: userMemories,
      retrievedMemoryIds: ['mem-1', 'mem-2'],
    }),
  };
  
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

  const activeProvider = (runtime.aiConfig as any)?.provider || 'google';
  const activeModel = runtime.aiConfig?.customModelName || 'gemini-3.5-flash-lite';

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
      console.error('Stream failure:', chunk.error);
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
      slug: 'tanu-verma',
      name: 'Tanu Verma (College Nostalgia & Bollywood Suggestion)',
      prompt: 'Bohot thak gaya hoon aaj office se, koi acchi feel-good Bollywood movie batao na',
    },
    {
      slug: 'tanu-verma',
      name: 'Tanu Verma (Indore Street Food & Late Night Talk)',
      prompt: 'Indore ke Sarafa night market mein sabse best kya milta hai?',
    },
    {
      slug: 'tanu-verma',
      name: 'Tanu Verma (Cheeky Bollywood Banter & Boundary)',
      prompt: 'Shaadi karogi mujhse?',
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
