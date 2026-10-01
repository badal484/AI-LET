import { PrismaClient } from '@prisma/client';
import { CharacterService } from '../modules/characters/services/character.service.js';
import { ContextBuilder } from '../modules/conversations/engine/contextBuilder.js';
import { AIGateway } from '../modules/ai/gateway/AIGateway.js';

async function testPrompt(prompt: string) {
  const prisma = new PrismaClient();
  const char = await prisma.character.findUnique({
    where: { slug: 'dr-shradha' },
  });

  const runtime = await CharacterService.resolveRuntime(char!.id);
  const context = await ContextBuilder.buildModelContext({
    characterRuntime: runtime,
    recentMessages: [],
    currentUserMessage: prompt,
    userContext: { userId: 'test-user', userName: 'User' },
    conversationId: 'test-conv',
  });

  const stream = AIGateway.getInstance().stream(
    {
      model: 'gemini-2.5-flash-lite',
      systemPrompt: context.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      maxTokens: 80,
    },
    'google',
  );

  let fullReply = '';
  for await (const chunk of stream) {
    if (chunk.delta) fullReply += chunk.delta;
  }
  console.log(`\nUser: "${prompt}"`);
  console.log(`Shradha: "${fullReply.trim()}"`);
}

async function main() {
  await testPrompt('Shaadi karogi?');
  await testPrompt('Aaj bohot burnout ho raha hai kaam se 😔');
  await testPrompt('Kahan se ho aap?');
}

main().catch(console.error);
