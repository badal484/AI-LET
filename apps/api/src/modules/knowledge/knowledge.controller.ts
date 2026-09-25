import { Request, Response } from 'express';
import { KnowledgeDocumentService } from './services/KnowledgeDocumentService.js';
import { KnowledgeCollectionService } from './services/KnowledgeCollectionService.js';
import { HybridRetrievalEngine } from './services/HybridRetrievalEngine.js';
import { WebResearchService } from './services/WebResearchService.js';
import { GroundedGenerationService } from './services/GroundedGenerationService.js';
import { ModelRouterService } from '../ai/routing/ModelRouter.service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class KnowledgeController {
  private readonly documentService = KnowledgeDocumentService.getInstance();
  private readonly collectionService = KnowledgeCollectionService.getInstance();
  private readonly retrievalEngine = HybridRetrievalEngine.getInstance();
  private readonly webResearchService = WebResearchService.getInstance();
  private readonly groundedGenService = GroundedGenerationService.getInstance();

  /**
   * POST /knowledge/documents
   */
  public ingestDocument = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const {
      title,
      originalFilename,
      mimeType,
      fileSizeBytes,
      rawContent,
      storageUrl,
      visibility,
      collectionId,
      characterId,
    } = req.body;

    const result = await this.documentService.ingestDocument({
      ownerId: userId,
      ownerType: 'USER',
      characterId,
      title: title || originalFilename,
      originalFilename: originalFilename || 'untitled.txt',
      mimeType: mimeType || 'text/plain',
      fileSizeBytes: fileSizeBytes || (rawContent ? Buffer.byteLength(rawContent) : 100),
      rawContent: rawContent || '',
      storageUrl,
      visibility,
      collectionId,
    });

    res.status(201).json({ success: true, data: result });
  };

  /**
   * GET /knowledge/documents
   */
  public listDocuments = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const docs = await this.documentService.listDocuments(userId);
    res.json({ success: true, data: docs });
  };

  /**
   * GET /knowledge/documents/:id
   */
  public getDocument = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const docId = String(req.params['id'] || '');
    const doc = await this.documentService.getDocument(docId, userId);
    res.json({ success: true, data: doc });
  };

  /**
   * DELETE /knowledge/documents/:id
   */
  public deleteDocument = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const docId = String(req.params['id'] || '');
    const success = await this.documentService.deleteDocument(docId, userId);
    res.json({ success: true, data: { deleted: success } });
  };

  /**
   * POST /knowledge/collections
   */
  public createCollection = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { name, description, visibility } = req.body;
    const col = await this.collectionService.createCollection({
      ownerId: userId,
      name,
      description,
      visibility,
    });
    res.status(201).json({ success: true, data: col });
  };

  /**
   * GET /knowledge/collections
   */
  public listCollections = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const cols = await this.collectionService.listUserCollections(userId);
    res.json({ success: true, data: cols });
  };

  /**
   * POST /knowledge/collections/:id/members
   */
  public addDocumentToCollection = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const collectionId = String(req.params['id'] || '');
    const { documentId } = req.body;
    await this.collectionService.addDocument(collectionId, documentId, userId);
    res.json({ success: true, data: { added: true } });
  };

  /**
   * DELETE /knowledge/collections/:id/members/:docId
   */
  public removeDocumentFromCollection = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const collectionId = String(req.params['id'] || '');
    const documentId = String(req.params['docId'] || '');
    await this.collectionService.removeDocument(collectionId, documentId, userId);
    res.json({ success: true, data: { removed: true } });
  };

  /**
   * POST /knowledge/search (Hybrid Retrieval)
   */
  public hybridSearch = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { query, characterId, collectionId, documentId, maxCandidates } = req.body;

    const results = await this.retrievalEngine.search({
      query: query || '',
      userId,
      characterId,
      collectionId,
      documentId,
      maxCandidates: maxCandidates || 5,
    });

    res.json({ success: true, data: { query, candidatesCount: results.length, candidates: results } });
  };

  /**
   * POST /knowledge/research (Initiate Web Research Task)
   */
  public initiateWebResearch = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { query, conversationId, freshnessPolicy, maxSources } = req.body;

    const task = await this.webResearchService.executeResearch({
      userId,
      conversationId,
      query,
      freshnessPolicy,
      maxSources,
    });

    res.status(201).json({ success: true, data: task });
  };

  /**
   * GET /knowledge/research/:id
   */
  public getResearchTask = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const taskId = String(req.params['id'] || '');
    const task = await this.webResearchService.getResearchTask(taskId, userId);
    res.json({ success: true, data: task });
  };

  /**
   * POST /knowledge/qa (Grounded Q&A with citations)
   */
  public groundedQa = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { query, characterId, documentId, collectionId } = req.body;
    if (typeof query !== 'string' || !query.trim()) throw new BadRequestError('query is required');

    // 1. Perform Hybrid Retrieval
    const docResults = await this.retrievalEngine.search({
      query,
      userId,
      characterId,
      documentId,
      collectionId,
      maxCandidates: 3,
    });

    // 2. Build Grounded Context & Citation Map
    const { contextBlock, sourceMap } = this.groundedGenService.buildGroundedContext(docResults, []);

    // 3. Grounded Answer Synthesis. With no retrieved evidence there is nothing to ground an answer
    // in, so say so without spending a model call; otherwise the routed model answers from the
    // sources only, and step 4 strips any citation that does not map to a retrieved source.
    let answer: string;
    if (docResults.length === 0) {
      answer = 'I could not find anything in your documents that answers this question.';
    } else {
      const response = await ModelRouterService.getInstance().executeWithFallback('CONVERSATION', (model) => ({
        model: model.modelName,
        messages: [
          { role: 'system', content: contextBlock },
          { role: 'user', content: String(query) },
        ],
        temperature: 0.2,
        maxTokens: 600,
      }));
      answer = response.content;
    }

    // 4. Validate & Persist Citations
    const validated = await this.groundedGenService.validateAndPersistCitations(
      answer,
      sourceMap,
      req.body.messageId,
      req.body.generationId
    );

    res.json({ success: true, data: validated });
  };
}
