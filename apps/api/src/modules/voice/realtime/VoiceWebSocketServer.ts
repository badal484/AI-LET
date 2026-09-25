import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { logger } from '../../../config/logger.js';
import { VoiceSessionService } from '../services/VoiceSessionService.js';
import { VoiceGateway } from '../gateway/VoiceGateway.js';
import { VoiceConversationBridge } from '../services/VoiceConversationBridge.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import type {
  VoiceEventType,
  VoiceRealtimeEvent,
  CharacterVoiceSettings,
} from '@ai-companion/types';

interface ClientVoiceSession {
  sessionId: string;
  userId: string;
  characterId: string;
  conversationId: string;
  voiceConfig: CharacterVoiceSettings;
  socket: WebSocket;
  sequenceCounter: number;
  turnIndex: number;
  currentAbortController?: AbortController;
  audioChunks: Buffer[];
  speechStartTimeMs: number;
  isAlive: boolean;
}

export class VoiceWebSocketServer {
  private static instance: VoiceWebSocketServer;
  private wss: WebSocketServer | null = null;
  private activeSessions: Map<string, ClientVoiceSession> = new Map();
  private voiceSessionService = VoiceSessionService.getInstance();
  private voiceGateway = VoiceGateway.getInstance();
  private voiceBridge = VoiceConversationBridge.getInstance();

  public static getInstance(): VoiceWebSocketServer {
    if (!VoiceWebSocketServer.instance) {
      VoiceWebSocketServer.instance = new VoiceWebSocketServer();
    }
    return VoiceWebSocketServer.instance;
  }

