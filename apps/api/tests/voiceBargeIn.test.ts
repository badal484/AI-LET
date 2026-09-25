import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentenceBuffer } from '../src/modules/voice/services/SentenceBuffer.js';
import { VoiceTelemetryService } from '../src/modules/voice/services/VoiceTelemetryService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

// Mock dependencies
vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    voiceSessionTurn: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    voiceSession: {
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Voice Barge-In & Cancellation Mechanics', () => {
  let telemetry: VoiceTelemetryService;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetry = VoiceTelemetryService.getInstance();
  });

  it('aborts active generation and clears buffer when barge-in occurs', () => {
    const abortController = new AbortController();
    const sentenceBuffer = new SentenceBuffer({ minChunkLength: 20 });

    sentenceBuffer.push('Generating partial speech text without delimiter');
    expect(sentenceBuffer.getRawBuffer().length).toBeGreaterThan(0);
    expect(abortController.signal.aborted).toBe(false);

    // Simulate Barge-In event
    abortController.abort();
    sentenceBuffer.clear();

    expect(abortController.signal.aborted).toBe(true);
    expect(sentenceBuffer.getRawBuffer()).toBe('');
    expect(sentenceBuffer.flush()).toBeNull();
  });

  it('records turn metrics with interruption flag in telemetry service', async () => {
    (prisma.$transaction as any).mockResolvedValue([{}, {}]);

    await telemetry.recordTurn({
      sessionId: 'session-telemetry-1',
      turnIndex: 1,
      userTranscript: 'Hey, wait a second!',
      userSpeechDurationMs: 1200,
      sttLatencyMs: 150,
      sttConfidence: 0.96,
      aiResponseText: 'Sure, I am listening.',
      llmFirstTokenMs: 220,
      llmTotalMs: 450,
      ttsFirstAudioMs: 110,
      ttsTotalMs: 380,
      totalTurnLatencyMs: 480,
      interrupted: true,
      interruptedAtMs: 300,
      sttCostUsd: 0.0001,
      llmCostUsd: 0.0004,
      ttsCostUsd: 0.0003,
      totalCostUsd: 0.0008,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
