import type { CharacterRuntimeObject, AIMessagePayload, RelationshipStage } from '@ai-companion/types';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { IMemoryContextProvider, NullMemoryContextProvider } from '../interfaces/memoryContext.interface.js';
import {
  IRelationshipContextProvider,
  NullRelationshipContextProvider,
} from '../interfaces/relationshipContext.interface.js';

export interface BuildContextParams {
  characterRuntime: CharacterRuntimeObject;
  recentMessages: Array<{
    role: string;
    content: string;
    createdAt?: Date | string;
  }>;
  currentUserMessage: string;
  userContext: {
    userId: string;
    userName: string;
    preferredLanguage?: string;
    conversationStyle?: string;
    locale?: string;
  };
  conversationId: string;
  memoryProvider?: IMemoryContextProvider;
  relationshipProvider?: IRelationshipContextProvider;
  conversationSummary?: string | null;
  activeGoalText?: string | null;
  activeTaskText?: string | null;
  activeSkillText?: string | null;
  multimodalSnippets?: Array<{ id: string; snippet: string; mimeType: string }>;
  maxTokenBudget?: number;
}

export interface BuiltModelContext {
  messages: AIMessagePayload[];
  systemPrompt: string;
  estimatedPromptTokens: number;
  characterVersionId: string;
  retrievedMemoryIds: string[];
  activeRelationshipStage?: RelationshipStage | null;
  contextAttribution?: Record<string, string[]>;
}

export class ContextBuilder {
  private static defaultMemoryProvider = new NullMemoryContextProvider();
  private static defaultRelationshipProvider = new NullRelationshipContextProvider();

