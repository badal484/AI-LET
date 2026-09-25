import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import { ErrorCode, SYSTEM_CONSTANTS } from '@ai-companion/config';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../../shared/errors/AppError.js';
import { VoiceGateway } from '../gateway/VoiceGateway.js';
import { EntitlementService } from '../../billing/entitlements/EntitlementService.js';
import type {
  CreateVoiceSessionRequest,
  CreateVoiceSessionResponse,
  CharacterVoiceSettings,
  VoiceSessionSummary,
  VoiceSessionDetail,
  UserVoicePreferenceData,
  VoicePreviewRequest,
  VoicePreviewResult,
} from '@ai-companion/types';

export class VoiceSessionService {
  private static instance: VoiceSessionService;
  private voiceGateway = VoiceGateway.getInstance();

  public static getInstance(): VoiceSessionService {
    if (!VoiceSessionService.instance) {
      VoiceSessionService.instance = new VoiceSessionService();
    }
    return VoiceSessionService.instance;
  }

  /**
   * Generates a secure, short-lived session token tied to session and user.
   */
  private generateSessionToken(sessionId: string, userId: string): string {
    const payload = `${sessionId}:${userId}:${Date.now()}`;
    const secret = process.env['JWT_SECRET'] || 'voice-session-secret-key-salt';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  /**
   * Verifies the voice session token.
   */
  public verifySessionToken(token: string): { sessionId: string; userId: string; timestamp: number } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 4) return null;

      const [sessionId, userId, timestampStr, signature] = parts;
      if (!sessionId || !userId || !timestampStr || !signature) {
        return null;
      }
      const timestamp = parseInt(timestampStr, 10);

      // Check expiry (1 hour max for token)
      if (Date.now() - timestamp > 3600 * 1000) {
        return null;
      }

      const secret = process.env['JWT_SECRET'] || 'voice-session-secret-key-salt';
      const expectedSig = crypto.createHmac('sha256', secret).update(`${sessionId}:${userId}:${timestampStr}`).digest('hex');

      if (signature !== expectedSig) {
        return null;
      }

