import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { ContextBuilder } from '../../conversations/engine/contextBuilder.js';
import { CharacterService } from '../../characters/services/character.service.js';
import { AIGateway } from '../../ai/gateway/AIGateway.js';
import { ModelRouterService } from '../../ai/routing/ModelRouter.service.js';
import { VoiceGateway } from '../gateway/VoiceGateway.js';
import { SentenceBuffer } from './SentenceBuffer.js';
import { VoiceTelemetryService } from './VoiceTelemetryService.js';
import { MemoryContextProvider } from '../../memory/services/memoryContext.provider.js';
import { MemoryExtractionService } from '../../memory/services/memoryExtraction.service.js';
import { ConversationSummaryService } from '../../memory/services/conversationSummary.service.js';
import { RelationshipContextProvider } from '../../relationships/services/relationshipContext.provider.js';
import { RelationshipAnalyzerService } from '../../relationships/services/relationshipAnalyzer.service.js';
import { RelationshipStateService } from '../../relationships/services/relationshipState.service.js';
import { TTSSpeechChunk } from '../gateway/ITextToSpeechProvider.js';
import type { CharacterVoiceSettings } from '@ai-companion/types';

export interface ProcessVoiceTurnParams {
  sessionId: string;
  userId: string;
  characterId: string;
  characterVersionId?: string | null;
  conversationId: string;
  userTranscript: string;
  userSpeechDurationMs: number;
  sttLatencyMs: number;
  sttConfidence: number;
  voiceConfig: CharacterVoiceSettings;
  turnIndex: number;
  onGenerationDelta: (delta: string, accumulated: string) => void;
  onTTSChunk: (chunk: TTSSpeechChunk) => void;
  abortSignal?: AbortSignal;
}

export interface VoiceTurnResult {
  aiResponseText: string;
  llmFirstTokenMs: number;
  llmTotalMs: number;
  ttsFirstAudioMs: number;
  ttsTotalMs: number;
  totalTurnLatencyMs: number;
  interrupted: boolean;
  sttCostUsd: number;
  llmCostUsd: number;
  ttsCostUsd: number;
  totalCostUsd: number;
}

export class VoiceConversationBridge {
  private static instance: VoiceConversationBridge;
  private aiGateway = AIGateway.getInstance();
  private modelRouter = ModelRouterService.getInstance();
  private voiceGateway = VoiceGateway.getInstance();
  private telemetry = VoiceTelemetryService.getInstance();

  public static getInstance(): VoiceConversationBridge {
    if (!VoiceConversationBridge.instance) {
      VoiceConversationBridge.instance = new VoiceConversationBridge();
    }
    return VoiceConversationBridge.instance;
  }

