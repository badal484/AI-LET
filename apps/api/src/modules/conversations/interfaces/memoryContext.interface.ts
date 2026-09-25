/**
 * Phase 4 & Phase 5 Memory Context Interface
 * Provides pluggable memory extraction & retrieval contract for conversation engine.
 */
export interface MemoryContextResult {
  memoriesText: string;
  retrievedMemoryIds: string[];
  estimatedTokens: number;
}

export interface IMemoryContextProvider {
  getMemoryContext(
    userId: string,
    characterId: string,
    conversationId: string,
    currentQuery?: string,
  ): Promise<MemoryContextResult>;
}

/**
 * Null/Passthrough Memory Context Provider used during Phase 4.
 * Phase 5 will provide the vector embedding and multi-tier memory provider.
 */
export class NullMemoryContextProvider implements IMemoryContextProvider {
  async getMemoryContext(
    _userId: string,
    _characterId: string,
    _conversationId: string,
    _currentQuery?: string,
  ): Promise<MemoryContextResult> {
    return {
      memoriesText: '',
      retrievedMemoryIds: [],
      estimatedTokens: 0,
    };
  }
}