      return { sessionId, userId, timestamp };
    } catch {
      return null;
    }
  }

  /**
   * Creates a new VoiceSession.
   */
  public async createSession(userId: string, input: CreateVoiceSessionRequest): Promise<CreateVoiceSessionResponse> {
    // 1. Verify Character and Published Version
    const character = await prisma.character.findUnique({
      where: { id: input.characterId, deletedAt: null },
      include: {
        currentPublishedVersion: true,
      },
    });

    if (!character) {
      throw new NotFoundError('Character not found', ErrorCode.CHARACTER_NOT_FOUND);
    }

    if (character.status !== 'PUBLISHED' || !character.currentPublishedVersion) {
      throw new ValidationError('Character is not published for voice conversations');
    }

    const version = character.currentPublishedVersion;
    const voiceConfigData = (version.voiceConfigData as any) || {};

    const voiceConfig: CharacterVoiceSettings = {
      voiceEnabled: voiceConfigData.voiceEnabled ?? true,
      provider: voiceConfigData.provider || 'elevenlabs',
      voiceId: voiceConfigData.voiceId || '21m00Tcm4TlvDq8ikWAM',
      language: input.language || voiceConfigData.language || 'en',
      speakingStyle: voiceConfigData.speakingStyle,
      speed: voiceConfigData.speed || 1.0,
      pitch: voiceConfigData.pitch || 0.0,
      stability: voiceConfigData.stability || 0.75,
      fallbackVoiceId: voiceConfigData.fallbackVoiceId || 'alloy',
      fallbackProvider: voiceConfigData.fallbackProvider || 'openai',
      defaultVoiceMode: input.voiceMode || voiceConfigData.defaultVoiceMode || 'hands_free',
    };

    if (!voiceConfig.voiceEnabled) {
      throw new ValidationError('Voice is disabled for this character');
    }

    // 1b. Monetization & Entitlement Check (Phase 11)
    await EntitlementService.requireEntitlement(userId, 'voice_access');

    // 2. Resolve Conversation (or find / create existing)
    let conversationId = input.conversationId;
    if (conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId, deletedAt: null },
      });
      if (!conv || conv.userId !== userId) {
        throw new ForbiddenError('Conversation not accessible', ErrorCode.CONVERSATION_ACCESS_DENIED);
      }
    } else {
      // Find or create conversation for this user + character
      let conv = await prisma.conversation.findUnique({
        where: { userId_characterId: { userId, characterId: input.characterId } },
      });
      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            userId,
            characterId: input.characterId,
            characterVersionId: version.id,
            title: `Voice with ${character.name}`,
          },
        });
      }
      conversationId = conv.id;
    }

    // 3. Prevent duplicate active voice sessions using Redis lock
    const lockKey = `lock:voice:user:${userId}`;
    const existingActiveSessionId = await redis.get(lockKey);
    if (existingActiveSessionId) {
      logger.warn(`[VoiceSessionService] Terminating stale voice session ${existingActiveSessionId} for user ${userId}`);
      await prisma.voiceSession.updateMany({
        where: { id: existingActiveSessionId, status: { in: ['created', 'connecting', 'connected', 'active', 'paused'] } },
        data: { status: 'cancelled', endedAt: new Date() },
      });
    }

    // 4. Create VoiceSession record
    const session = await prisma.voiceSession.create({
      data: {
        userId,
        characterId: input.characterId,
        characterVersionId: version.id,
        conversationId,
        status: 'created',
        voiceMode: voiceConfig.defaultVoiceMode || 'hands_free',
        transport: 'websocket',
        language: voiceConfig.language,
        voiceId: voiceConfig.voiceId,
        provider: voiceConfig.provider,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Set active lock in Redis for session duration limit
    await redis.set(lockKey, session.id, 'EX', SYSTEM_CONSTANTS.VOICE.MAX_SESSION_DURATION_SECONDS);

    const sessionToken = this.generateSessionToken(session.id, userId);
    const expiresAt = new Date(Date.now() + SYSTEM_CONSTANTS.VOICE.MAX_SESSION_DURATION_SECONDS * 1000).toISOString();
    const websocketUrl = `/api/v1/voice/ws?sessionId=${session.id}&token=${sessionToken}`;

    return {
      sessionId: session.id,
      sessionToken,
      websocketUrl,
      voiceConfig,
      transport: 'websocket',
      expiresAt,
    };
  }

  /**
   * Retrieves voice session detail.
   */
  public async getSession(sessionId: string, userId: string): Promise<VoiceSessionDetail> {
    const session = await prisma.voiceSession.findUnique({
      where: { id: sessionId },
      include: {
        character: { select: { name: true, avatarUrl: true } },
        turns: { orderBy: { turnIndex: 'asc' } },
      },
    });

    if (!session) {
      throw new NotFoundError('Voice session not found', ErrorCode.VOICE_SESSION_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to voice session', ErrorCode.FORBIDDEN);
    }

    return {
      id: session.id,
      userId: session.userId,
      characterId: session.characterId,
      characterVersionId: session.characterVersionId,
      conversationId: session.conversationId,
      status: session.status as any,
      voiceMode: session.voiceMode as any,
      transport: session.transport as any,
      language: session.language,
      voiceId: session.voiceId,
      provider: session.provider,
      totalDurationSeconds: session.totalDurationSeconds,
      userSpeakingSeconds: session.userSpeakingSeconds,
      aiSpeakingSeconds: session.aiSpeakingSeconds,
      turnsCount: session.turnsCount,
      interruptionCount: session.interruptionCount,
      totalCostUsd: session.totalCostUsd,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() || null,
      lastActivityAt: session.lastActivityAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      characterName: session.character.name,
      characterAvatarUrl: session.character.avatarUrl,
      turns: session.turns.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        turnIndex: t.turnIndex,
        userTranscript: t.userTranscript,
        userSpeechDurationMs: t.userSpeechDurationMs,
        sttLatencyMs: t.sttLatencyMs,
        sttConfidence: t.sttConfidence,
        aiResponseText: t.aiResponseText,
        llmFirstTokenMs: t.llmFirstTokenMs,
        llmTotalMs: t.llmTotalMs,
        ttsFirstAudioMs: t.ttsFirstAudioMs,
        ttsTotalMs: t.ttsTotalMs,
        totalTurnLatencyMs: t.totalTurnLatencyMs,
        interrupted: t.interrupted,
        interruptedAtMs: t.interruptedAtMs,
        sttCostUsd: t.sttCostUsd,
        llmCostUsd: t.llmCostUsd,
        ttsCostUsd: t.ttsCostUsd,
        totalCostUsd: t.totalCostUsd,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Gracefully ends a voice session.
   */
  public async endSession(sessionId: string, userId: string, reason: string = 'completed'): Promise<VoiceSessionSummary> {
    const session = await prisma.voiceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Voice session not found', ErrorCode.VOICE_SESSION_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to voice session', ErrorCode.FORBIDDEN);
    }

    const now = new Date();
    const durationSeconds = Math.max(1, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));

    const updated = await prisma.voiceSession.update({
      where: { id: sessionId },
      data: {
        status: reason === 'cancelled' ? 'cancelled' : 'completed',
        endedAt: now,
        totalDurationSeconds: durationSeconds,
      },
    });

    // Release Redis lock
    await redis.del(`lock:voice:user:${userId}`);

    return {
      id: updated.id,
      userId: updated.userId,
      characterId: updated.characterId,
      characterVersionId: updated.characterVersionId,
      conversationId: updated.conversationId,
      status: updated.status as any,
      voiceMode: updated.voiceMode as any,
      transport: updated.transport as any,
      language: updated.language,
      voiceId: updated.voiceId,
      provider: updated.provider,
      totalDurationSeconds: updated.totalDurationSeconds,
      userSpeakingSeconds: updated.userSpeakingSeconds,
      aiSpeakingSeconds: updated.aiSpeakingSeconds,
      turnsCount: updated.turnsCount,
      interruptionCount: updated.interruptionCount,
      totalCostUsd: updated.totalCostUsd,
      startedAt: updated.startedAt.toISOString(),
      endedAt: updated.endedAt?.toISOString() || null,
      lastActivityAt: updated.lastActivityAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves or initializes user voice preferences.
   */
  public async getUserVoicePreferences(userId: string): Promise<UserVoicePreferenceData> {
    let prefs = await prisma.userVoicePreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.userVoicePreference.create({
        data: {
          userId,
          voiceEnabled: true,
          preferredMode: 'hands_free',
          speechSpeed: 1.0,
          preferredLanguage: 'en',
          subtitlesEnabled: true,
          autoPlayAudio: true,
          noiseSuppression: true,
        },
      });
    }

    return {
      id: prefs.id,
      userId: prefs.userId,
      voiceEnabled: prefs.voiceEnabled,
      preferredMode: prefs.preferredMode as any,
      speechSpeed: prefs.speechSpeed,
      preferredLanguage: prefs.preferredLanguage,
      subtitlesEnabled: prefs.subtitlesEnabled,
      autoPlayAudio: prefs.autoPlayAudio,
      noiseSuppression: prefs.noiseSuppression,
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }

  /**
   * Updates user voice preferences.
   */
  public async updateUserVoicePreferences(
    userId: string,
    updates: Partial<UserVoicePreferenceData>
  ): Promise<UserVoicePreferenceData> {
    const prefs = await prisma.userVoicePreference.upsert({
      where: { userId },
      create: {
        userId,
        voiceEnabled: updates.voiceEnabled ?? true,
        preferredMode: updates.preferredMode || 'hands_free',
        speechSpeed: updates.speechSpeed ?? 1.0,
        preferredLanguage: updates.preferredLanguage || 'en',
        subtitlesEnabled: updates.subtitlesEnabled ?? true,
        autoPlayAudio: updates.autoPlayAudio ?? true,
        noiseSuppression: updates.noiseSuppression ?? true,
      },
      update: {
        ...(updates.voiceEnabled !== undefined && { voiceEnabled: updates.voiceEnabled }),
        ...(updates.preferredMode && { preferredMode: updates.preferredMode }),
        ...(updates.speechSpeed !== undefined && { speechSpeed: updates.speechSpeed }),
        ...(updates.preferredLanguage && { preferredLanguage: updates.preferredLanguage }),
        ...(updates.subtitlesEnabled !== undefined && { subtitlesEnabled: updates.subtitlesEnabled }),
        ...(updates.autoPlayAudio !== undefined && { autoPlayAudio: updates.autoPlayAudio }),
        ...(updates.noiseSuppression !== undefined && { noiseSuppression: updates.noiseSuppression }),
      },
    });

    return {
      id: prefs.id,
      userId: prefs.userId,
      voiceEnabled: prefs.voiceEnabled,
      preferredMode: prefs.preferredMode as any,
      speechSpeed: prefs.speechSpeed,
      preferredLanguage: prefs.preferredLanguage,
      subtitlesEnabled: prefs.subtitlesEnabled,
      autoPlayAudio: prefs.autoPlayAudio,
      noiseSuppression: prefs.noiseSuppression,
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }

  /**
   * Generates a voice preview for Admin Character Studio.
   */
  public async generatePreview(input: VoicePreviewRequest): Promise<VoicePreviewResult> {
    const startTime = Date.now();
    const result = await this.voiceGateway.synthesize(input.text, input.provider, {
      voiceId: input.voiceId,
      language: input.language,
      speed: input.speed,
      pitch: input.pitch,
      stability: input.stability,
    });

    return {
      audioBase64: result.audioBuffer.toString('base64'),
      durationSeconds: result.durationSeconds,
      format: result.format,
      sampleRate: result.sampleRate,
      latencyMs: Date.now() - startTime,
      costUsd: result.costUsd,
    };
  }
}
