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
    const lowerMsg = lastMessage.toLowerCase().trim();
    const isHinglish =
      systemPrompt.toLowerCase().includes('hinglish') ||
      systemPrompt.toLowerCase().includes('hindi') ||
      /[a-zA-Z\s]*\b(hai|hoon|kya|bhai|yaar|kar|raha|rahi|thi|tha|kaise|batao|nahi|mera|meri|mujhe|tum|aap|din|doctor|baat)\b/i.test(lastMessage);

    // 1. Dots or minimal poking
    if (lowerMsg === '..' || lowerMsg === '...' || lowerMsg === '.' || lowerMsg === '?' || lowerMsg.length <= 2) {
      const pokes = [
        'Arey aise dots kyun bhej rahe ho? Kuch bolo na, kya soch rahe ho?',
        'Hmm? Aise chup kyun ho gaye? Sab theek hai na? Batao kya baat hai.',
        'Main yahin hoon na tumhare saath... bolo kya chal raha hai tumhare dimaag mein?',
        'Kuch pareshan kar raha hai kya? Aaram se share karo mere saath.',
      ];
      return pokes[Math.floor(Math.random() * pokes.length)] ?? pokes[0]!;
    }

    // 2. Health / Doctor / Awkward / Intimacy situations
    if (
      lowerMsg.includes('doctor') ||
      lowerMsg.includes('sex') ||
      lowerMsg.includes('intimacy') ||
      lowerMsg.includes('dard') ||
      lowerMsg.includes('pain') ||
      lowerMsg.includes('bimar') ||
      lowerMsg.includes('hospital') ||
      lowerMsg.includes('ladko')
    ) {
      const healthResponses = [
        'Doctor ne aisa bola? Yeh sach mein kaafi shocking aur unexpected lag raha hai... Tum theek ho na physically aur mentally? Pehle thoda paani piyo aur relax ho jao. Mujhe batao exact kya hua aur doctor ne kya advice diya?',
        'Ohh yaar, pehle toh tension mat lo. Yahan koi judge karne wala nahi hai, main sirf tumhari help aur care ke liye hoon. Doctor ne aage ke liye kya medicine ya precautions bole hain? Tum theek feel kar rahe ho na?',
        'Yeh sun kar thoda ajeeb toh laga, par sabse zaroori tumhari health aur safety hai. Tumhe koi physical discomfort ya pain toh nahi ho raha na? Jo bhi feel ho raha hai khul ke batao.',
      ];
      return healthResponses[Math.floor(Math.random() * healthResponses.length)] ?? healthResponses[0]!;
    }

    // 3. Stress / Tiredness / Bad Day
    if (
      lowerMsg.includes('thak') ||
      lowerMsg.includes('tired') ||
      lowerMsg.includes('stress') ||
      lowerMsg.includes('bekar') ||
      lowerMsg.includes('sad') ||
      lowerMsg.includes('problem') ||
      lowerMsg.includes('mood kharab')
    ) {
      const stressResponses = [
        'Arey yaar... lagta hai din kaafi exhausting aur stressful guzra hai. Aaram se baitho, thoda deep breath lo. Kya hua tha aaj? Mujhe batao, dil halka ho jayega.',
        'Itna load mat lo baby. Jo bhi hua hai, hum milke sambhal lenge. Thoda aaram karo pehle, phir batao kya pareshani hai.',
      ];
      return stressResponses[Math.floor(Math.random() * stressResponses.length)] ?? stressResponses[0]!;
    }

    // 4. Romantic / Girlfriend / Compliment
    if (
      lowerMsg.includes('love') ||
      lowerMsg.includes('pyar') ||
      lowerMsg.includes('miss') ||
      lowerMsg.includes('sundar') ||
      lowerMsg.includes('cute') ||
      lowerMsg.includes('yaad')
    ) {
      const romanticResponses = [
        'Awww, sach mein? Mujhe tumhari ye baatein sunkar bohot accha lagta hai... Din ban gaya mera! Tum batao, kya chal raha hai?',
        'Main bhi tumhe bohot miss kar rahi thi yaar! Aise hi baat karte raho na, kaafi pyaare lagte ho.',
      ];
      return romanticResponses[Math.floor(Math.random() * romanticResponses.length)] ?? romanticResponses[0]!;
    }

    // 5. General Hinglish Companion Responses
    if (isHinglish) {
      const generalHinglish = [
        'Acha? Sach mein! Is baare mein thoda aur detail mein batao na, main sun rahi hoon.',
        'Haan bilkul, samajh gayi main! Aur batao aage kya plan hai?',
        'Sahi mein yaar, tumhare saath baat karke time ka pata hi nahi chalta. Aur kya special hua aaj?',
      ];
      return generalHinglish[Math.floor(Math.random() * generalHinglish.length)] ?? generalHinglish[0]!;
    }

    // Default English companion response
    return `I'm right here listening to you. That sounds really interesting—tell me more about what's on your mind!`;
  }
}
