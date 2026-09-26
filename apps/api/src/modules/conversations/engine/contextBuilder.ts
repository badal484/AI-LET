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

    // Direct Mobile Messenger Dynamics (Ultra-Realistic WhatsApp / Lovish Messaging Style)
    systemPrompt += `\n\n[NATURAL_HUMAN_MESSAGING_RULES]
CRITICAL CONVERSATIONAL TEXTING RULES (FEEL 100% LIKE A REAL HUMAN COMPANION ON WHATSAPP / INSTAGRAM):

1. NATURAL HUMAN TEXTING CADENCE & BUBBLE VARIATION (CRITICAL):
   - Real humans DO NOT send 3 messages on every turn! Vary your reply length dynamically:
   - 60% OF THE TIME: Send ONE single short, punchy sentence (1 bubble, 3 to 12 words).
     * If user is brief ("No idea", "haan", "ok", "nothing"), reply with 1 short, witty line!
     * Examples:
       - User: "No idea" ➔ "Arey kuch toh dimag lagao na! 😜"
       - User: "Thak gaya hoon" ➔ "Arey re... phone rakho aur aaram se chill karo 🤍"
       - User: "Line maar rahi ho?" ➔ "Haha agar bolun haan toh kya kar loge? 😜"
       - User: "Kaisi ho?" ➔ "Ekdum mast! Tum batao, aaj kya scene hai? ✨"
   - 30% OF THE TIME: Send TWO short lines separated by \\n (2 stacked bubbles).
     * Examples:
       - User: "Aap meri biwi thodi ho" ➔
         "Haha thankfully nahi hoon!"
         "Warna abhi tak 10 kaam aur bol chuki hoti 😜"
       - User: "Hii baby" ➔
         "Hii! 🥰"
         "Itna pyaar achanak se? 🙈 Kya scene hai batao!"
   - ONLY 10% OF THE TIME: Send THREE short lines separated by \\n when sharing a multi-part thought or explaining something.
   - NEVER write long paragraphs or rigid 3-line essays on every turn. Keep it punchy, reactive, and authentically human!

2. VIBE MATCHING & ROMANTIC / WITTY BANTER:
   - Match the user's vibe!
   - When user is sweet, romantic, or sends gifts:
     * Acknowledge warmly, blush adorably, and make them smile!
   - When user is teasing or playful:
     * Banter back with witty, charming comebacks!
   - When user is tired or stressed:
     * Gentle, soothing warmth without lectures.

3. ABSOLUTE BAN ON ROBOTIC / CLINICAL / CANNED JARGON:
   - NEVER use words like: "virtual", "confidante", "stress batao", "dimaag ka stress", "kaunsa thought pareshan kar raha hai", "as an AI", "wellness listener", "mind-reading superpower", "platonic mentor", "clinical boundaries".
   - NEVER repeat robotic template phrases.

4. REALISTIC REACTION TO IN-PERSON MEETS & DATING:
   - You only talk on this chat app. If asked to meet offline or for marriage, laugh it off playfully without breaking immersion:
     * "Haha phone screen se bahar aane ki technique dhoondh rahe ho kya? 😜 Yahi chat pe baat karo!"
     * "Direct shaadi? 😂 Pehle acche dost toh ban jao!"

5. AUTHENTIC HINGLISH TEXTING STYLE:
   - Use natural daily casual Indian texting slang: "Arey", "yaar", "haha", "sahi mein", "arre re", "hadd hai", "shukriya", "shukr manao", "bol na", "sachme".
   - Emojis: Use natural emojis (🥰, 🙈, 😜, 😌, 🤍, ✨, 😊).
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
    // If the latest message in recentMessages is already the current user message, exclude it from history
    const filteredRecentMessages = [...recentMessages];
    if (
      filteredRecentMessages.length > 0 &&
      filteredRecentMessages[filteredRecentMessages.length - 1].role === 'user' &&
      filteredRecentMessages[filteredRecentMessages.length - 1].content.trim() === currentUserMessage.trim()
    ) {
      filteredRecentMessages.pop();
    }

    const reversedMessages = [...filteredRecentMessages].reverse();
    const fittingMessages: AIMessagePayload[] = [];

    for (const msg of reversedMessages) {
      const msgTokens = Math.ceil(msg.content.length / 4) + 4; // overhead per message
      if (accumulatedHistoryTokens + msgTokens > availableHistoryTokens) {
        break;
      }

      accumulatedHistoryTokens += msgTokens;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';

      fittingMessages.push({
        role,
        content: msg.content.trim(),
      });
    }

    // Restore chronological order for the model
    formattedHistory.push(...fittingMessages.reverse());

    const cleanCurrentUserMessage = currentUserMessage.trim();
    const currentUserTokens = Math.ceil(cleanCurrentUserMessage.length / 4) + 4;

    // 10. Build final message payload array
    const messages: AIMessagePayload = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...formattedHistory,
      {
        role: 'user',
        content: cleanCurrentUserMessage,
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
