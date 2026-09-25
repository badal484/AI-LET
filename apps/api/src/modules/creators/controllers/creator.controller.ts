import { Request, Response, NextFunction } from 'express';
import { CreatorProfileService } from '../services/CreatorProfileService.js';
import { CreatorCharacterService } from '../services/CreatorCharacterService.js';
import { CreatorAnalyticsService } from '../services/CreatorAnalyticsService.js';
import { CreatorMonetizationService } from '../services/CreatorMonetizationService.js';
import {
  creatorOnboardingSchema,
  creatorProfileUpdateSchema,
  creatorCharacterCreateSchema,
  creatorCharacterDraftSaveSchema,
  creatorCharacterSubmitSchema,
  sandboxedPlaygroundChatSchema,
} from '@ai-companion/validation';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';

export class CreatorController {
  public static async onboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = creatorOnboardingSchema.parse(req.body);
      const profile = await CreatorProfileService.onboardCreator(userId, input as any);
      ApiResponse.success(res, profile, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await CreatorProfileService.getMyProfile(userId);
      ApiResponse.success(res, profile, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = creatorProfileUpdateSchema.parse(req.body);
      const updated = await CreatorProfileService.updateMyProfile(userId, input as any);
      ApiResponse.success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.params['username'] as string;
      const viewerUserId = req.user?.userId;
      const profile = await CreatorProfileService.getPublicProfile(username, viewerUserId);
      ApiResponse.success(res, profile, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async toggleFollow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.params['username'] as string;
      const followerUserId = req.user!.userId;
      const follow = req.body?.follow;
      const result = await CreatorProfileService.toggleFollow(followerUserId, username, follow);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async listCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characters = await CreatorCharacterService.listCreatorCharacters(creator.id);
      ApiResponse.success(res, characters, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const userId = req.user!.userId;
      const input = creatorCharacterCreateSchema.parse(req.body);
      const result = await CreatorCharacterService.createCharacter(creator.id, userId, input as any);
      ApiResponse.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getCharacterBuilderState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const state = await CreatorCharacterService.getCharacterBuilderState(creator.id, characterId);
      ApiResponse.success(res, state, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async saveCharacterDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const input = creatorCharacterDraftSaveSchema.parse(req.body);
      const updatedState = await CreatorCharacterService.saveDraft(creator.id, characterId, input as any);
      ApiResponse.success(res, updatedState, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async submitCharacterForReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const input = creatorCharacterSubmitSchema.parse(req.body);
      const result = await CreatorCharacterService.submitForReview(creator.id, characterId, input as any);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async unpublishCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const result = await CreatorCharacterService.unpublishCharacter(creator.id, characterId);
      ApiResponse.success(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async sandboxedPlaygroundChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const input = sandboxedPlaygroundChatSchema.parse(req.body);
      const session = await CreatorCharacterService.sandboxedPlaygroundChat(creator.id, characterId, input as any);
      ApiResponse.success(res, session, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getAnalyticsOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const analytics = await CreatorAnalyticsService.getCreatorAnalyticsOverview(creator.id);
      ApiResponse.success(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getCharacterAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const characterId = req.params['id'] as string;
      const analytics = await CreatorAnalyticsService.getCharacterAnalytics(creator.id, characterId);
      ApiResponse.success(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getMonetizationOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creator = (req as any).creator;
      const monetization = await CreatorMonetizationService.getMonetizationOverview(creator.id);
      ApiResponse.success(res, monetization, 200);
    } catch (err) {
      next(err);
    }
  }
}
