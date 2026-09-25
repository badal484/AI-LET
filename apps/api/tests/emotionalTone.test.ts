import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmotionalToneService } from '../src/modules/relationships/services/emotionalTone.service.js';
import { redis } from '../src/infrastructure/redis/redis.js';

vi.mock('../src/infrastructure/redis/redis.js', () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: vi.fn(async (key: string) => store.get(key) || null),
      set: vi.fn(async (key: string, val: string) => {
        store.set(key, val);
        return 'OK';
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    },
  };
});

describe('Phase 6: EmotionalToneService', () => {
  const userId = 'user-test-123';
  const characterId = 'char-test-456';

  beforeEach(async () => {
    await EmotionalToneService.resetTone(userId, characterId);
  });

  it('should return default baseline affect when cache is empty', async () => {
    const tone = await EmotionalToneService.getCurrentTone(userId, characterId);
    expect(tone.tone).toBe('calm');
    expect(tone.energy).toBe(50);
    expect(tone.warmth).toBe(60);
    expect(tone.seriousness).toBe(40);
    expect(tone.topicSensitivity).toBe('normal');
  });

  it('should update and retrieve active conversational affect from cache', async () => {
    await EmotionalToneService.updateTone(userId, characterId, {
      tone: 'supportive',
      warmth: 85,
      seriousness: 75,
      energy: 40,
      topicSensitivity: 'high',
    });

    const updated = await EmotionalToneService.getCurrentTone(userId, characterId);
    expect(updated.tone).toBe('supportive');
    expect(updated.warmth).toBe(85);
    expect(updated.seriousness).toBe(75);
    expect(updated.energy).toBe(40);
    expect(updated.topicSensitivity).toBe('high');
  });

  it('should clamp affect dimensions strictly between 0 and 100', async () => {
    await EmotionalToneService.updateTone(userId, characterId, {
      energy: 150,
      warmth: -20,
    });

    const updated = await EmotionalToneService.getCurrentTone(userId, characterId);
    expect(updated.energy).toBe(100);
    expect(updated.warmth).toBe(0);
  });

  it('should reset tone back to baseline default', async () => {
    await EmotionalToneService.updateTone(userId, characterId, {
      tone: 'playful',
      energy: 90,
    });

    await EmotionalToneService.resetTone(userId, characterId);

    const resetState = await EmotionalToneService.getCurrentTone(userId, characterId);
    expect(resetState.tone).toBe('calm');
    expect(resetState.energy).toBe(50);
  });
});
