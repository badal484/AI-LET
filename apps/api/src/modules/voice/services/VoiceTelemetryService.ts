import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { VoiceQualityMetrics, VoiceCostOverview } from '@ai-companion/types';

export interface RecordVoiceTurnParams {
  sessionId: string;
  turnIndex: number;
  userTranscript: string;
  userSpeechDurationMs: number;
  sttLatencyMs: number;
  sttConfidence: number;
  aiResponseText: string;
  llmFirstTokenMs: number;
  llmTotalMs: number;
  ttsFirstAudioMs: number;
  ttsTotalMs: number;
  totalTurnLatencyMs: number;
  interrupted: boolean;
  interruptedAtMs?: number | null;
  sttCostUsd: number;
  llmCostUsd: number;
  ttsCostUsd: number;
  totalCostUsd: number;
}

export class VoiceTelemetryService {
  private static instance: VoiceTelemetryService;

  public static getInstance(): VoiceTelemetryService {
    if (!VoiceTelemetryService.instance) {
      VoiceTelemetryService.instance = new VoiceTelemetryService();
    }
    return VoiceTelemetryService.instance;
  }

  /**
   * Persists turn-level metrics and updates running session totals.
   */
  public async recordTurn(params: RecordVoiceTurnParams): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.voiceSessionTurn.create({
          data: {
            sessionId: params.sessionId,
            turnIndex: params.turnIndex,
            userTranscript: params.userTranscript,
            userSpeechDurationMs: params.userSpeechDurationMs,
            sttLatencyMs: params.sttLatencyMs,
            sttConfidence: params.sttConfidence,
            aiResponseText: params.aiResponseText,
            llmFirstTokenMs: params.llmFirstTokenMs,
            llmTotalMs: params.llmTotalMs,
            ttsFirstAudioMs: params.ttsFirstAudioMs,
            ttsTotalMs: params.ttsTotalMs,
            totalTurnLatencyMs: params.totalTurnLatencyMs,
            interrupted: params.interrupted,
            interruptedAtMs: params.interruptedAtMs,
            sttCostUsd: params.sttCostUsd,
            llmCostUsd: params.llmCostUsd,
            ttsCostUsd: params.ttsCostUsd,
            totalCostUsd: params.totalCostUsd,
          },
        }),
        prisma.voiceSession.update({
          where: { id: params.sessionId },
          data: {
            turnsCount: { increment: 1 },
            interruptionCount: params.interrupted ? { increment: 1 } : undefined,
            userSpeakingSeconds: { increment: Math.max(1, Math.round(params.userSpeechDurationMs / 1000)) },
            aiSpeakingSeconds: { increment: Math.max(1, Math.round(params.ttsTotalMs / 1000)) },
            totalCostUsd: { increment: params.totalCostUsd },
            lastActivityAt: new Date(),
          },
        }),
      ]);
    } catch (err: any) {
      logger.error(`[VoiceTelemetryService] Failed to record turn metrics: ${err.message}`);
    }
  }

  /**
   * Calculates overall voice quality metrics.
   */
  public async getQualityMetrics(): Promise<VoiceQualityMetrics> {
    const turns = await prisma.voiceSessionTurn.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      select: {
        sttLatencyMs: true,
        llmFirstTokenMs: true,
        ttsFirstAudioMs: true,
        totalTurnLatencyMs: true,
        interrupted: true,
      },
    });

    const activeSessionsCount = await prisma.voiceSession.count({
      where: {
        status: { in: ['connected', 'active'] },
      },
    });

    const sessionsAgg = await prisma.voiceSession.aggregate({
      _sum: {
        totalDurationSeconds: true,
      },
    });

    if (turns.length === 0) {
      return {
        avgSttLatencyMs: 0,
        avgLlmTtftMs: 0,
        avgTtsLatencyMs: 0,
        avgTotalTurnLatencyMs: 0,
        interruptionRate: 0,
        sttFailureRate: null,
        ttsFailureRate: null,
        activeSessionsCount,
        totalVoiceMinutes: Math.round((sessionsAgg._sum.totalDurationSeconds || 0) / 60),
      };
    }

    const totalTurns = turns.length;
    const avgSttLatencyMs = Math.round(turns.reduce((acc, t) => acc + t.sttLatencyMs, 0) / totalTurns);
    const avgLlmTtftMs = Math.round(turns.reduce((acc, t) => acc + t.llmFirstTokenMs, 0) / totalTurns);
    const avgTtsLatencyMs = Math.round(turns.reduce((acc, t) => acc + t.ttsFirstAudioMs, 0) / totalTurns);
    const avgTotalTurnLatencyMs = Math.round(turns.reduce((acc, t) => acc + t.totalTurnLatencyMs, 0) / totalTurns);
    const interruptions = turns.filter((t) => t.interrupted).length;
    const interruptionRate = Number((interruptions / totalTurns).toFixed(3));

    return {
      avgSttLatencyMs,
      avgLlmTtftMs,
      avgTtsLatencyMs,
      avgTotalTurnLatencyMs,
      interruptionRate,
      // Provider failures are not persisted per turn, so the rate is unknown rather than a guessed 1%.
      sttFailureRate: null,
      ttsFailureRate: null,
      activeSessionsCount,
      totalVoiceMinutes: Math.round((sessionsAgg._sum.totalDurationSeconds || 0) / 60),
    };
  }

  /**
   * Returns cost overview for voice sessions.
   */
  public async getCostOverview(): Promise<VoiceCostOverview> {
    const turnsAgg = await prisma.voiceSessionTurn.aggregate({
      _sum: {
        sttCostUsd: true,
        llmCostUsd: true,
        ttsCostUsd: true,
        totalCostUsd: true,
      },
    });

    const sessions = await prisma.voiceSession.findMany({
      include: {
        character: { select: { id: true, name: true } },
      },
    });

    const totalVoiceMinutes = Math.round(
      sessions.reduce((acc, s) => acc + s.totalDurationSeconds, 0) / 60
    );

    const costByProvider: Record<string, number> = {};
    const charMap: Map<string, { characterId: string; characterName: string; costUsd: number; minutes: number }> = new Map();

    for (const session of sessions) {
      const p = session.provider || 'elevenlabs';
      costByProvider[p] = (costByProvider[p] || 0) + session.totalCostUsd;

      const charId = session.characterId;
      const charName = session.character.name;
      const existing = charMap.get(charId) || { characterId: charId, characterName: charName, costUsd: 0, minutes: 0 };
      existing.costUsd += session.totalCostUsd;
      existing.minutes += Math.round(session.totalDurationSeconds / 60);
      charMap.set(charId, existing);
    }

    return {
      totalCostUsd: Number((turnsAgg._sum.totalCostUsd || 0).toFixed(4)),
      sttCostUsd: Number((turnsAgg._sum.sttCostUsd || 0).toFixed(4)),
      llmCostUsd: Number((turnsAgg._sum.llmCostUsd || 0).toFixed(4)),
      ttsCostUsd: Number((turnsAgg._sum.ttsCostUsd || 0).toFixed(4)),
      totalVoiceMinutes,
      costByProvider,
      costByCharacter: Array.from(charMap.values()),
    };
  }
}
