import { CharacterRuntimeObject, RelationshipStage } from '@ai-companion/types';
import { logger } from '../../../shared/utils/logger.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export interface ContextCandidate {
  id: string;
  source: 'memory' | 'summary' | 'relationship' | 'goal' | 'task' | 'knowledge' | 'attachment' | 'interlocutor';
  text: string;
  relevanceScore: number; // 0.0 to 1.0
  importanceScore: number; // 0.0 to 1.0
  timestamp?: number;
  isTemporary?: boolean;
  expiresAt?: number;
  tokenEstimate: number;
}

export interface AssembleContextParams {
  characterRuntime: CharacterRuntimeObject;
  userId: string;
  userName: string;
  conversationId: string;
  currentUserMessage: string;
  recalledMemories?: Array<{ id: string; content: string; createdAt: Date | string; confidence?: number; isTemporary?: boolean; expiresAt?: string }>;
  relationshipContextText?: string;
  relationshipStage?: RelationshipStage | null;
  conversationSummary?: string | null;
  activeGoalText?: string | null;
  activeTaskText?: string | null;
  activeSkillText?: string | null;
  multimodalSnippets?: Array<{ id: string; snippet: string; mimeType: string }>;
  retrievedKnowledgeChunks?: Array<{ id: string; title: string; content: string; page?: number; section?: string; score?: number }>;
  continuityContextText?: string | null;
  userPreferences?: {
    preferredLanguage?: string;
    conversationStyle?: string;
  };
  maxTokenBudget?: number;
}

export interface SelectedContextResult {
  systemPrompt: string;
  retrievedMemoryIds: string[];
  contextAttribution: Record<string, string[]>;
  estimatedPromptTokens: number;
}

export class ContextSelectionEngine {
  private static instance: ContextSelectionEngine;

  private constructor() {}

  public static getInstance(): ContextSelectionEngine {
    if (!ContextSelectionEngine.instance) {
      ContextSelectionEngine.instance = new ContextSelectionEngine();
    }
    return ContextSelectionEngine.instance;
  }

  /**
   * Evaluates, ranks, and budgets candidate context items into the prompt hierarchy.
   */
  public selectAndAssembleContext(params: AssembleContextParams): SelectedContextResult {
    const budget = params.maxTokenBudget || SYSTEM_CONSTANTS.CHAT.CONTEXT_WINDOW_TOKEN_BUDGET;
    const now = Date.now();
    const candidates: ContextCandidate[] = [];
    const attribution: {
      memories: string[];
      goals: string[];
      tasks: string[];
      skills: string[];
      attachments: string[];
      knowledge: string[];
    } = {
      memories: [],
      goals: [],
      tasks: [],
      skills: [],
      attachments: [],
      knowledge: [],
    };

    // 1. Process & Resolve Memory Candidates (Filter expired temporary facts & sort by recency/relevance)
    const validMemories = (params.recalledMemories || []).filter((m) => {
      if (m.isTemporary && m.expiresAt) {
        return new Date(m.expiresAt).getTime() > now;
      }
      return true;
    });

    // Conflict Resolution: newer memories take precedence
    validMemories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const mem of validMemories) {
      candidates.push({
        id: mem.id,
        source: 'memory',
        text: `- ${mem.content}`,
        relevanceScore: mem.confidence || 0.85,
        importanceScore: 0.8,
        timestamp: new Date(mem.createdAt).getTime(),
        tokenEstimate: Math.ceil(mem.content.length / 4),
      });
    }

    // 2. Active Goal Context
    if (params.activeGoalText && params.activeGoalText.trim()) {
      candidates.push({
        id: 'active_goal',
        source: 'goal',
        text: `[ACTIVE_USER_GOAL]\n${params.activeGoalText.trim()}\n[END_USER_GOAL]`,
        relevanceScore: 0.95,
        importanceScore: 0.95,
        tokenEstimate: Math.ceil(params.activeGoalText.length / 4),
      });
    }

    // 3. Active Task Context
    if (params.activeTaskText && params.activeTaskText.trim()) {
      candidates.push({
        id: 'active_task',
        source: 'task',
        text: `[ACTIVE_TASK_STATE]\n${params.activeTaskText.trim()}\n[END_TASK_STATE]`,
        relevanceScore: 0.95,
        importanceScore: 0.95,
        tokenEstimate: Math.ceil(params.activeTaskText.length / 4),
      });
    }

    // 4. Multimodal Snippets
    for (const att of params.multimodalSnippets || []) {
      candidates.push({
        id: att.id,
        source: 'attachment',
        text: `[ATTACHMENT_CONTEXT: ${att.mimeType}]\n${att.snippet}\n[END_ATTACHMENT]`,
        relevanceScore: 0.9,
        importanceScore: 0.85,
        tokenEstimate: Math.ceil(att.snippet.length / 4),
      });
    }

