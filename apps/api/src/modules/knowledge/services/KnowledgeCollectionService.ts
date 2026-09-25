import crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type { KnowledgeCollectionItem, KnowledgeVisibility } from '@ai-companion/types';

export interface CreateCollectionInput {
  ownerId: string;
  name: string;
  description?: string;
  visibility?: KnowledgeVisibility;
}

export class KnowledgeCollectionService {
  private static instance: KnowledgeCollectionService;

  private constructor() {}

  public static getInstance(): KnowledgeCollectionService {
    if (!KnowledgeCollectionService.instance) {
      KnowledgeCollectionService.instance = new KnowledgeCollectionService();
    }
    return KnowledgeCollectionService.instance;
  }

  /**
   * Creates a new knowledge collection
   */
  public async createCollection(input: CreateCollectionInput): Promise<KnowledgeCollectionItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestError('Collection name is required.', ErrorCode.VALIDATION_ERROR);
    }

    const id = `col_${crypto.randomUUID()}`;
    const record = await prisma.knowledgeCollection.create({
      data: {
        id,
        ownerId: input.ownerId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility || 'PRIVATE',
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    logger.info(`Created knowledge collection '${id}' for owner '${input.ownerId}'`);
    return this.mapCollectionToItem(record);
  }

  /**
   * Retrieves collection by ID with permission checks
   */
  public async getCollection(collectionId: string, requestingUserId?: string): Promise<KnowledgeCollectionItem> {
    const record = await prisma.knowledgeCollection.findUnique({
      where: { id: collectionId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundError(`KnowledgeCollection '${collectionId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (requestingUserId && record.ownerId !== requestingUserId && record.visibility === 'PRIVATE') {
      throw new ForbiddenError('Unauthorized access to this private collection.', ErrorCode.FORBIDDEN);
    }

    return this.mapCollectionToItem(record);
  }

  /**
   * Lists collections owned by user
   */
  public async listUserCollections(ownerId: string): Promise<KnowledgeCollectionItem[]> {
    const records = await prisma.knowledgeCollection.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(this.mapCollectionToItem);
  }

  /**
   * Adds a document to a collection with tenant verification
   */
  public async addDocument(collectionId: string, documentId: string, userId: string): Promise<void> {
    const collection = await this.getCollection(collectionId, userId);
    if (collection.ownerId !== userId) {
      throw new ForbiddenError('Only the collection owner can add documents.', ErrorCode.FORBIDDEN);
    }

    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.status === 'DELETED') {
      throw new NotFoundError(`Document '${documentId}' not found.`, ErrorCode.NOT_FOUND);
    }

    if (doc.ownerId !== userId && doc.visibility === 'PRIVATE') {
      throw new ForbiddenError('Cannot add another user\'s private document to collection.', ErrorCode.FORBIDDEN);
    }

    await prisma.knowledgeCollectionMember.upsert({
      where: {
        collectionId_documentId: { collectionId, documentId },
      },
      update: {},
      create: {
        id: `col_mem_${crypto.randomUUID()}`,
        collectionId,
        documentId,
      },
    });

    logger.info(`Added document '${documentId}' to collection '${collectionId}'`);
  }

  /**
   * Removes a document from a collection
   */
  public async removeDocument(collectionId: string, documentId: string, userId: string): Promise<void> {
    const collection = await this.getCollection(collectionId, userId);
    if (collection.ownerId !== userId) {
      throw new ForbiddenError('Only the collection owner can remove documents.', ErrorCode.FORBIDDEN);
    }

    await prisma.knowledgeCollectionMember.deleteMany({
      where: { collectionId, documentId },
    });

    logger.info(`Removed document '${documentId}' from collection '${collectionId}'`);
  }

  /**
   * Deletes a collection
   */
  public async deleteCollection(collectionId: string, userId: string): Promise<boolean> {
    const collection = await this.getCollection(collectionId, userId);
    if (collection.ownerId !== userId) {
      throw new ForbiddenError('Only the owner can delete this collection.', ErrorCode.FORBIDDEN);
    }

    await prisma.knowledgeCollection.delete({
      where: { id: collectionId },
    });

    logger.info(`Deleted collection '${collectionId}'`);
    return true;
  }

  private mapCollectionToItem(record: any): KnowledgeCollectionItem {
    return {
      id: record.id,
      ownerId: record.ownerId,
      name: record.name,
      description: record.description,
      visibility: record.visibility as any,
      documentCount: record._count?.members || 0,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
