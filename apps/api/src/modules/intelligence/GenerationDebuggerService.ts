import {
  GenerationDebugSnapshot,
  ReplayRequest,
  ReplayResult,
} from '@ai-companion/types';
import { PrivacyFilterService } from './PrivacyFilterService.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError, NotFoundError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class GenerationDebuggerService {
  private static instance: GenerationDebuggerService;
  private readonly privacyFilter = PrivacyFilterService.getInstance();

  private readonly snapshots: Map<string, GenerationDebugSnapshot> = new Map();

  private constructor() {}

  public static getInstance(): GenerationDebuggerService {
    if (!GenerationDebuggerService.instance) {
      GenerationDebuggerService.instance = new GenerationDebuggerService();
    }
    return GenerationDebuggerService.instance;
  }

  /**
   * Records a sanitized generation debug snapshot
   */
  public recordSnapshot(snapshot: GenerationDebugSnapshot): void {
    const sanitizedSnapshot: GenerationDebugSnapshot = {
      ...snapshot,
      contextAttribution: {
        ...snapshot.contextAttribution,
        relationshipSummary: snapshot.contextAttribution.relationshipSummary
          ? this.privacyFilter.sanitize(snapshot.contextAttribution.relationshipSummary).sanitizedText
          : undefined,
      },
    };
    this.snapshots.set(sanitizedSnapshot.generationId, sanitizedSnapshot);
    logger.info(`Recorded generation debug snapshot [${sanitizedSnapshot.generationId}] for request [${sanitizedSnapshot.requestId}]`);
  }

  /**
   * Retrieves a sanitized generation snapshot by generationId or requestId
   */
  public getSnapshot(generationIdOrRequestId: string): GenerationDebugSnapshot | null {
    const direct = this.snapshots.get(generationIdOrRequestId);
    if (direct) return direct;

    const byReq = Array.from(this.snapshots.values()).find((s) => s.requestId === generationIdOrRequestId);
    return byReq || null;
  }

  /**
   * Lists recent generation snapshots for diagnostics
   */
  public listRecentSnapshots(limit: number = 20): GenerationDebugSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Replays a historical generation safely against candidate model or prompt versions.
   * STRICT GUARANTEE: Never charges users, never creates memories, never mutates relationships, never sends notifications.
   */
  public async replayGeneration(req: ReplayRequest): Promise<ReplayResult> {
    const snapshot = this.snapshots.get(req.generationId);
    if (!snapshot) {
      throw new NotFoundError(`Generation snapshot '${req.generationId}' not found for replay.`);
    }
    // A faithful replay needs the original assembled prompt, which is deliberately not retained
    // (only sanitized attribution metadata is). Refuse rather than return a fabricated output/score.
    throw new AppError(
      'Context replay is unavailable: the original prompt context is not retained. Use /admin/ai/replay to re-run a trace against its model/provider.',
      501,
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  }

}