  /**
   * Initializes WebSocket server attached to the HTTP server.
   */
  public initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      noServer: true,
      path: '/api/v1/voice/ws',
    });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/api/v1/voice/ws') {
        const token = url.searchParams.get('token');
        const sessionId = url.searchParams.get('sessionId');

        if (!token || !sessionId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const verification = this.voiceSessionService.verifySessionToken(token);
        if (!verification || verification.sessionId !== sessionId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.wss?.emit('connection', ws, request, verification);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: any, authInfo?: any) => {
      const info = authInfo || (req as any).authInfo || { sessionId: '', userId: '' };
      this.handleConnection(ws, info.sessionId, info.userId).catch((err) => {
        logger.error(`[VoiceWebSocketServer] Connection init error: ${err.message}`);
        ws.close(1011, 'Internal Error');
      });
    });

    // Setup heartbeat interval
    setInterval(() => {
      this.activeSessions.forEach((session, sessionId) => {
        if (!session.isAlive) {
          logger.warn(`[VoiceWebSocketServer] Terminating dead voice socket for session ${sessionId}`);
          session.socket.terminate();
          this.activeSessions.delete(sessionId);
          return;
        }
        session.isAlive = false;
        session.socket.ping();
      });
    }, 15000);

    logger.info('[VoiceWebSocketServer] Realtime WebSocket Voice Server mounted on /api/v1/voice/ws');
  }

  private async handleConnection(ws: WebSocket, sessionId: string, userId: string): Promise<void> {
    const sessionRecord = await prisma.voiceSession.findUnique({
      where: { id: sessionId },
      include: {
        character: {
          include: { currentPublishedVersion: true },
        },
      },
    });

    if (!sessionRecord || sessionRecord.userId !== userId) {
      ws.close(1008, 'Unauthorized Session');
      return;
    }

    const version = sessionRecord.character.currentPublishedVersion;
    const voiceConfigData = (version?.voiceConfigData as any) || {};
    const voiceConfig: CharacterVoiceSettings = {
      voiceEnabled: voiceConfigData.voiceEnabled ?? true,
      provider: sessionRecord.provider as any || 'elevenlabs',
      voiceId: sessionRecord.voiceId || '21m00Tcm4TlvDq8ikWAM',
      language: sessionRecord.language || 'en',
      speed: voiceConfigData.speed || 1.0,
      pitch: voiceConfigData.pitch || 0.0,
      stability: voiceConfigData.stability || 0.75,
      defaultVoiceMode: (sessionRecord.voiceMode as any) || 'hands_free',
    };

    const clientSession: ClientVoiceSession = {
      sessionId,
      userId,
      characterId: sessionRecord.characterId,
      conversationId: sessionRecord.conversationId || '',
      voiceConfig,
      socket: ws,
      sequenceCounter: 1,
      turnIndex: 1,
      audioChunks: [],
      speechStartTimeMs: 0,
      isAlive: true,
    };

    this.activeSessions.set(sessionId, clientSession);

    // Update status to connected
    await prisma.voiceSession.update({
      where: { id: sessionId },
      data: { status: 'connected', lastActivityAt: new Date() },
    });

    // Send ready event
    this.sendEvent(clientSession, 'voice.session.ready', {
      sessionId,
      characterId: sessionRecord.characterId,
      voiceConfig,
    });

    ws.on('pong', () => {
      clientSession.isAlive = true;
    });

    ws.on('message', async (data: any, isBinary: boolean) => {
      clientSession.isAlive = true;
      try {
        if (isBinary) {
          // Direct binary audio chunk
          clientSession.audioChunks.push(Buffer.from(data));
          return;
        }

        const msgStr = data.toString();
        const event = JSON.parse(msgStr) as VoiceRealtimeEvent;
        await this.handleClientEvent(clientSession, event);
      } catch (err: any) {
        logger.error(`[VoiceWebSocketServer] Message processing error: ${err.message}`);
        this.sendEvent(clientSession, 'voice.error', {
          code: 'VOICE_INVALID_PACKET',
          message: err.message,
        });
      }
    });

    ws.on('close', async () => {
      logger.info(`[VoiceWebSocketServer] Socket closed for session ${sessionId}`);
      if (clientSession.currentAbortController) {
        clientSession.currentAbortController.abort();
      }
      this.activeSessions.delete(sessionId);
      await prisma.voiceSession.updateMany({
        where: { id: sessionId, status: { in: ['connecting', 'connected', 'active'] } },
        data: { status: 'completed', endedAt: new Date() },
      });
    });

    ws.on('error', (err) => {
      logger.error(`[VoiceWebSocketServer] Socket error on session ${sessionId}: ${err.message}`);
    });
  }

  /**
   * Handles incoming client events.
   */
  private async handleClientEvent(session: ClientVoiceSession, event: VoiceRealtimeEvent): Promise<void> {
    switch (event.type) {
      case 'voice.audio.started': {
        session.audioChunks = [];
        session.speechStartTimeMs = Date.now();
        // If AI was speaking, user speaking is an instant barge-in!
        if (session.currentAbortController) {
          logger.info(`[VoiceWebSocketServer] Barge-in detected via audio.started for session ${session.sessionId}`);
          session.currentAbortController.abort();
          session.currentAbortController = undefined;
          this.sendEvent(session, 'voice.interrupted', { reason: 'barge_in' });
        }
        break;
      }

      case 'voice.audio.chunk': {
        if (event.payload?.audioBase64) {
          session.audioChunks.push(Buffer.from(event.payload.audioBase64, 'base64'));
        }
        break;
      }

      case 'voice.interrupted': {
        // User requested interruption explicitly (e.g. push-to-talk press or UI interrupt)
        logger.info(`[VoiceWebSocketServer] Explicit interruption received for session ${session.sessionId}`);
        if (session.currentAbortController) {
          session.currentAbortController.abort();
          session.currentAbortController = undefined;
        }
        this.sendEvent(session, 'voice.interrupted', { reason: 'user_action' });
        break;
      }

      case 'voice.audio.stopped': {
        // Speech turn ended! Process STT and AI generation turn.
        const speechDurationMs = Math.max(300, Date.now() - (session.speechStartTimeMs || Date.now() - 1000));
        const audioBuffer = session.audioChunks.length > 0
          ? Buffer.concat(session.audioChunks)
          : Buffer.alloc(48000, 0); // fallback test buffer
        session.audioChunks = [];

        await this.processSpeechTurn(session, audioBuffer, speechDurationMs);
        break;
      }

      case 'voice.heartbeat': {
        this.sendEvent(session, 'voice.heartbeat', { timestamp: new Date().toISOString() });
        break;
      }

      default:
        break;
    }
  }

  /**
   * Processes a complete speech recognition and response turn.
   */
  private async processSpeechTurn(session: ClientVoiceSession, audioBuffer: Buffer, speechDurationMs: number): Promise<void> {
    const sttStartTime = Date.now();

    try {
      // 1. Perform Speech-To-Text
      const sttResult = await this.voiceGateway.transcribe(
        audioBuffer,
        session.voiceConfig.provider === 'openai' ? 'openai' : 'openai',
        { language: session.voiceConfig.language }
      );

      const sttLatencyMs = Date.now() - sttStartTime;

      // 2. Emit Final Transcript Event
      this.sendEvent(session, 'voice.transcript.final', {
        transcript: sttResult.transcript,
        confidence: sttResult.confidence,
        language: sttResult.language,
        speechDurationMs,
        sttLatencyMs,
      });

      if (!sttResult.transcript || sttResult.transcript.trim().length === 0) {
        return;
      }

      // 3. Initiate AI Generation & Streaming Speech Synthesis
      const abortController = new AbortController();
      session.currentAbortController = abortController;

      this.sendEvent(session, 'voice.generation.started', {
        turnIndex: session.turnIndex,
      });

      const turnIndex = session.turnIndex++;
      this.sendEvent(session, 'voice.tts.started', { turnIndex });

      await this.voiceBridge.processTurn({
        sessionId: session.sessionId,
        userId: session.userId,
        characterId: session.characterId,
        conversationId: session.conversationId,
        userTranscript: sttResult.transcript,
        userSpeechDurationMs: speechDurationMs,
        sttLatencyMs,
        sttConfidence: sttResult.confidence,
        voiceConfig: session.voiceConfig,
        turnIndex,
        onGenerationDelta: (delta, accumulated) => {
          this.sendEvent(session, 'voice.generation.delta', {
            delta,
            accumulated,
            turnIndex,
          });
        },
        onTTSChunk: (chunk) => {
          this.sendEvent(session, 'voice.tts.audio', {
            audioBase64: chunk.audioChunk.toString('base64'),
            sequence: chunk.sequence,
            isFinal: chunk.isFinal,
            format: chunk.format,
            sampleRate: chunk.sampleRate,
            turnIndex,
          });
        },
        abortSignal: abortController.signal,
      });

      this.sendEvent(session, 'voice.generation.completed', { turnIndex });
      this.sendEvent(session, 'voice.tts.completed', { turnIndex });
    } catch (err: any) {
      if (err.name === 'AbortError' || session.currentAbortController?.signal.aborted) {
        logger.info(`[VoiceWebSocketServer] Turn ${session.turnIndex} was aborted`);
      } else {
        logger.error(`[VoiceWebSocketServer] Turn processing error: ${err.message}`);
        this.sendEvent(session, 'voice.error', {
          code: 'VOICE_STT_FAILED',
          message: err.message,
        });
      }
    } finally {
      session.currentAbortController = undefined;
    }
  }

  /**
   * Helper to send typed events down the socket.
   */
  private sendEvent(session: ClientVoiceSession, type: VoiceEventType, payload: any): void {
    if (session.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const event: VoiceRealtimeEvent = {
      id: `evt_${Date.now()}_${session.sequenceCounter}`,
      sessionId: session.sessionId,
      type,
      sequence: session.sequenceCounter++,
      timestamp: new Date().toISOString(),
      payload,
    };

    session.socket.send(JSON.stringify(event));
  }
}
