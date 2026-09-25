import { ApiClient } from './client.js';
import type {
  KnowledgeDocumentItem,
  KnowledgeCollectionItem,
  HybridSearchResult,
  WebResearchTaskItem,
  GroundedAnswerResult,
  ApiSuccessResponse,
} from '@ai-companion/types';

export const knowledgeApi = {
  /**
   * Retrieves list of user documents
   */
  async listDocuments(params?: { collectionId?: string; characterId?: string }): Promise<KnowledgeDocumentItem[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<KnowledgeDocumentItem[]>>('/knowledge/documents', {
      params,
    });
    return res.data.data || [];
  },

  /**
   * Upload and process a new document
   */
  async uploadDocument(input: {
    title: string;
    filename: string;
    mimeType: string;
    rawContent: string;
    collectionId?: string;
    characterId?: string;
  }): Promise<KnowledgeDocumentItem> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<KnowledgeDocumentItem>>('/knowledge/documents', input);
    return res.data.data;
  },

  /**
   * Delete a knowledge document and its chunks
   */
  async deleteDocument(id: string): Promise<void> {
    const client = ApiClient.getInstance();
    await client.delete(`/knowledge/documents/${id}`);
  },

  /**
   * Retrieves user knowledge collections
   */
  async listCollections(): Promise<KnowledgeCollectionItem[]> {
    const client = ApiClient.getInstance();
    const res = await client.get<ApiSuccessResponse<KnowledgeCollectionItem[]>>('/knowledge/collections');
    return res.data.data || [];
  },

  /**
   * Create a new personal knowledge collection
   */
  async createCollection(input: {
    name: string;
    description?: string;
    visibility?: 'PRIVATE' | 'SHARED' | 'CHARACTER_ACCESSIBLE' | 'TASK_ONLY';
  }): Promise<KnowledgeCollectionItem> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<KnowledgeCollectionItem>>('/knowledge/collections', input);
    return res.data.data;
  },

  /**
   * Hybrid retrieval search test
   */
  async search(query: string, collectionId?: string): Promise<HybridSearchResult[]> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<HybridSearchResult[]>>('/knowledge/search', {
      query,
      collectionId,
    });
    return res.data.data || [];
  },

  /**
   * Initiate web research task
   */
  async runWebResearch(query: string): Promise<WebResearchTaskItem> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<WebResearchTaskItem>>('/knowledge/research', {
      query,
    });
    return res.data.data;
  },

  /**
   * Run grounded Q&A with strict citations
   */
  async answerGrounded(query: string, characterId?: string): Promise<GroundedAnswerResult> {
    const client = ApiClient.getInstance();
    const res = await client.post<ApiSuccessResponse<GroundedAnswerResult>>('/knowledge/qa', {
      query,
      characterId,
    });
    return res.data.data;
  },
};
