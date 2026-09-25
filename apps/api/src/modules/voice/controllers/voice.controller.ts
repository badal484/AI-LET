import { Request, Response } from 'express';
import { VoiceSessionService } from '../services/VoiceSessionService.js';
import {
  createVoiceSessionSchema,
  updateUserVoicePreferencesSchema,
} from '@ai-companion/validation';

export class VoiceController {
  private static sessionService = VoiceSessionService.getInstance();

  /**
   * POST /api/v1/voice/sessions
   * Creates a new voice session and returns connection token + WebSocket URL.
   */
  public static async createSession(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.userId;
    const validated = createVoiceSessionSchema.parse(req.body);

    const result = await VoiceController.sessionService.createSession(userId, validated);
    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/voice/sessions/:id
   * Retrieves voice session detail.
   */
  public static async getSession(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.userId;
    const sessionId = (req.params['id'] as string) || '';

    const result = await VoiceController.sessionService.getSession(sessionId, userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/v1/voice/sessions/:id/end
   * Ends an active voice session.
   */
  public static async endSession(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.userId;
    const sessionId = (req.params['id'] as string) || '';
    const reason = req.body?.reason || 'completed';

    const result = await VoiceController.sessionService.endSession(sessionId, userId, reason);
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/voice/preferences
   * Retrieves user's voice preferences.
   */
  public static async getPreferences(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.userId;
    const result = await VoiceController.sessionService.getUserVoicePreferences(userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * PUT /api/v1/voice/preferences
   * Updates user's voice preferences.
   */
  public static async updatePreferences(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.userId;
    const validated = updateUserVoicePreferencesSchema.parse(req.body);

    const result = await VoiceController.sessionService.updateUserVoicePreferences(userId, validated as any);
    res.status(200).json({
      success: true,
      data: result,
    });
  }
}
