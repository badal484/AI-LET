import { Request, Response } from 'express';
import { VoiceSessionService } from '../services/VoiceSessionService.js';
import { VoiceTelemetryService } from '../services/VoiceTelemetryService.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { voicePreviewSchema, voiceSessionQuerySchema } from '@ai-companion/validation';

export class AdminVoiceController {
  private static sessionService = VoiceSessionService.getInstance();
  private static telemetryService = VoiceTelemetryService.getInstance();

  /**
   * POST /api/v1/admin/voice/preview
   * Generates a voice preview from character studio.
   */
  public static async generatePreview(req: Request, res: Response): Promise<void> {
    const validated = voicePreviewSchema.parse(req.body);
    const result = await AdminVoiceController.sessionService.generatePreview(validated);
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/admin/voice/analytics
   * Returns voice quality metrics overview.
   */
  public static async getAnalytics(_req: Request, res: Response): Promise<void> {
    const result = await AdminVoiceController.telemetryService.getQualityMetrics();
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/admin/voice/cost
   * Returns voice cost overview.
   */
  public static async getCost(_req: Request, res: Response): Promise<void> {
    const result = await AdminVoiceController.telemetryService.getCostOverview();
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/admin/voice/sessions
   * Lists historical voice sessions.
   */
  public static async listSessions(req: Request, res: Response): Promise<void> {
    const query = voiceSessionQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.characterId) where.characterId = query.characterId;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      prisma.voiceSession.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          character: { select: { id: true, name: true, avatarUrl: true } },
          user: { select: { id: true, email: true } },
        },
      }),
      prisma.voiceSession.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: items.map((s) => ({
          id: s.id,
          userId: s.userId,
          userEmail: s.user.email,
          characterId: s.characterId,
          characterName: s.character.name,
          characterAvatarUrl: s.character.avatarUrl,
          status: s.status,
          voiceMode: s.voiceMode,
          language: s.language,
          provider: s.provider,
          voiceId: s.voiceId,
          totalDurationSeconds: s.totalDurationSeconds,
          turnsCount: s.turnsCount,
          interruptionCount: s.interruptionCount,
          totalCostUsd: s.totalCostUsd,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt?.toISOString() || null,
          createdAt: s.createdAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  }
}
