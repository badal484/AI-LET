import { IMemoryContextProvider, MemoryContextResult } from '../../conversations/interfaces/memoryContext.interface.js';
import { MemoryRetrieverService } from './memoryRetriever.service.js';

export class MemoryContextProvider implements IMemoryContextProvider {
  public async getMemoryContext(
    userId: string,
    characterId: string,
    conversationId: string,
    currentQuery?: string,
  ): Promise<MemoryContextResult> {
    const result = await MemoryRetrieverService.retrieveContext({
      userId,
      characterId,
      conversationId,
      query: currentQuery || '',
      // The "who they are" card covers the essentials; these are extra relevant details.
      maxMemories: 10,
    });

    return {
      memoriesText: result.formattedPromptBlock,
      retrievedMemoryIds: result.memories.map(m => m.id),
      estimatedTokens: result.tokenCount,
    };
  }
}
