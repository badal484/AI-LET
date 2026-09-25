import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceSessionService } from '../src/modules/voice/services/VoiceSessionService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { redis } from '../src/infrastructure/redis/redis.js';

// Mock dependencies
vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    character: {
      findUnique: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    voiceSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    userVoicePreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    billingSubscription: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    userEntitlement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../src/modules/billing/entitlements/EntitlementService.js', () => ({
  EntitlementService: {
    requireEntitlement: vi.fn().mockResolvedValue(undefined),
    hasEntitlement: vi.fn().mockResolvedValue(true),
    getEffectiveEntitlements: vi.fn().mockResolvedValue({
      userId: 'usr_test',
      planCode: 'PRO',
      subscriptionStatus: 'active',
      entitlements: { voice_access: true },
      activeEntitlementsList: ['voice_access'],
      syncedAt: new Date().toISOString(),
    }),
  },
}));

vi.mock('../src/infrastructure/redis/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('VoiceSessionService', () => {
  let service: VoiceSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = VoiceSessionService.getInstance();
  });

  describe('Session Token Generation & Verification', () => {
    it('generates and successfully verifies an HMAC-signed voice session token', () => {
      const sessionId = 'session-uuid-1234';
      const userId = 'user-uuid-5678';

      // Use reflection or the verification method
      const token = (service as any).generateSessionToken(sessionId, userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = service.verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.sessionId).toBe(sessionId);
      expect(verified?.userId).toBe(userId);
      expect(verified?.timestamp).toBeGreaterThan(0);
    });

    it('rejects tampered or malformed tokens', () => {
      expect(service.verifySessionToken('invalid-token')).toBeNull();
      expect(service.verifySessionToken('')).toBeNull();
      
      const tampered = Buffer.from('session-1:user-1:123456789:forged-sig').toString('base64url');
      expect(service.verifySessionToken(tampered)).toBeNull();
    });
  });

  describe('Session Creation and Validation', () => {
    it('creates voice session with published character and voice settings', async () => {
      const mockCharacter = {
        id: 'char-1',
        name: 'Aria',
        status: 'PUBLISHED',
        currentPublishedVersion: {
          id: 'ver-1',
          voiceConfigData: {
            voiceEnabled: true,
            provider: 'mock',
            voiceId: 'mock-female-1',
            language: 'en',
          },
        },
      };

      (prisma.character.findUnique as any).mockResolvedValue(mockCharacter);
      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
      });
      (redis.get as any).mockResolvedValue(null);
      (prisma.voiceSession.create as any).mockResolvedValue({
        id: 'session-new-1',
        userId: 'user-1',
        characterId: 'char-1',
        characterVersionId: 'ver-1',
        conversationId: 'conv-1',
        status: 'created',
        voiceMode: 'hands_free',
        transport: 'websocket',
        language: 'en',
        voiceId: 'mock-female-1',
        provider: 'mock',
        startedAt: new Date(),
        lastActivityAt: new Date(),
      });

      const result = await service.createSession('user-1', {
        characterId: 'char-1',
        conversationId: 'conv-1',
        voiceMode: 'hands_free',
      });

      expect(result.sessionId).toBe('session-new-1');
      expect(result.sessionToken).toBeDefined();
      expect(result.websocketUrl).toContain('/api/v1/voice/ws?sessionId=session-new-1');
      expect(result.voiceConfig.voiceEnabled).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'lock:voice:user:user-1',
        'session-new-1',
        'EX',
        expect.any(Number)
      );
    });

    it('throws error if voice is disabled for the character', async () => {
      (prisma.character.findUnique as any).mockResolvedValue({
        id: 'char-2',
        name: 'Silent Bot',
        status: 'PUBLISHED',
        currentPublishedVersion: {
          id: 'ver-2',
          voiceConfigData: {
            voiceEnabled: false,
          },
        },
      });

      await expect(
        service.createSession('user-1', { characterId: 'char-2' })
      ).rejects.toThrow('Voice is disabled for this character');
    });
  });

  describe('User Voice Preferences', () => {
    it('retrieves user voice preferences or returns defaults', async () => {
      (prisma.userVoicePreference.findUnique as any).mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        voiceEnabled: true,
        preferredMode: 'push_to_talk',
        subtitlesEnabled: true,
        speechSpeed: 1.1,
        preferredLanguage: 'en',
        autoPlayAudio: true,
        noiseSuppression: true,
        updatedAt: new Date(),
      });

      const prefs = await service.getUserVoicePreferences('user-1');
      expect(prefs.preferredMode).toBe('push_to_talk');
      expect(prefs.speechSpeed).toBe(1.1);
      expect(prefs.subtitlesEnabled).toBe(true);
    });

    it('updates user voice preferences', async () => {
      (prisma.userVoicePreference.upsert as any).mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        voiceEnabled: true,
        preferredMode: 'hands_free',
        subtitlesEnabled: false,
        speechSpeed: 1.0,
        preferredLanguage: 'hi',
        autoPlayAudio: true,
        noiseSuppression: true,
        updatedAt: new Date(),
      });

      const updated = await service.updateUserVoicePreferences('user-1', {
        preferredMode: 'hands_free',
        subtitlesEnabled: false,
        preferredLanguage: 'hi',
      });

      expect(updated.preferredLanguage).toBe('hi');
      expect(updated.subtitlesEnabled).toBe(false);
    });
  });
});