  /**
   * Orchestrates a voice conversation turn.
   */
  public async processTurn(params: ProcessVoiceTurnParams): Promise<VoiceTurnResult> {
    const turnStartTime = Date.now();
    let llmFirstTokenMs = 0;
    let ttsFirstAudioMs = 0;
    let interrupted = false;
    let accumulatedText = '';
    let ttsCharacters = 0;

    // 1. Persist User Message with source: 'voice'
    const userMessage = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderType: 'USER',
        senderId: params.userId,
        role: 'user',
        content: params.userTranscript,
        status: 'SENT',
        source: 'voice',
        audioDurationSeconds: Math.max(1, Math.round(params.userSpeechDurationMs / 1000)),
      },
    });

    // 2. Fetch Conversation & Profile
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: {
        character: true,
        user: { include: { profile: true } },
      },
    });

    if (!conversation) {
      throw new Error(`Conversation not found for id ${params.conversationId}`);
    }

    const characterRuntime = await CharacterService.resolveRuntime(
      conversation.characterId,
      conversation.characterVersionId || undefined
    );

    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        id: { not: userMessage.id },
        status: 'SENT',
      },
      take: 10,
      orderBy: { sequenceNumber: 'desc' },
      select: { role: true, content: true, createdAt: true },
    });

    const latestSummary = await ConversationSummaryService.getLatestSummary(params.conversationId);
    const memoryProvider = new MemoryContextProvider();
    const relationshipProvider = new RelationshipContextProvider();

    const builtContext = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages: recentMessages.reverse(),
      currentUserMessage: params.userTranscript,
      userContext: {
        userId: params.userId,
        userName: conversation.user.profile?.displayName || 'User',
        preferredLanguage: conversation.user.profile?.preferredLanguage || 'en',
        locale: conversation.user.profile?.locale,
      },
      conversationId: params.conversationId,
      memoryProvider,
      relationshipProvider,
      conversationSummary: latestSummary?.summary,
    });

    // 3. Resolve Model via ModelRouterService
    const route = await this.modelRouter.selectRoute('CONVERSATION', {
      requiredCapabilities: ['streaming'],
      latencyTarget: 'fast',
    });

    const primaryModel = route.primaryModel;

    // 4. Stream LLM Generation + Chunk via SentenceBuffer
    const sentenceBuffer = new SentenceBuffer({
      minChunkLength: 10,
      maxChunkLength: 150,
    });

    const llmStartTime = Date.now();
    let speechChunkSequence = 1;

    try {
      const messagesPayload = builtContext.messages.map((m: any) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

      // Stream LLM tokens
      const tokenStream = this.aiGateway.stream(
        {
          model: primaryModel.modelName,
          messages: messagesPayload,
          systemPrompt: builtContext.systemPrompt,
          temperature: characterRuntime.aiConfig.temperature || 0.7,
          maxTokens: Math.min(300, characterRuntime.aiConfig.maxOutputTokens || 300),
        },
        primaryModel.provider as any
      );

      for await (const event of tokenStream) {
        if (params.abortSignal?.aborted) {
          interrupted = true;
          sentenceBuffer.clear();
          break;
        }

        if (event.type === 'delta' && event.delta) {
          if (!llmFirstTokenMs) {
            llmFirstTokenMs = Date.now() - llmStartTime;
          }
          accumulatedText += event.delta;
          params.onGenerationDelta(event.delta, accumulatedText);

          // Push token into sentence buffer
          const sentences = sentenceBuffer.push(event.delta);
          for (const sentence of sentences) {
            if (params.abortSignal?.aborted) {
              interrupted = true;
              break;
            }
            ttsCharacters += sentence.length;

            await this.voiceGateway.streamSynthesis(
              sentence,
              params.voiceConfig.provider,
              {
                voiceId: params.voiceConfig.voiceId,
                language: params.voiceConfig.language,
                speed: params.voiceConfig.speed,
                pitch: params.voiceConfig.pitch,
                stability: params.voiceConfig.stability,
              },
              (chunk) => {
                if (!ttsFirstAudioMs) {
                  ttsFirstAudioMs = Date.now() - turnStartTime;
                }
                params.onTTSChunk({
                  ...chunk,
                  sequence: speechChunkSequence++,
                });
              },
              params.abortSignal
            );
          }
        }
      }

      // Flush remaining residual buffer if not aborted
      if (!interrupted) {
        const remaining = sentenceBuffer.flush();
        if (remaining && !params.abortSignal?.aborted) {
          ttsCharacters += remaining.length;
          await this.voiceGateway.streamSynthesis(
            remaining,
            params.voiceConfig.provider,
            {
              voiceId: params.voiceConfig.voiceId,
              language: params.voiceConfig.language,
              speed: params.voiceConfig.speed,
              pitch: params.voiceConfig.pitch,
              stability: params.voiceConfig.stability,
            },
            (chunk) => {
              if (!ttsFirstAudioMs) {
                ttsFirstAudioMs = Date.now() - turnStartTime;
              }
              params.onTTSChunk({
                ...chunk,
                sequence: speechChunkSequence++,
              });
            },
            params.abortSignal
          );
        }
      }
    } catch (err: any) {
      if (params.abortSignal?.aborted) {
        interrupted = true;
      } else {
        logger.error(`[VoiceConversationBridge] Turn processing error: ${err.message}`);
        throw err;
      }
    }

    const llmTotalMs = Date.now() - llmStartTime;
    const totalTurnLatencyMs = Date.now() - turnStartTime;
    const ttsTotalMs = Math.max(200, Math.floor(ttsCharacters * 15));

    // Calculate Costs
    const sttCostUsd = (params.userSpeechDurationMs / 60000) * 0.006;
    const llmCostUsd = 0.0003;
    const ttsCostUsd = (ttsCharacters / 1000) * 0.015;
    const totalCostUsd = sttCostUsd + llmCostUsd + ttsCostUsd;

    // 5. Persist Assistant Response Message
    if (accumulatedText.trim().length > 0) {
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: params.conversationId,
          senderType: 'CHARACTER',
          senderId: params.characterId,
          role: 'assistant',
          content: accumulatedText.trim(),
          status: interrupted ? 'INTERRUPTED' : 'SENT',
          source: 'voice',
          characterVersionId: characterRuntime.versionId,
          modelUsed: primaryModel.modelName,
          providerUsed: primaryModel.provider,
          latencyMs: totalTurnLatencyMs,
          ttftMs: llmFirstTokenMs,
        },
      });

      // 6. Asynchronous Background Memory Extraction & Relationship Analysis
      if (!interrupted) {
        MemoryExtractionService.processConversationMessage({
          userId: params.userId,
          characterId: params.characterId,
          conversationId: params.conversationId,
          userMessage: params.userTranscript,
          assistantMessage: accumulatedText,
          sourceMessageId: userMessage.id,
        }).catch((err: any) => logger.warn(`[VoiceBridge] Memory extraction failed: ${err.message}`));

        RelationshipAnalyzerService.analyzeInteraction({
          userMessage: params.userTranscript,
          assistantMessage: accumulatedText,
          characterName: characterRuntime.name,
          characterRole: characterRuntime.identity.role,
          hoursSinceLastInteraction: null,
        })
          .then(async (analysisResult) => {
            await RelationshipStateService.applyInteractionUpdate({
              userId: params.userId,
              characterId: params.characterId,
              analysisResult,
              conversationId: params.conversationId,
              messageId: assistantMessage.id,
            });
          })
          .catch((err: any) => logger.warn(`[VoiceBridge] Relationship analysis failed: ${err.message}`));
      }
    }

    // 7. Record Telemetry
    await this.telemetry.recordTurn({
      sessionId: params.sessionId,
      turnIndex: params.turnIndex,
      userTranscript: params.userTranscript,
      userSpeechDurationMs: params.userSpeechDurationMs,
      sttLatencyMs: params.sttLatencyMs,
      sttConfidence: params.sttConfidence,
      aiResponseText: accumulatedText,
      llmFirstTokenMs: llmFirstTokenMs || 150,
      llmTotalMs,
      ttsFirstAudioMs: ttsFirstAudioMs || 300,
      ttsTotalMs,
      totalTurnLatencyMs,
      interrupted,
      interruptedAtMs: interrupted ? Date.now() - turnStartTime : null,
      sttCostUsd,
      llmCostUsd,
      ttsCostUsd,
      totalCostUsd,
    });

    return {
      aiResponseText: accumulatedText,
      llmFirstTokenMs: llmFirstTokenMs || 150,
      llmTotalMs,
      ttsFirstAudioMs: ttsFirstAudioMs || 300,
      ttsTotalMs,
      totalTurnLatencyMs,
      interrupted,
      sttCostUsd,
      llmCostUsd,
      ttsCostUsd,
      totalCostUsd,
    };
  }
}
