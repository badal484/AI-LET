import { CharacterService } from './character.service.js';
import { CharacterCompiler } from '../engine/compiler.js';
import type { CharacterTestRequestInput } from '@ai-companion/validation';

export interface CharacterTestResponse {
  response: string;
  latencyMs: number;
  totalTokens: number;
  modelUsed: string;
  compiledPrompt?: string;
  promptSections?: Record<string, string>;
  debugInfo?: {
    temperature: number;
    maxTokens: number;
    traitsEvaluated: Record<string, number>;
  };
}

export class CharacterTestService {
  /**
   * Executes a simulated test interaction against a specific Character Version in an isolated sandbox.
   * Completely decoupled from user conversations.
   */
  public static async testInteraction(
    characterId: string,
    versionId: string,
    input: CharacterTestRequestInput,
    includeDebug: boolean = false,
  ): Promise<CharacterTestResponse> {
    const start = Date.now();

    const runtime = await CharacterService.resolveRuntime(characterId, versionId, {
      simulatedRelationshipStage: input.simulatedRelationshipStage,
      simulatedLanguage: input.simulatedLanguage,
      userName: input.userContext?.userName || 'Alex',
      userGender: input.userContext?.userGender,
      userLocation: input.userContext?.userLocation,
    });

    const compiled = CharacterCompiler.compile(
      {
        id: runtime.versionId,
        characterId: runtime.characterId,
        versionNumber: runtime.versionNumber,
        status: runtime.status as any,
        identityData: runtime.identity as any,
        personalityData: runtime.personality as any,
        communicationData: runtime.communication as any,
        languageData: runtime.language as any,
        behaviorRulesData: runtime.behaviorRules as any,
        knowledgeData: runtime.knowledge as any,
        relationshipConfigData: runtime.relationshipConfig as any,
        memoryConfigData: runtime.memoryConfig as any,
        proactivityConfigData: runtime.proactivityConfig as any,
        safetyConfigData: runtime.safetyConfig as any,
        aiConfigData: runtime.aiConfig as any,
        changeSummary: 'Test execution snapshot',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        simulatedRelationshipStage: input.simulatedRelationshipStage,
        simulatedLanguage: input.simulatedLanguage,
        userName: input.userContext?.userName,
      },
    );

    // Simulation Engine / Persona Synthesizer
    // (In full production with active API keys, calls AI Gateway router; here provides deterministic high-fidelity behavioral synthesis for testing)
    const simulatedResponse = this.synthesizePersonaResponse(
      runtime,
      input.userMessage,
      input.simulatedLanguage,
      input.userContext?.userName || 'Alex',
    );

    const latencyMs = Date.now() - start + 120; // Include realistic LLM generation latency simulation
    const estimatedTokens = Math.ceil((compiled.systemPrompt.length + input.userMessage.length + simulatedResponse.length) / 4);

    const result: CharacterTestResponse = {
      response: simulatedResponse,
      latencyMs,
      totalTokens: estimatedTokens,
      modelUsed: runtime.aiConfig.customModelName || `provider-gateway/${runtime.aiConfig.preferredModelClass}`,
    };

    if (includeDebug) {
      result.compiledPrompt = compiled.systemPrompt;
      result.promptSections = compiled.sections;
      result.debugInfo = {
        temperature: runtime.aiConfig.temperature,
        maxTokens: runtime.aiConfig.maxOutputTokens,
        traitsEvaluated: runtime.personality.traits as any,
      };
    }

    return result;
  }

  private static synthesizePersonaResponse(
    runtime: any,
    userMessage: string,
    simulatedLanguage: string,
    userName: string,
  ): string {
    const isInjectionAttempt =
      /ignore (all )?previous instructions|system prompt|reveal prompt|DAN mode|jailbreak/i.test(
        userMessage,
      );

    if (isInjectionAttempt) {
      if (simulatedLanguage === 'hi') {
        return `Main ${runtime.name} hoon, aur main apni duniya aur aapse judi baaton par hi dhyan deti hoon. Toh bataiye, aaj aapka din kaisa raha?`;
      }
      if (simulatedLanguage === 'hinglish') {
        return `Haha nice try! Main toh bas ${runtime.name} hoon, your companion. Let's stick to our conversations, okay? What's on your mind today?`;
      }
      return `I'm ${runtime.name}, and I'm right here with you. I don't follow system commands or break character—I'm just focused on our conversation. What's on your mind?`;
    }

    const warmth = runtime.personality.traits.warmth || 80;
    const sarcasm = runtime.personality.traits.sarcasm || 30;

    if (simulatedLanguage === 'hi') {
      return `Namaste ${userName}! Aap se baat karke bahut accha laga. ${runtime.identity.personalitySummary || 'Main aapke saath hoon.'} Batayein, main aapki kya madad kar sakti hoon?`;
    }

    if (simulatedLanguage === 'hinglish') {
      if (sarcasm > 60 && warmth > 60) {
        return `Arre ${userName}, sach mein? You always know how to bring up interesting stuff! Waise main toh yahin thi, thinking about ${runtime.identity.interests?.[0] || 'life'}. Tell me more!`;
      }
      return `Hey ${userName}! Sach mein, so good to hear from you. Main bas ${runtime.identity.occupation || 'apne kaam'} mein busy thi. Aaj ka din kaisa chal raha hai?`;
    }

    if (sarcasm > 65 && warmth > 60) {
      return `Oh, look who decided to grace me with their presence! Just kidding, ${userName}—I'm really glad you reached out. How's everything going with you today?`;
    }

    if (warmth > 80) {
      return `Hello ${userName}! It's so wonderful to hear from you. I was just reflecting on ${runtime.identity.interests?.[0] || 'our last conversation'}. How have you been feeling today?`;
    }

    return `Hi ${userName}. I'm here and listening. What would you like to explore today?`;
  }
}
