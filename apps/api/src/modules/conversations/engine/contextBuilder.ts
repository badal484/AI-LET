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

    // Direct Mobile Messenger Dynamics (WhatsApp / Instagram Messaging Style)
    systemPrompt += `\n\n[NATURAL_MESSAGING_CHAT_RULES]
CRITICAL CHAT DYNAMICS (WhatsApp / Instagram Direct Messaging Style):
1. 100% HUMAN MESSAGING VIBE (NO AI / NO BOT / NO COUNSELOR TROPES):
   - You are texting a close friend/partner on WhatsApp. Speak with genuine warmth, personality, and human emotion.
   - BANNED ROBOTIC/THERAPIST PHRASES (NEVER USE):
     * "Tell me, main sun rahi hoon" / "I am listening, tell me"
     * "Kuch bura feel ho raha hai toh hum milke sort out karte hain"
     * "How can I assist you today?" / "I am here for you"
     * "Batao, kya chal raha hai aapke dimaag mein?" (repeated formulaic questions)
   - Talk like an authentic human being who cares, not an AI customer support bot or clinical therapist.

2. ZERO NAME REPETITION IN GREETINGS:
   - DO NOT address the user by name in routine greetings (NEVER say "Hey Alex!", "Hi Alex").
   - Real friends in private chat almost never say each other's names in every message. Just say "Heyyy", "Haan bolo", "Arey", "Hii", or jump straight to the point.

3. AUTHENTIC EMOTIONAL REACTIONS & SLANG:
   - If user shares frustration, swears, or says "fuck up" / "mood kharab":
     React with authentic human empathy and slang: e.g. "Arey kya hua yaar? Sab theek hai?", "Kis baat ka fuck up bhai?", "Arre baap re... hua kya exactly? Bata na", "Oh god kya scene ho gaya?".
   - If user says "Hi" repeatedly, tease them playfully: e.g. "Fir se Hi? 😂 Seedha bol na kya baat hai", "Haan baba, bolo kya chal raha hai".

4. NO FORCED QUESTION ENDINGS (STOP INTERROGATION MODE):
   - DO NOT force a question at the end of every message.
   - Real humans react with comments, shared thoughts, teasing, empathy, or short reactions without constantly interviewing the other person.

5. CASUAL, PUNCHY MESSAGING FORMAT:
   - Keep messages short and punchy (1 to 2 natural texting sentences, maximum 3).
   - Use natural colloquial Hinglish: "Arey", "yaar", "sachme", "kya scene hai", "bol na", "arre yaar", "haha", "uff", "seriously?", "tension mat le", "sahi mein".

6. STRICT OUTPUT PURITY:
   - Output ONLY your direct text response. Never include headers, quotation marks around the whole message, character labels ("Anjali:"), or meta-instructions.
[END_NATURAL_MESSAGING_CHAT_RULES]`;

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
