import crypto from 'crypto';
import {
  ContextBudgetCategory,
  ContextBudgetBreakdown,
  ContextPruningResult,
  ContextHashData,
} from '@ai-companion/types';

export interface PromptSectionInput {
  systemSafety: string[];
  runtimeConstraints: string[];
  currentUserMessage: string;
  characterIdentity: string[];
  currentConversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  relevantMemories: string[];
  relationshipContext: string[];
  optionalHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class ContextBudgetManager {
  private static instance: ContextBudgetManager;

  private constructor() {}

  public static getInstance(): ContextBudgetManager {
    if (!ContextBudgetManager.instance) {
      ContextBudgetManager.instance = new ContextBudgetManager();
    }
    return ContextBudgetManager.instance;
  }

  public estimateTokenCount(text: string): number {
    if (!text) return 0;
    // Fast estimation: ~4 chars per token for English/code, ~2 chars for multilingual/Devanagari
    return Math.max(1, Math.ceil(text.length / 3.8));
  }

  public calculateBudget(
    sections: PromptSectionInput,
    modelContextWindow: number = 8192,
    reserveOutputTokens: number = 1024
  ): ContextBudgetBreakdown {
    const safetyTokens = this.estimateTokenCount(sections.systemSafety.join('\n'));
    const runtimeTokens = this.estimateTokenCount(sections.runtimeConstraints.join('\n'));
    const userMsgTokens = this.estimateTokenCount(sections.currentUserMessage);
    const charTokens = this.estimateTokenCount(sections.characterIdentity.join('\n'));
    const convTokens = this.estimateTokenCount(
      sections.currentConversation.map((m) => `${m.role}: ${m.content}`).join('\n')
    );
    const memoryTokens = this.estimateTokenCount(sections.relevantMemories.join('\n'));
    const relTokens = this.estimateTokenCount(sections.relationshipContext.join('\n'));
    const histTokens = this.estimateTokenCount(
      sections.optionalHistory.map((m) => `${m.role}: ${m.content}`).join('\n')
    );

    const categories: Partial<Record<ContextBudgetCategory, number>> = {
      system_safety: safetyTokens,
      runtime_constraints: runtimeTokens,
      user_message: userMsgTokens,
      character_identity: charTokens,
      conversation_history: convTokens,
      memory: memoryTokens,
      relationship: relTokens,
      historical_archive: histTokens,
      output_reserve: reserveOutputTokens,
    };

    const usedTokens =
      safetyTokens +
      runtimeTokens +
      userMsgTokens +
      charTokens +
      convTokens +
      memoryTokens +
      relTokens +
      histTokens;

    return {
      totalCapacity: modelContextWindow,
      allocatedTokens: usedTokens + reserveOutputTokens,
      remainingTokens: Math.max(0, modelContextWindow - (usedTokens + reserveOutputTokens)),
      categories,
    };
  }

  public pruneToBudget(
    sections: PromptSectionInput,
    modelContextWindow: number = 8192,
    reserveOutputTokens: number = 1024
  ): ContextPruningResult {
    const targetMaxInputTokens = Math.max(10, modelContextWindow - reserveOutputTokens);

    const prunedSections: PromptSectionInput = {
      systemSafety: [...sections.systemSafety],
      runtimeConstraints: [...sections.runtimeConstraints],
      currentUserMessage: sections.currentUserMessage,
      characterIdentity: [...sections.characterIdentity],
      currentConversation: [...sections.currentConversation],
      relevantMemories: [...sections.relevantMemories],
      relationshipContext: [...sections.relationshipContext],
      optionalHistory: [...sections.optionalHistory],
    };

    const droppedCategories: ContextBudgetCategory[] = [];
    let initialBreakdown = this.calculateBudget(prunedSections, modelContextWindow, reserveOutputTokens);
    let totalInputTokens = (initialBreakdown.allocatedTokens ?? 0) - reserveOutputTokens;

    if (totalInputTokens <= targetMaxInputTokens) {
      return {
        prunedSections,
        originalTokenCount: totalInputTokens,
        finalTokenCount: totalInputTokens,
        wasPruned: false,
        droppedCategories,
      };
    }

    // --- Pruning Order (Lowest Priority to Highest) ---
    // Tier 8: optionalHistory
    while (prunedSections.optionalHistory.length > 0 && totalInputTokens > targetMaxInputTokens) {
      prunedSections.optionalHistory.shift(); // Drop oldest history message
      if (!droppedCategories.includes('historical_archive')) {
        droppedCategories.push('historical_archive');
      }
      totalInputTokens = (this.calculateBudget(prunedSections, modelContextWindow, reserveOutputTokens).allocatedTokens ?? 0) - reserveOutputTokens;
    }

    // Tier 7: relationshipContext
    while (prunedSections.relationshipContext.length > 0 && totalInputTokens > targetMaxInputTokens) {
      prunedSections.relationshipContext.pop();
      if (!droppedCategories.includes('relationship')) {
        droppedCategories.push('relationship');
      }
      totalInputTokens = (this.calculateBudget(prunedSections, modelContextWindow, reserveOutputTokens).allocatedTokens ?? 0) - reserveOutputTokens;
    }

    // Tier 6: relevantMemories
    while (prunedSections.relevantMemories.length > 0 && totalInputTokens > targetMaxInputTokens) {
      prunedSections.relevantMemories.pop(); // Drop lowest scored memory
      if (!droppedCategories.includes('memory')) {
        droppedCategories.push('memory');
      }
      totalInputTokens = (this.calculateBudget(prunedSections, modelContextWindow, reserveOutputTokens).allocatedTokens ?? 0) - reserveOutputTokens;
    }

    // Tier 5: currentConversation (keep at least last 2 messages if possible)
    while (prunedSections.currentConversation.length > 2 && totalInputTokens > targetMaxInputTokens) {
      prunedSections.currentConversation.shift(); // Drop oldest conversation turn
      if (!droppedCategories.includes('conversation_history')) {
        droppedCategories.push('conversation_history');
      }
      totalInputTokens = (this.calculateBudget(prunedSections, modelContextWindow, reserveOutputTokens).allocatedTokens ?? 0) - reserveOutputTokens;
    }

    // NOTE: Tier 1 (safety), Tier 2 (runtime), Tier 3 (user msg), Tier 4 (character identity) MUST NEVER be dropped.

    return {
      prunedSections,
      originalTokenCount: (initialBreakdown.allocatedTokens ?? 0) - reserveOutputTokens,
      finalTokenCount: totalInputTokens,
      wasPruned: true,
      droppedCategories,
    };
  }

  public computeContextHash(sections: PromptSectionInput, modelId?: string): ContextHashData {
    const serialized = JSON.stringify({
      safety: sections.systemSafety,
      runtime: sections.runtimeConstraints,
      userMsg: sections.currentUserMessage,
      character: sections.characterIdentity,
      conversation: sections.currentConversation,
      memories: sections.relevantMemories,
      relationship: sections.relationshipContext,
      history: sections.optionalHistory,
      model: modelId || 'default',
    });

    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    const tokenEstimate = this.estimateTokenCount(serialized);

    return {
      hash,
      tokenEstimate,
      componentCount:
        sections.systemSafety.length +
        sections.runtimeConstraints.length +
        sections.characterIdentity.length +
        sections.currentConversation.length +
        sections.relevantMemories.length +
        sections.relationshipContext.length +
        sections.optionalHistory.length +
        1,
      createdAt: new Date().toISOString(),
    };
  }
}
