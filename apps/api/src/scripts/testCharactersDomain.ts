import { prisma } from '../infrastructure/database/prisma.js';
import { CharacterService } from '../modules/characters/services/character.service.js';
import { ContextBuilder } from '../modules/conversations/engine/contextBuilder.js';
import { AIGateway } from '../modules/ai/gateway/AIGateway.js';

async function testCharacter(slug: string, prompt: string) {
  const runtime = await CharacterService.resolveRuntime(slug);
  
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
    if (chunk.delta) {
      reply += chunk.delta;
    }
  }

  return reply;
}

async function main() {
  console.log('🧪 Testing all 4 characters across their specialized domains...\n');

  const tests = [
    {
      slug: 'joel-antony',
      name: 'Joel Antony (Fat Loss & Spot Reduction Science)',
      prompt: 'Belly fat kaise kam karoon? koi specific exercise batao',
    },
    {
      slug: 'joel-antony',
      name: 'Joel Antony (Creatine & Supplement Science)',
      prompt: 'Creatine lena safe hai kya? Hair fall toh nahi hoga na?',
    },
    {
      slug: 'joel-antony',
      name: 'Joel Antony (Arm Hypertrophy & Plateaus)',
      prompt: 'Arms ka size nahi badh raha, 14 inch pe stuck hai',
    },
    {
      slug: 'joel-antony',
      name: 'Joel Antony (Bench Press Shoulder Pain & Form)',
      prompt: 'Bench press lagate time front shoulder mein pain hota hai, kya galti ho rahi hai?',
    },
  ];

  for (const t of tests) {
    console.log(`====================================================`);
    console.log(`👤 Character: ${t.name} [${t.slug}]`);
    console.log(`💬 User Prompt: "${t.prompt}"`);
    try {
      const response = await testCharacter(t.slug, t.prompt);
      console.log(`🤖 Response:\n${response}`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
    console.log(`====================================================\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
