import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceGateway } from '../src/modules/voice/gateway/VoiceGateway.js';
import { VoiceSessionService } from '../src/modules/voice/services/VoiceSessionService.js';

describe('VoiceGateway & Speech Providers', () => {
  let gateway: VoiceGateway;
  let sessionService: VoiceSessionService;

  beforeEach(() => {
    gateway = VoiceGateway.getInstance();
    sessionService = VoiceSessionService.getInstance();
  });

  describe('Speech-to-Text (STT)', () => {
    it('transcribes audio buffer into text and metrics', async () => {
      const mockAudio = Buffer.alloc(3200); // 100ms of 16kHz 16-bit mono
      const result = await gateway.transcribe(
        mockAudio,
        'mock',
        { language: 'en', sampleRate: 16000, encoding: 'pcm16' }
      );

      expect(result.transcript).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.language).toBe('en');
    });

    it('streams interim and final STT transcripts', async () => {
      const mockChunks = [Buffer.alloc(800), Buffer.alloc(800)];
      async function* generateStream() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      const interimEvents: any[] = [];
      const result = await gateway.streamTranscription(
        generateStream(),
        'mock',
        {
          language: 'en',
          onInterim: (interim) => interimEvents.push(interim),
        }
      );

      expect(result.transcript).toBeDefined();
      expect(result.isFinal).toBe(true);
    });
  });

  describe('Text-to-Speech (TTS)', () => {
    it('synthesizes text into audio buffer', async () => {
      const result = await gateway.synthesize(
        'Hello, how can I help you today?',
        'mock',
        { voiceId: 'mock-friendly-female', speed: 1.0 }
      );

      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBuffer.length).toBeGreaterThan(0);
      expect(result.format).toBe('pcm16');
      expect(result.sampleRate).toBe(24000);
      expect(result.charactersCount).toBe('Hello, how can I help you today?'.length);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('streams TTS audio chunks', async () => {
      const chunks: any[] = [];
      await gateway.streamSynthesis(
        'This is a streamed speech synthesis test with multiple words.',
        'mock',
        { voiceId: 'mock-friendly-female' },
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].sequence).toBe(1);
      expect(chunks[0].audioChunk.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isFinal).toBe(true);
    });

    it('supports voice preview for admin studio via VoiceSessionService', async () => {
      const preview = await sessionService.generatePreview({
        provider: 'mock',
        voiceId: 'mock-friendly-female',
        text: 'Previewing this warm tone character voice.',
        speed: 1.1,
      });

      expect(preview.audioBase64).toBeDefined();
      expect(preview.format).toBe('pcm16');
      expect(preview.durationSeconds).toBeGreaterThan(0);
      expect(preview.costUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Taxonomy and Fallback', () => {
    it('classifies STT and TTS provider errors accurately', () => {
      const permErr = new Error('Permission denied to microphone');
      expect(gateway.classifyError(permErr)).toBe('VOICE_PERMISSION_DENIED');

      const timeoutErr = new Error('Connection timed out');
      expect(gateway.classifyError(timeoutErr)).toBe('VOICE_CONNECTION_FAILED');

      const rateErr = new Error('429 rate limit exceeded');
      expect(gateway.classifyError(rateErr)).toBe('VOICE_USAGE_LIMIT');

      const ttsErr = new Error('TTS voice synthesis failed');
      expect(gateway.classifyError(ttsErr)).toBe('VOICE_TTS_FAILED');
    });

    it('falls back to mock or default provider when requested provider is unavailable', async () => {
      const result = await gateway.synthesize(
        'Fallback test',
        'elevenlabs',
        { voiceId: 'default-voice' }
      );

      expect(result.audioBuffer).toBeDefined();
    });
  });
});
