import { Request, Response, NextFunction } from 'express';
import { CharacterService } from '../services/character.service.js';
import { publicCharacterQuerySchema } from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class CharacterController {
  public static async listPublicCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = publicCharacterQuerySchema.parse(req.query);
      const result = await CharacterService.listPublicCharacters(query);

      ApiResponse.success(res, result.characters, 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.page * result.limit < result.total,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPublicCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idOrSlug = req.params['idOrSlug'] as string;
      const character = await CharacterService.getPublicCharacterBySlugOrId(idOrSlug);

      ApiResponse.success(res, character, 200);
    } catch (err) {
      next(err);
    }
  }
}
