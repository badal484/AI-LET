import { prisma } from '../../../infrastructure/database/prisma.js';
import type { PersonaPack } from './personaPack.types.js';
import { buildHumanPrompt, pickLifeDetail, type BondStage, type ReplyPlan } from './compactPrompt.js';
import { addDatedThreads, currentStoryBeat, loadLifeState, rememberTold, saveLifeState, type LifeState } from './lifeState.js';
import { formatProfile, localToday, takeDueEvents, UserProfileService } from '../../memory/services/userProfile.service.js';

/**
 * Texting first — kindly. A friend who texts "interview kaisa gaya?" feels caring; one who
 * double-texts at midnight or guilt-trips feels needy. So, on top of the general proactive rules:
 *   - only in the daytime (9:00–21:00 their time),
 *   - at most twice a day,
 *   - only if they chatted in the last 3 days (and not in the last 3 hours),
 *   - never again until they've replied to her last text-first message.
 */
export const TEXT_FIRST = { startHour: 9, endHour: 21, maxPerDay: 2, activeWithinHours: 72, quietAfterChatHours: 3 };

function localHour(timeZone: string | null | undefined, now: Date): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: timeZone || 'Asia/Kolkata' }).format(now));
  } catch {
    return now.getHours();
  }
}

export async function kindTextFirstCheck(params: {
  userId: string;
  characterId: string;
  conversationId: string;
  timeZone?: string | null;
  now?: Date;
  /** A birthday today or a big event to ask about: worth texting even if they've been away a while. */
  bigDay?: boolean;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = params.now ?? new Date();
  const hour = localHour(params.timeZone, now);
  if (hour < TEXT_FIRST.startHour || hour >= TEXT_FIRST.endHour) return { ok: false, reason: `Not texting first at ${hour}:00 their time (daytime only).` };

  const [lastUser, lastMessage, sentToday] = await Promise.all([
    prisma.message.findFirst({ where: { conversationId: params.conversationId, role: 'user' }, orderBy: { sequenceNumber: 'desc' }, select: { createdAt: true } }),
    prisma.message.findFirst({ where: { conversationId: params.conversationId }, orderBy: { sequenceNumber: 'desc' }, select: { role: true, isProactive: true } }),
    prisma.message.count({
      where: { conversationId: params.conversationId, isProactive: true, createdAt: { gte: new Date(now.getTime() - 24 * 3_600_000) } },
    }),
  ]);
  if (!lastUser) return { ok: false, reason: 'They have never chatted — no texting first.' };
  const hoursSince = (now.getTime() - lastUser.createdAt.getTime()) / 3_600_000;
  if (hoursSince > (params.bigDay ? 30 * 24 : TEXT_FIRST.activeWithinHours))
    return { ok: false, reason: params.bigDay ? 'No chat in the last 30 days — not even for a big day.' : 'No chat in the last 3 days — not chasing them.' };
  if (hoursSince < TEXT_FIRST.quietAfterChatHours) return { ok: false, reason: 'They chatted recently — no need to text first.' };
  if (lastMessage?.role === 'assistant' && lastMessage.isProactive) return { ok: false, reason: 'Her last text-first message is still unanswered — never double-text.' };
  if (sentToday >= TEXT_FIRST.maxPerDay) return { ok: false, reason: 'Already texted first twice today.' };
  return { ok: true };
}

/** What she opens with: a follow-up on their life first, then her own news, then an everyday moment. */
export function planTextFirst(pack: PersonaPack, life: LifeState, now = Date.now(), hour?: number): ReplyPlan {
  const plan: ReplyPlan = {
    moves: 'you are texting them first, out of the blue, like a friend who thought of them. Light and warm. No guilt, no "you forgot me", no pressure to reply',
    texts: '1 or 2',
    ask: true,
  };
  const due = life.threads.find((t) => !t.askedAt && now >= t.dueAt);
  if (due) {
    due.askedAt = now;
    plan.followUp = due;
    return plan;
  }
  const beat = life.day.storyShared ? undefined : currentStoryBeat(pack, life.firstMetAt, now);
  if (beat) {
    life.day.storyShared = true;
    plan.storyBeat = beat;
    return plan;
  }
  plan.detail = pickLifeDetail({ workMoments: pack.workMoments, lifeDetails: pack.lifeDetails }, ['casual'], [], life.day.told, hour);
  return plan;
}

export async function buildTextFirstPrompt(params: {
  pack: PersonaPack;
  userId: string;
  characterId: string;
  userName: string;
  timeZone?: string | null;
  memoriesText: string;
  relationshipText: string;
  stage?: BondStage | null;
}): Promise<{ systemPrompt: string; commit: () => Promise<void> }> {
  const life = await loadLifeState(params.userId, params.characterId, params.timeZone);
  const profile = await UserProfileService.load(params.userId, params.characterId);
  const today = localToday(params.timeZone).date;
  const dueEvents = takeDueEvents(profile, today);
  if (dueEvents.due.length) addDatedThreads(life, dueEvents.due);
  const plan = planTextFirst(params.pack, life, Date.now(), localHour(params.pack.home?.timeZone ?? params.timeZone, new Date()));
  const systemPrompt = buildHumanPrompt({
    pack: params.pack,
    userName: params.userName,
    memoriesText: params.memoriesText,
    relationshipText: params.relationshipText,
    moment: { mood: 'calm', description: 'They have not texted for a few hours. You thought of them.' },
    situations: ['casual'],
    plan,
    stage: params.stage,
    continuityLines: life.day.told.length ? [`Earlier today you already told them: ${life.day.told.join('; ')}.`] : [],
    profileText: formatProfile(profile, today),
  });
  return {
    systemPrompt,
    // Called only after the message is really sent.
    commit: async () => {
      rememberTold(life, plan.storyBeat ?? plan.detail);
      await saveLifeState(params.userId, params.characterId, life);
      if (dueEvents.changed) await UserProfileService.save(params.userId, params.characterId, profile);
    },
  };
}
