import { prisma } from '../../../infrastructure/database/prisma.js';
import { UserProfileService } from '../../memory/services/userProfile.service.js';
import { wasSaid } from './mentor.js';
import type { LifeState } from './lifeState.js';

/**
 * A mentor may only follow up on a task she really gave. A saved task that never appears in her own
 * messages (a model's hidden tag, an old bug) would become "maine kal tumse … kaha tha" — a made-up
 * memory. Before the profile is read, drop any such task (and its follow-up thread).
 */
const FOLLOW_UP = /(kaha tha|bola tha|batAya tha|kaha thi|try kiya|kiya kya|kar liya|ho paaya|ho paya|li thi|kiya tha|did you|have you|tried)/i;

export async function dropUnsaidTasks(params: { conversationId: string; userId: string; characterId: string; life: LifeState }): Promise<number> {
  const profile = await UserProfileService.load(params.userId, params.characterId);
  const threadTask = params.life.threads.find((t) => t.kind === 'task');
  if (profile.tasks.length === 0 && !threadTask) return 0;

  // Her own messages from the last two weeks, newest first.
  const hers = await prisma.message.findMany({
    where: { conversationId: params.conversationId, role: 'assistant', createdAt: { gte: new Date(Date.now() - 14 * 24 * 3_600_000) } },
    orderBy: { sequenceNumber: 'desc' },
    take: 200,
    select: { content: true },
  });
  // Only sentences where she GAVE something count — her follow-ups ("jo maine kaha tha", "try kiya?")
  // are not proof, or one made-up follow-up would keep the made-up task alive forever.
  const said = hers
    .flatMap((m) => m.content.split(/(?<=[.?!\n])/))
    .filter((sentence) => !FOLLOW_UP.test(sentence))
    .join('\n');

  const kept = profile.tasks.filter((t) => wasSaid(t.what, said));
  const dropped = profile.tasks.length - kept.length;
  if (dropped > 0) await UserProfileService.save(params.userId, params.characterId, { ...profile, tasks: kept });
  if (threadTask && !wasSaid(threadTask.said, said)) params.life.threads = params.life.threads.filter((t) => t !== threadTask);
  return dropped;
}
