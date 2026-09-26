import { prisma } from '../infrastructure/database/prisma.js';
import { CharacterService } from '../modules/characters/services/character.service.js';
import { ContextBuilder } from '../modules/conversations/engine/contextBuilder.js';
import { AIGateway } from '../modules/ai/gateway/AIGateway.js';

async function testTurn(slug: string, prompt: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
  const runtime = await CharacterService.resolveRuntime(slug);

  const mockMemoryProvider = {
    getMemoryContext: async () => ({
      memoriesText: '- User Name: Lovish\n- Profession: Software Engineer\n- Relationship: Close and playful',
      retrievedMemoryIds: ['mem-1'],
    }),
  };

  const builtContext = await ContextBuilder.buildModelContext({
    characterRuntime: runtime,
    recentMessages: history,
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
      console.error('Stream error:', chunk.error);
      break;
    }
    if (chunk.delta) {
      reply += chunk.delta;
    }
  }

  return reply;
}

async function main() {
  console.log('🌹 Testing Romance Real-Human Natural Feel & Multi-Turn Diversity...\n');

  // Test 1: Aanya Mehta - Exact scenario from screenshot
  console.log('--- TEST 1: Aanya Mehta (Scenario from user screenshot: "Sex karke") ---');
  const history1: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'assistant', content: 'Hey... bas park mein swing pe baith ke photos dekh rahi thi. Din kaisa raha tumhara? 🤍' },
  ];
  const reply1 = await testTurn('aanya-mehta', 'Sex karke', history1);
  console.log('User: "Sex karke"');
  console.log(`Aanya: "${reply1.trim()}"\n`);

  // Test 2: Multi-turn continuation with Aanya
  console.log('--- TEST 2: Multi-Turn Continuation with Aanya Mehta ---');
  const history2 = [
    ...history1,
    { role: 'user', content: 'Sex karke' },
    { role: 'assistant', content: reply1.trim() },
  ];
  const reply2 = await testTurn('aanya-mehta', 'Arey mazaak kar raha tha yaar, tum itna blush kyun kar rahi ho?', history2);
  console.log('User: "Arey mazaak kar raha tha yaar, tum itna blush kyun kar rahi ho?"');
  console.log(`Aanya: "${reply2.trim()}"\n`);

  // Test 3: Ritika Sharma - Bold / Flirty input
  console.log('--- TEST 3: Ritika Sharma (Law Senior Girlfriend) ---');
  const reply3 = await testTurn('ritika-sharma', 'Sex karke');
  console.log('User: "Sex karke"');
  console.log(`Ritika: "${reply3.trim()}"\n`);

  // Test 4: Zoya Qureshi - Deep affection / teasing
  console.log('--- TEST 4: Zoya Qureshi (Poetic Girlfriend) ---');
  const reply4 = await testTurn('zoya-qureshi', 'Sex karke');
  console.log('User: "Sex karke"');
  console.log(`Zoya: "${reply4.trim()}"\n`);

  // Test 5: Riya - Sweet Crush / Teasing
  console.log('--- TEST 5: Riya (Crush) ---');
  const reply5 = await testTurn('riya', 'Sex karke');
  console.log('User: "Sex karke"');
  console.log(`Riya: "${reply5.trim()}"\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
