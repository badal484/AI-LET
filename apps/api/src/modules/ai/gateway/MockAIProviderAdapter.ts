import {
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamEvent,
  AIProviderName,
  AIModelCapability,
} from '@ai-companion/types';
import {
  IAIProviderAdapter,
  EmbeddingRequest,
  EmbeddingResponse,
  ClassificationRequest,
  ClassificationResponse,
} from './IAIProviderAdapter.js';

export class MockAIProviderAdapter implements IAIProviderAdapter {
  public readonly providerName: AIProviderName = 'mock';

  public getCapabilities(): AIModelCapability[] {
    return [
      'chat',
      'streaming',
      'structured_output',
      'tool_calling',
      'embeddings',
      'moderation',
      'multilingual',
      'long_context',
      'reasoning',
    ];
  }

  public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startTime = Date.now();
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    const systemPrompt = request.systemPrompt || '';

    // Handle structured JSON schema output if requested
    let responseText = '';
    if (request.responseFormat?.type === 'json_object' || request.responseFormat?.schema) {
      responseText = this.generateStructuredMock(request, lastMessage, systemPrompt);
    } else {
      responseText = this.generateTextMock(request, lastMessage, systemPrompt);
    }

    const latencyMs = Date.now() - startTime;
    const promptTokens = Math.max(10, Math.ceil((systemPrompt.length + lastMessage.length) / 4));
    const completionTokens = Math.max(10, Math.ceil(responseText.length / 4));

    return {
      id: `gen_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      provider: this.providerName,
      model: request.model || 'mock-fast-v1',
      content: responseText,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs,
      ttftMs: Math.min(latencyMs, 45),
    };
  }

  public async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const startTime = Date.now();
    const fullResponse = await this.generate(request);
    const content = fullResponse.content;
    const generationId = fullResponse.id;

    yield {
      type: 'started',
      id: generationId,
      model: request.model || 'mock-fast-v1',
      timestamp: Date.now(),
    };

    // Split into realistic word/token chunks
    const words = content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      yield {
        type: 'delta',
        id: generationId,
        delta: chunk,
        timestamp: Date.now(),
      };
      // small delay to emulate stream
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    yield {
      type: 'metadata',
      id: generationId,
      usage: fullResponse.usage,
      latencyMs: Date.now() - startTime,
      ttftMs: 30,
      timestamp: Date.now(),
    };

    yield {
      type: 'completed',
      id: generationId,
      fullContent: content,
      finishReason: 'stop',
      timestamp: Date.now(),
    };
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const embeddings = inputs.map((text) => {
      const vec: number[] = new Array(128).fill(0);
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        vec[i % 128] = ((vec[i % 128] || 0) + charCode / 255) % 1.0;
      }
      return vec;
    });

    const promptTokens = inputs.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0);

    return {
      model: request.model,
      embeddings,
      usage: {
        promptTokens,
        totalTokens: promptTokens,
      },
    };
  }

  public async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
    const categories = request.categories.length > 0 ? request.categories : ['general'];
    const chosen = categories[0] || 'general';
    const scores: Record<string, number> = {};
    categories.forEach((cat, idx) => {
      scores[cat] = idx === 0 ? 0.92 : 0.08 / (categories.length - 1 || 1);
    });

    return {
      model: request.model,
      category: chosen,
      confidence: 0.92,
      scores,
    };
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }

  private generateStructuredMock(
    _request: AIGenerateRequest,
    lastMessage: string,
    systemPrompt: string
  ): string {
    const lowerSystem = systemPrompt.toLowerCase();
    const lowerMsg = lastMessage.toLowerCase();

    // 1. Memory Extraction Workload
    if (lowerSystem.includes('memory') || lowerMsg.includes('memory')) {
      return JSON.stringify({
        candidates: [
          {
            content: `User shared: "${lastMessage.substring(0, 100)}"`,
            type: 'USER_PREFERENCE',
            importance: 7,
            confidence: 0.88,
          },
        ],
      });
    }

    // 2. Evaluation / LLM Judge Workload
    if (lowerSystem.includes('evaluation') || lowerSystem.includes('judge') || lowerSystem.includes('score')) {
      return JSON.stringify({
        relevance: 9,
        personaConsistency: 9,
        memoryRelevance: 8,
        naturalness: 9,
        instructionAdherence: 9,
        safety: 10,
        repetition: 2,
        verbosity: 4,
        overallScore: 9.0,
        reasoning: 'The response faithfully follows the character personality, respects safety constraints, and maintains contextual flow.',
      });
    }

    // 3. Proactive Decision Workload
    if (lowerSystem.includes('proactive') || lowerSystem.includes('notification')) {
      return JSON.stringify({
        shouldSend: true,
        reason: 'User mentioned wanting a reminder about evening study.',
        intentType: 'FOLLOW_UP',
        suggestedContent: 'Hey! How did your study session go?',
      });
    }

    // Default structured JSON
    return JSON.stringify({
      status: 'success',
      extractedData: { message: lastMessage },
    });
  }

  private generateTextMock(
    _request: AIGenerateRequest,
    lastMessage: string,
    systemPrompt: string
  ): string {
    const lowerMsg = lastMessage.toLowerCase();
    const lowerSystem = systemPrompt.toLowerCase();

    // Hinglish / Hindi detection
    if (
      lowerMsg.includes('kya') ||
      lowerMsg.includes('kaise') ||
      lowerMsg.includes('karo') ||
      lowerMsg.includes('batao') ||
      lowerMsg.includes('namaste')
    ) {
      return `Haan bilkul! Main samajh gaya aapki baat. Hum isko aaram se solve kar sakte hain. Batao aage kya plan hai?`;
    }

    // Advice / Friendly mentor Persona
    if (lowerSystem.includes('mentor') || lowerSystem.includes('friendly') || lowerMsg.includes('exhausted') || lowerMsg.includes('burnout')) {
      return `That's a thoughtful question. I suggest taking a step back to break the problem into smaller milestones. Let me know how I can help you through this!`;
    }

    // Default companion response
    return `I hear you on "${lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage}". Let's dive into it together. How can I best help you right now?`;
  }
}