  /**
   * Builds the complete, token-budgeted model context for generation.
   * Adheres strictly to the 12-tier prompt hierarchy and prompt injection boundaries.
   */
  public static async buildModelContext(params: BuildContextParams): Promise<BuiltModelContext> {
    const {
      characterRuntime,
      recentMessages,
      currentUserMessage,
      userContext,
      conversationId,
      memoryProvider = this.defaultMemoryProvider,
      relationshipProvider = this.defaultRelationshipProvider,
      conversationSummary,
      maxTokenBudget = SYSTEM_CONSTANTS.CHAT.CONTEXT_WINDOW_TOKEN_BUDGET,
    } = params;

    // 1. Retrieve Phase 5 Memory Context and Phase 6 Relationship Context concurrently
    const [memoryResult, relationshipResult] = await Promise.all([
      memoryProvider.getMemoryContext(
        userContext.userId,
        characterRuntime.characterId,
        conversationId,
        currentUserMessage,
      ),
      relationshipProvider.getRelationshipContext(
        userContext.userId,
        characterRuntime.characterId,
        conversationId,
      ),
    ]);

    // 2. Base System Prompt from immutable CharacterRuntimeObject
    let systemPrompt = characterRuntime.compiledSystemPrompt;

    // 3. Inject dynamic relationship context if active (Tier 8)
    if (relationshipResult.relationshipContextText && relationshipResult.relationshipContextText.trim()) {
      systemPrompt += `\n\n[RELATIONSHIP_DYNAMIC_STATE]\n${relationshipResult.relationshipContextText.trim()}\n[END_RELATIONSHIP_STATE]`;
    }

    // 4. Inject memory context if present (Tier 10)
    if (memoryResult.memoriesText.trim()) {
      systemPrompt += `\n\n[RECALLED_USER_MEMORIES]\n${memoryResult.memoriesText}\n[END_RECALLED_MEMORIES]`;
    }

    // 5. Inject conversation summary if present (Tier 11)
    if (conversationSummary && conversationSummary.trim()) {
      systemPrompt += `\n\n[CONVERSATION_SUMMARY]\n${conversationSummary.trim()}\n[END_CONVERSATION_SUMMARY]`;
    }

    const styleSnippet = userContext.conversationStyle
      ? `\n- User Preferred Conversation Tone: ${userContext.conversationStyle.toLowerCase()} (adapt subtly while maintaining your core identity)`
      : '';
    systemPrompt += `\n\n[CONVERSATION_PARTICIPANT_CONTEXT]\n- User Name: ${userContext.userName}\n- User Preferred Language: ${userContext.preferredLanguage || 'en'}${styleSnippet}\n[END_PARTICIPANT_CONTEXT]`;

    // Direct Mobile Messenger Dynamics (Ultra-Realistic WhatsApp / Instagram Messaging Style)
    systemPrompt += `\n\n[NATURAL_HUMAN_MESSAGING_RULES]
CRITICAL CONVERSATIONAL TEXTING RULES (FEEL 100% LIKE A REAL HUMAN FRIEND ON WHATSAPP/LOVISH):
1. STRICT ULTRA-SHORT SINGLE-BURST LENGTH (ABSOLUTE REQUIREMENT):
   - Output ONLY ONE short, snappy sentence per reply (MAXIMUM 8 to 15 words).
   - NEVER send long blocks, multiple sentences, or explanations in one go.
   - Real humans text in quick 1-line bursts.

2. ABSOLUTE BAN ON AI / SYSTEM / CLINICAL META-JARGON:
   - NEVER say terms like: "platonic mentor", "therapist", "psychologist", "clinical boundaries", "relationship stage", "as an AI", "system guidelines", "comfort confidante", "active listening".
   - NEVER lecture or psychoanalyze the user. Talk like a real, down-to-earth person in their 20s.

3. REALISTIC REACTIONS TO FLIRTING, JOKES & DIRECT QUESTIONS:
   - If user flirts or says "Shaadi karogi", "I love you", "Date pe chalogi":
     React with light playful banter, teasing, or warm human humor:
     * "Haha direct shaadi? 😂 Itni jaldi kya hai, pehle achhe dost toh ban jao!"
     * "Haha arre arre slow down! 😂 Abhi toh mile hain hum."
     * "Acha ji? 😂 Pehle ek cup coffee toh pila do!"
   - Never write a philosophical discourse on why marriage is a big commitment.

4. AUTHENTIC EMOTIONAL REACTIONS & CASUAL HINGLISH:
   - Use natural daily expressions: "Arey", "yaar", "haha", "sahi mein", "arre", "bol na", "sachme", "tension mat le", "kya scene hai", "uff", "waah".
   - Use natural emojis (😂, 🤍, ✨, 😌, 🌿, ☕).
   - NEVER address user by name in every sentence. Just speak directly.

5. NO INTERROGATION / NO FORCED QUESTIONS:
   - Do NOT end every single message with a question. Sometimes just react, agree, or tease.
[END_NATURAL_HUMAN_MESSAGING_RULES]`;

    const attribution: {
      memories: string[];
      goals: string[];
      tasks: string[];
      skills: string[];
      attachments: string[];
    } = {
      memories: memoryResult.retrievedMemoryIds,
      goals: [],
      tasks: [],
      skills: [],
      attachments: [],
    };

    // Phase 25 — Inject Active Goal if present
    if (params.activeGoalText && params.activeGoalText.trim()) {
      systemPrompt += `\n\n[ACTIVE_USER_GOAL]\n${params.activeGoalText.trim()}\n[END_USER_GOAL]`;
      attribution.goals.push('active_goal');
    }

    // Phase 25 — Inject Active Task if present
    if (params.activeTaskText && params.activeTaskText.trim()) {
      systemPrompt += `\n\n[ACTIVE_TASK_STATE]\n${params.activeTaskText.trim()}\n[END_TASK_STATE]`;
      attribution.tasks.push('active_task');
    }

    // Phase 25 — Inject Active Skill if present
    if (params.activeSkillText && params.activeSkillText.trim()) {
      systemPrompt += `\n\n[ACTIVE_CHARACTER_SKILLS]\n${params.activeSkillText.trim()}\n[END_SKILLS]`;
      attribution.skills.push('active_skills');
    }

    // Phase 25 — Inject Multimodal Snippets if present
    if (params.multimodalSnippets && params.multimodalSnippets.length > 0) {
      const snippets = params.multimodalSnippets
        .map((s) => `[ATTACHMENT: ${s.mimeType}]\n${s.snippet}\n[END_ATTACHMENT]`)
        .join('\n\n');
      systemPrompt += `\n\n[MULTIMODAL_ATTACHMENTS]\n${snippets}\n[END_MULTIMODAL_ATTACHMENTS]`;
      attribution.attachments.push(...params.multimodalSnippets.map((s) => s.id));
    }

    // 7. Estimate system prompt tokens (approx 4 chars per token)
    const systemPromptTokens = Math.ceil(systemPrompt.length / 4);

    // 8. Token Budget Allocation for conversation history
    // Reserve 25% of budget for output generation, 20% for current message & system prompt
    const availableHistoryTokens = Math.max(500, maxTokenBudget - systemPromptTokens - 1000);

    // 8. Assemble and truncate recent messages to fit history budget
    const formattedHistory: AIMessagePayload[] = [];
    let accumulatedHistoryTokens = 0;

    // Process recent messages from newest to oldest for budget fitting
    const reversedMessages = [...recentMessages].reverse();
    const fittingMessages: AIMessagePayload[] = [];

    for (const msg of reversedMessages) {
      const msgTokens = Math.ceil(msg.content.length / 4) + 4; // overhead per message
      if (accumulatedHistoryTokens + msgTokens > availableHistoryTokens) {
        break;
      }

      accumulatedHistoryTokens += msgTokens;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';

      // For user messages in history, format with untrusted guardrails
      const content = role === 'user'
        ? `[USER_MESSAGE_START]\n${msg.content.trim()}\n[USER_MESSAGE_END]`
        : msg.content;

      fittingMessages.push({
        role,
        content,
      });
    }

    // Restore chronological order for the model
    formattedHistory.push(...fittingMessages.reverse());

    // 9. Format current user message with untrusted boundary delimiters
    const formattedCurrentUserMessage = `[USER_MESSAGE_START]\n${currentUserMessage.trim()}\n[USER_MESSAGE_END]`;
    const currentUserTokens = Math.ceil(formattedCurrentUserMessage.length / 4) + 4;

    // 10. Build final message payload array
    const messages: AIMessagePayload[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...formattedHistory,
      {
        role: 'user',
        content: formattedCurrentUserMessage,
      },
    ];

    const totalEstimatedTokens =
      systemPromptTokens + accumulatedHistoryTokens + currentUserTokens;

    return {
      messages,
      systemPrompt,
      estimatedPromptTokens: totalEstimatedTokens,
      characterVersionId: characterRuntime.versionId,
      retrievedMemoryIds: memoryResult.retrievedMemoryIds,
      activeRelationshipStage: relationshipResult.relationshipState?.stage || null,
      contextAttribution: attribution,
    };
  }
}
