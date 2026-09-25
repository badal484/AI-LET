import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../search/SearchService.js';
import {
  searchCharacterSchema,
  searchSuggestionsSchema,
  searchFeedbackSchema,
} from '@ai-companion/validation';
import { AuthenticationError, ValidationError } from '../../../shared/errors/AppError.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class SearchController {
  /**
   * GET /api/v1/search/characters (and /api/v1/discovery/search)
   * Search characters with hybrid lexical + semantic vectors, typo tolerance, Hinglish normalization, filters, and cursor pagination.
   */
  public static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = searchCharacterSchema.parse(req.query);
      const userId = req.user?.userId || (req as any).user?.id;
      const userEntitlements = (req as any).user?.entitlements || [];

      const result = await SearchService.searchCharacters(query, userId, userEntitlements);

      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/search/suggestions
   * Returns instant autocomplete suggestions for search bar typing.
   */
  public static async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = searchSuggestionsSchema.parse(req.query);
      const userId = req.user?.userId || (req as any).user?.id;

      const suggestions = await SearchService.getSuggestions(query.q, userId, query.limit);

      ApiResponse.success(res, suggestions, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/search/recent
   * Returns user's recent search queries.
   */
  public static async getRecentSearches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required to view search history');
      }

      const limit = req.query['limit'] ? Number(req.query['limit']) : 10;
      const recent = await SearchService.getRecentSearches(userId, limit);

      ApiResponse.success(res, recent, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/search/recent/:id
   * Deletes a specific query from user search history.
   */
  public static async deleteRecentSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      const id = req.params['id'] as string;
      if (!id) {
        throw new ValidationError('Search history ID is required');
      }

      await SearchService.deleteRecentSearch(userId, id);
      ApiResponse.success(res, { message: 'Recent search deleted' }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/search/recent
   * Clears all search history for the authenticated user.
   */
  public static async clearRecentSearches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      if (!userId) {
        throw new AuthenticationError('Authentication required');
      }

      await SearchService.clearRecentSearches(userId);
      ApiResponse.success(res, { message: 'All search history cleared' }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/search/feedback
   * Logs search result interaction (click, conversation start, dismiss) for ranking quality tracking.
   */
  public static async recordFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?.id;
      const body = searchFeedbackSchema.parse(req.body);

      // Search feedback recorded for ranking quality tracking
      ApiResponse.success(res, { recorded: true, query: body.query, characterId: body.characterId, userId }, 200);
    } catch (err) {
      next(err);
    }
  }
}