    // 5. Retrieved Knowledge Chunks
    for (const chunk of params.retrievedKnowledgeChunks || []) {
      candidates.push({
        id: chunk.id,
        source: 'knowledge',
        text: `<source id="${chunk.id}" title="${chunk.title}" page="${chunk.page || 1}" section="${chunk.section || 'General'}">\n${chunk.content.trim()}\n</source>`,
        relevanceScore: chunk.score || 0.92,
        importanceScore: 0.9,
        tokenEstimate: Math.ceil(chunk.content.length / 4),
      });
    }

    // 6. Character Continuity Context (Phase 27)
    if (params.continuityContextText && params.continuityContextText.trim()) {
      candidates.push({
        id: 'character_continuity_context',
        source: 'goal',
        text: `[CHARACTER_CONTINUITY_STATE]\n${params.continuityContextText.trim()}\n[END_CHARACTER_CONTINUITY]`,
        relevanceScore: 0.88,
        importanceScore: 0.85,
        tokenEstimate: Math.ceil(params.continuityContextText.length / 4),
      });
      attribution.goals.push('character_continuity');
    }

    // 7. Rank and budget candidates
    candidates.sort((a, b) => {
      const scoreA = a.relevanceScore * 0.6 + a.importanceScore * 0.4;
      const scoreB = b.relevanceScore * 0.6 + b.importanceScore * 0.4;
      return scoreB - scoreA;
    });

    // 6. Assemble System Prompt Layers
    let assembledPrompt = params.characterRuntime.compiledSystemPrompt;
    let currentTokens = Math.ceil(assembledPrompt.length / 4);

    // Dynamic relationship state
    if (params.relationshipContextText && params.relationshipContextText.trim()) {
      const relBlock = `\n\n[RELATIONSHIP_DYNAMIC_STATE]\n${params.relationshipContextText.trim()}\n[END_RELATIONSHIP_STATE]`;
      assembledPrompt += relBlock;
      currentTokens += Math.ceil(relBlock.length / 4);
    }

    // Summary
    if (params.conversationSummary && params.conversationSummary.trim()) {
      const sumBlock = `\n\n[CONVERSATION_SUMMARY]\n${params.conversationSummary.trim()}\n[END_CONVERSATION_SUMMARY]`;
      assembledPrompt += sumBlock;
      currentTokens += Math.ceil(sumBlock.length / 4);
    }

    // User preference context
    const styleSnippet = params.userPreferences?.conversationStyle
      ? `\n- User Preferred Conversation Tone: ${params.userPreferences.conversationStyle.toLowerCase()} (adapt subtly while maintaining your core identity)`
      : '';
    const partContext = `\n\n[CONVERSATION_PARTICIPANT_CONTEXT]\n- User Name: ${params.userName}\n- User Preferred Language: ${params.userPreferences?.preferredLanguage || 'en'}${styleSnippet}\n[END_PARTICIPANT_CONTEXT]`;
    assembledPrompt += partContext;
    currentTokens += Math.ceil(partContext.length / 4);

    // Active Skills
    if (params.activeSkillText && params.activeSkillText.trim()) {
      const skillBlock = `\n\n[ACTIVE_CHARACTER_SKILLS]\n${params.activeSkillText.trim()}\n[END_SKILLS]`;
      assembledPrompt += skillBlock;
      currentTokens += Math.ceil(skillBlock.length / 4);
      attribution.skills.push('active_skills');
    }

    // Append ranked candidates within budget
    const memoryBlocks: string[] = [];
    const retrievedMemoryIds: string[] = [];

    for (const cand of candidates) {
      if (currentTokens + cand.tokenEstimate > budget) {
        logger.debug(`ContextSelectionEngine: budget limit reached (${currentTokens}/${budget}), skipping candidate '${cand.id}'`);
        continue;
      }

      if (cand.source === 'memory') {
        memoryBlocks.push(cand.text);
        retrievedMemoryIds.push(cand.id);
        attribution.memories.push(cand.id);
        currentTokens += cand.tokenEstimate;
      } else if (cand.source === 'goal') {
        assembledPrompt += `\n\n${cand.text}`;
        attribution.goals.push(cand.id);
        currentTokens += cand.tokenEstimate;
      } else if (cand.source === 'task') {
        assembledPrompt += `\n\n${cand.text}`;
        attribution.tasks.push(cand.id);
        currentTokens += cand.tokenEstimate;
      } else if (cand.source === 'attachment') {
        assembledPrompt += `\n\n${cand.text}`;
        attribution.attachments.push(cand.id);
        currentTokens += cand.tokenEstimate;
      } else if (cand.source === 'knowledge') {
        assembledPrompt += `\n\n${cand.text}`;
        attribution.knowledge.push(cand.id);
        currentTokens += cand.tokenEstimate;
      }
    }

    if (memoryBlocks.length > 0) {
      assembledPrompt += `\n\n[RECALLED_USER_MEMORIES]\n${memoryBlocks.join('\n')}\n[END_RECALLED_MEMORIES]`;
    }

    return {
      systemPrompt: assembledPrompt,
      retrievedMemoryIds,
      contextAttribution: attribution,
      estimatedPromptTokens: currentTokens,
    };
  }
}
