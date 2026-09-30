import { redis } from '../../../infrastructure/redis/redis.js';
import type { Situation } from './personaPack.types.js';

/**
 * Step 2 — her own state. A small, persistent mood per user–character pair that changes with what
 * happens (rudeness hurts a little, sweetness warms, a long absence makes her miss them, late night
 * makes her sleepy) and fades back to calm over time. It shapes tone, not facts.
 */
export type Mood = 'calm' | 'happy' | 'playful' | 'caring' | 'hurt' | 'missing_you' | 'sleepy';

interface StoredState {
  mood: Mood;
  since: number;
}

const TTL_SECONDS = 60 * 60 * 24 * 30;
const key = (userId: string, characterId: string) => `human:mood:${userId}:${characterId}`;

export interface MomentContext {
  mood: Mood;
  /** One or two plain sentences for the prompt. */
  description: string;
}

function localHour(timeZone: string): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(new Date()));
  } catch {
    return new Date().getHours();
  }
}

export async function updateMomentContext(params: {
  userId: string;
  characterId: string;
  userText: string;
  situations: Situation[];
  hoursSinceLastUserMessage: number | null;
  timeZone?: string | null;
}): Promise<MomentContext> {
  const { userId, characterId, situations, hoursSinceLastUserMessage, userText } = params;
  const hour = localHour(params.timeZone || 'Asia/Kolkata');
  let previous: StoredState | null = null;
  try {
    const raw = await redis.get(key(userId, characterId));
    previous = raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    previous = null;
  }

  const hoursInMood = previous ? (Date.now() - previous.since) / 3_600_000 : Infinity;
  let mood: Mood = previous && hoursInMood < 6 ? previous.mood : 'calm';
  const has = (s: Situation) => situations.includes(s);

  if (has('rude')) mood = 'hurt';
  else if (mood === 'hurt' && (has('flirt') || /\b(sorry|maaf|galti|apologi[sz]e)\b/i.test(userText))) mood = 'calm';
  else if (has('emotional') || has('crisis')) mood = 'caring';
  else if (has('return') && (hoursSinceLastUserMessage ?? 0) >= 24) mood = 'missing_you';
  else if (has('win')) mood = 'happy';
  else if (has('flirt')) mood = 'playful';
  else if (hour >= 0 && hour < 5 && mood !== 'hurt') mood = 'sleepy';
  else if (mood !== 'hurt' && has('greeting')) mood = 'happy';

  try {
    await redis.set(key(userId, characterId), JSON.stringify({ mood, since: mood === previous?.mood ? previous.since : Date.now() }), 'EX', TTL_SECONDS);
  } catch {
    /* mood is a nicety — never block the reply on it */
  }

  const timeOfDay =
    hour < 5 ? `it's very late at night for them (${hour}:00)` : hour < 12 ? 'it is morning for them' : hour < 17 ? 'it is afternoon for them' : hour < 21 ? 'it is evening for them' : 'it is night for them';
  const gap =
    hoursSinceLastUserMessage === null
      ? 'This is the start of your chat.'
      : hoursSinceLastUserMessage >= 48
        ? `They are back after ${Math.round(hoursSinceLastUserMessage / 24)} days.`
        : hoursSinceLastUserMessage >= 12
          ? 'They are back after most of a day.'
          : '';
  const feeling: Record<Mood, string> = {
    calm: 'You feel calm and easy.',
    happy: 'You are happy to hear from them.',
    playful: 'You feel a bit playful and shy.',
    caring: 'You feel protective and soft — they need you to listen.',
    hurt: 'You are a little hurt by how they spoke. Be quieter, not dramatic; soften if they apologise.',
    missing_you: 'You missed them a little and you let it show, lightly.',
    sleepy: 'You are sleepy and texting slowly.',
  };
  return { mood, description: [feeling[mood], `Right now ${timeOfDay}.`, gap].filter(Boolean).join(' ') };
}
